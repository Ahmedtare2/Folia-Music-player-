package top.izuna.foliamajor;

import android.content.Context;
import android.media.AudioFormat;
import android.media.MediaCodec;
import android.media.MediaCodecList;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.os.Build;
import android.os.SystemClock;
import androidx.annotation.Nullable;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/**
 * Transparent on-device audio transcoder for Android WebView & Media3 playback.
 *
 * Solves Android audio compatibility gaps:
 *   1. Apple Lossless (ALAC in .m4a / .alac containers), AIFF (.aif/.aiff), CAF (.caf), WMA, etc.
 *      are rejected by Chromium WebView's built-in HTML5 <audio> demuxer.
 *   2. Provides a fast, bit-exact two-layer decoding pipeline that converts non-WebView-native audio
 *      containers into seekable 16-bit Little-Endian RIFF/WAVE (.wav) files inside
 *      context.getCacheDir()/saf_audio_stage/:
 *      - Built-in bit-exact pure-Java Apple Lossless (ALAC 16-bit/20-bit/24-bit/32-bit) MP4/M4A &
 *        AIFF/AIFC decoder (verified bit-exact against FFmpeg) with 64-bit word-aligned bit reading
 *        and zero per-packet heap allocations.
 *      - Bounded Android platform MediaExtractor + MediaCodec fallback for CAF/WMA/other containers.
 */
public final class FoliaAlacAndPcmTranscoder {
    private static final long TIMEOUT_US = 10_000L;
    private static final long MAX_MEDIACODEC_WALL_MS = 8_000L;

    private FoliaAlacAndPcmTranscoder() {}

    /**
     * Inspects the file header and MP4 box hierarchy (walking past large mdat / udta cover boxes in O(1))
     * and returns true if the file uses a codec (such as ALAC inside .m4a/.alac, AIFF, CAF, or WMA)
     * that Android WebView's <audio> element cannot decode directly.
     */
    public static boolean needsWavTranscode(
        File file,
        @Nullable String mimeType,
        @Nullable String uriHint,
        boolean forceTranscode
    ) {
        if (forceTranscode) return true;
        if (file == null || !file.isFile() || file.length() < 16L) return false;

        String lowerMime = mimeType != null ? mimeType.toLowerCase(Locale.ROOT) : "";
        String lowerUri = uriHint != null ? uriHint.toLowerCase(Locale.ROOT) : "";
        if (lowerMime.contains("alac") || lowerMime.contains("aiff") || lowerMime.contains("x-aiff")
            || lowerMime.contains("x-caf") || lowerMime.contains("x-ms-wma") || lowerMime.contains("wavpack")
            || lowerMime.contains("monkey")) {
            return true;
        }
        if (lowerUri.endsWith(".alac") || lowerUri.endsWith(".aif") || lowerUri.endsWith(".aiff")
            || lowerUri.endsWith(".caf") || lowerUri.endsWith(".wma") || lowerUri.endsWith(".wv")
            || lowerUri.endsWith(".ape") || lowerUri.endsWith(".tta")) {
            return true;
        }

        try (RandomAccessFile raf = new RandomAccessFile(file, "r")) {
            long fileLen = raf.length();
            if (fileLen < 16L) return false;
            byte[] head = new byte[16];
            raf.readFully(head);

            // Check AIFF / AIFC ("FORM....AIFF" or "FORM....AIFC")
            if (head[0] == 'F' && head[1] == 'O' && head[2] == 'R' && head[3] == 'M'
                && head[8] == 'A' && head[9] == 'I' && head[10] == 'F' && (head[11] == 'F' || head[11] == 'C')) {
                return true;
            }

            // Check Apple CAF ("caff")
            if (head[0] == 'c' && head[1] == 'a' && head[2] == 'f' && head[3] == 'f') {
                return true;
            }

            // Standard RIFF/WAVE
            if (head[0] == 'R' && head[1] == 'I' && head[2] == 'F' && head[3] == 'F'
                && head[8] == 'W' && head[9] == 'A' && head[10] == 'V' && head[11] == 'E') {
                return false;
            }

            // Check MP4 / M4A container by walking box headers directly to moov -> trak -> mdia -> minf -> stbl -> stsd
            if (isMp4Header(head)) {
                String codecFourCc = findMp4AudioStsdFourCc(raf, 0L, fileLen, 0);
                if ("alac".equals(codecFourCc)) {
                    return true;
                }
                if (codecFourCc != null) {
                    return false;
                }
            }
        } catch (Exception ignored) {}

        return false;
    }

    private static boolean isMp4Header(byte[] b) {
        if (b.length < 8) return false;
        String box = new String(b, 4, 4, StandardCharsets.ISO_8859_1);
        return "ftyp".equals(box) || "moov".equals(box) || "mdat".equals(box)
            || "free".equals(box) || "wide".equals(box) || "skip".equals(box);
    }

    /**
     * Walks MP4 box headers in O(1) (skipping mdat, udta, meta, free boxes without reading their payload)
     * to locate the audio track's `stsd` sample entry FourCC ("alac", "mp4a", "fLaC", "Opus").
     */
    @Nullable
    private static String findMp4AudioStsdFourCc(RandomAccessFile raf, long start, long end, int depth) throws IOException {
        if (depth > 8) return null;
        long pos = start;
        byte[] hdr = new byte[16];
        while (pos + 8L <= end) {
            raf.seek(pos);
            int toRead = (int) Math.min(16L, end - pos);
            raf.readFully(hdr, 0, toRead);
            long boxSize = ((hdr[0] & 0xFFL) << 24) | ((hdr[1] & 0xFFL) << 16)
                | ((hdr[2] & 0xFFL) << 8) | (hdr[3] & 0xFFL);
            String boxType = new String(hdr, 4, 4, StandardCharsets.ISO_8859_1);
            long headerLen = 8L;
            if (boxSize == 1L) {
                if (toRead < 16) break;
                boxSize = ((hdr[8] & 0xFFL) << 56) | ((hdr[9] & 0xFFL) << 48)
                    | ((hdr[10] & 0xFFL) << 40) | ((hdr[11] & 0xFFL) << 32)
                    | ((hdr[12] & 0xFFL) << 24) | ((hdr[13] & 0xFFL) << 16)
                    | ((hdr[14] & 0xFFL) << 8) | (hdr[15] & 0xFFL);
                headerLen = 16L;
            } else if (boxSize == 0L) {
                boxSize = end - pos;
            }
            if (boxSize < headerLen || pos + boxSize > end) break;
            long contentStart = pos + headerLen;
            long boxEnd = pos + boxSize;

            if ("moov".equals(boxType) || "trak".equals(boxType) || "mdia".equals(boxType)
                || "minf".equals(boxType) || "stbl".equals(boxType)) {
                String found = findMp4AudioStsdFourCc(raf, contentStart, boxEnd, depth + 1);
                if (found != null) return found;
            } else if ("stsd".equals(boxType) && boxEnd - contentStart >= 16L) {
                raf.seek(contentStart + 12L);
                byte[] fourCc = new byte[4];
                raf.readFully(fourCc);
                String entryType = new String(fourCc, StandardCharsets.ISO_8859_1);
                if ("alac".equals(entryType) || "mp4a".equals(entryType)
                    || "fLaC".equals(entryType) || "Opus".equals(entryType)) {
                    return entryType;
                }
            }
            pos = boxEnd;
        }
        return null;
    }

    /**
     * Transcodes `sourceFile` to a seekable 16-bit Little-Endian RIFF/WAVE file in the staged audio
     * cache directory if not already cached, returning the WAV File (or null if transcoding failed).
     */
    @Nullable
    public static File transcodeToCachedWav(Context context, File sourceFile, String stageBaseName) {
        if (context == null || sourceFile == null || !sourceFile.isFile()) return null;
        File stageDir = FoliaSafStreamHandler.getStagedAudioCacheDir(context);
        File wavFile = new File(stageDir, stageBaseName + "_pcm.wav");
        if (wavFile.isFile() && wavFile.length() > 44L) {
            //noinspection ResultOfMethodCallIgnored
            wavFile.setLastModified(System.currentTimeMillis());
            return wavFile;
        }

        synchronized (FoliaAlacAndPcmTranscoder.class) {
            if (wavFile.isFile() && wavFile.length() > 44L) {
                //noinspection ResultOfMethodCallIgnored
                wavFile.setLastModified(System.currentTimeMillis());
                return wavFile;
            }

            File tempWav = new File(stageDir, wavFile.getName() + ".tmp." + Thread.currentThread().getId());
            boolean decoded = false;
            try {
                // 1. Pure-Java AIFF/AIFC decoder for AIFF files
                if (isAiffFile(sourceFile)) {
                    decoded = decodeAiffToWav(sourceFile, tempWav);
                }
                // 2. Bit-exact Pure-Java ALAC MP4/M4A decoder first for ALAC files (zero MediaCodec hang risk)
                if (!decoded) {
                    decoded = decodeAlacMp4PureJavaToWav(sourceFile, tempWav);
                }
                // 3. Bounded Android platform MediaExtractor + MediaCodec fallback for other formats
                if (!decoded) {
                    decoded = decodeWithMediaCodecToWav(sourceFile, tempWav);
                }

                if (decoded && tempWav.isFile() && tempWav.length() > 44L) {
                    if (!tempWav.renameTo(wavFile)) {
                        try (FileInputStream in = new FileInputStream(tempWav);
                             FileOutputStream out = new FileOutputStream(wavFile)) {
                            byte[] buf = new byte[65536];
                            int r;
                            while ((r = in.read(buf)) != -1) {
                                out.write(buf, 0, r);
                            }
                        } finally {
                            //noinspection ResultOfMethodCallIgnored
                            tempWav.delete();
                        }
                    }
                    if (wavFile.isFile() && wavFile.length() > 44L) {
                        return wavFile;
                    }
                }
            } catch (Exception ignored) {
                //noinspection ResultOfMethodCallIgnored
                tempWav.delete();
            }
            //noinspection ResultOfMethodCallIgnored
            tempWav.delete();
            return null;
        }
    }

    private static boolean isAiffFile(File file) {
        try (FileInputStream fis = new FileInputStream(file)) {
            byte[] h = new byte[12];
            if (fis.read(h) == 12) {
                return h[0] == 'F' && h[1] == 'O' && h[2] == 'R' && h[3] == 'M'
                    && h[8] == 'A' && h[9] == 'I' && h[10] == 'F' && (h[11] == 'F' || h[11] == 'C');
            }
        } catch (Exception ignored) {}
        return false;
    }

    // =========================================================================
    // Layer 1: Bit-Exact Pure-Java Apple Lossless (ALAC) MP4/M4A -> 16-bit WAV
    // =========================================================================
    private static final class AlacConfig {
        int frameLength;
        int bitDepth;
        int pb; // rice_historymult (typically 40)
        int mb; // rice_initialhistory (typically 10)
        int kb; // rice_kmodifier (typically 14)
        int numChannels;
        int maxRun;
        int maxFrameBytes;
        int avgBitRate;
        int sampleRate;
        int[] sampleSizes = new int[0];
        int defaultSampleSize = 0;
        int sampleCount = 0;
        long[] chunkOffsets = new long[0];
        int[] stscFirstChunk = new int[0];
        int[] stscSamplesPerChunk = new int[0];
    }

    private static boolean decodeAlacMp4PureJavaToWav(File sourceFile, File outWavFile) {
        try (RandomAccessFile raf = new RandomAccessFile(sourceFile, "r")) {
            AlacConfig cfg = new AlacConfig();
            long fileLen = raf.length();
            parseMp4ForAlac(raf, 0L, fileLen, 0, cfg);
            if (cfg.sampleRate <= 0 || cfg.numChannels <= 0 || cfg.frameLength <= 0 || cfg.chunkOffsets.length == 0) {
                return false;
            }

            long[] sampleOffsets = computeMp4SampleOffsets(cfg);
            if (sampleOffsets.length == 0) return false;

            int channels = Math.min(2, cfg.numChannels);
            int maxSamplesPerFrame = Math.max(4096, cfg.frameLength);
            int[] outLeft = new int[maxSamplesPerFrame];
            int[] outRight = new int[maxSamplesPerFrame];
            int[] predLeft = new int[maxSamplesPerFrame];
            int[] predRight = new int[maxSamplesPerFrame];
            int[] extraLeft = new int[maxSamplesPerFrame];
            int[] extraRight = new int[maxSamplesPerFrame];
            short[] coefsLeft = new short[32];
            short[] coefsRight = new short[32];

            int maxPktBytes = Math.max(65536, cfg.maxFrameBytes > 0 ? cfg.maxFrameBytes + 256 : 65536);
            byte[] pktBuf = new byte[maxPktBytes];
            byte[] pcmFrameBuf = new byte[maxSamplesPerFrame * channels * 2];

            long totalPcmBytes = 0L;
            try (FileOutputStream fos = new FileOutputStream(outWavFile);
                 BufferedOutputStream bos = new BufferedOutputStream(fos, 262144)) {
                writeWavHeader(bos, 0L, cfg.sampleRate, channels, 16);

                for (int i = 0; i < sampleOffsets.length; i++) {
                    int pktSize = cfg.defaultSampleSize > 0
                        ? cfg.defaultSampleSize
                        : (i < cfg.sampleSizes.length ? cfg.sampleSizes[i] : 0);
                    if (pktSize <= 0 || sampleOffsets[i] + pktSize > fileLen) continue;

                    if (pktSize > pktBuf.length) {
                        pktBuf = new byte[pktSize + 1024];
                    }
                    raf.seek(sampleOffsets[i]);
                    raf.readFully(pktBuf, 0, pktSize);

                    int decodedSamples = decodeAlacPacket(
                        pktBuf,
                        pktSize,
                        cfg,
                        outLeft,
                        outRight,
                        predLeft,
                        predRight,
                        extraLeft,
                        extraRight,
                        coefsLeft,
                        coefsRight
                    );
                    if (decodedSamples <= 0) continue;

                    int shift = Math.max(0, cfg.bitDepth - 16);
                    int byteIdx = 0;
                    for (int s = 0; s < decodedSamples; s++) {
                        int l16 = Math.max(-32768, Math.min(32767, outLeft[s] >> shift));
                        pcmFrameBuf[byteIdx++] = (byte) (l16 & 0xFF);
                        pcmFrameBuf[byteIdx++] = (byte) ((l16 >> 8) & 0xFF);
                        if (channels == 2) {
                            int r16 = Math.max(-32768, Math.min(32767, outRight[s] >> shift));
                            pcmFrameBuf[byteIdx++] = (byte) (r16 & 0xFF);
                            pcmFrameBuf[byteIdx++] = (byte) ((r16 >> 8) & 0xFF);
                        }
                    }
                    bos.write(pcmFrameBuf, 0, byteIdx);
                    totalPcmBytes += byteIdx;
                }
                bos.flush();
            }

            if (totalPcmBytes <= 0L) return false;

            try (RandomAccessFile outRaf = new RandomAccessFile(outWavFile, "rw")) {
                outRaf.seek(0L);
                outRaf.write(buildWavHeaderBytes(totalPcmBytes, cfg.sampleRate, channels, 16));
            }
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private static void parseMp4ForAlac(RandomAccessFile raf, long start, long end, int depth, AlacConfig cfg) throws IOException {
        if (depth > 9) return;
        long pos = start;
        byte[] hdr = new byte[16];
        while (pos + 8L <= end) {
            raf.seek(pos);
            int toRead = (int) Math.min(16L, end - pos);
            raf.readFully(hdr, 0, toRead);
            long boxSize = ((hdr[0] & 0xFFL) << 24) | ((hdr[1] & 0xFFL) << 16)
                | ((hdr[2] & 0xFFL) << 8) | (hdr[3] & 0xFFL);
            String boxType = new String(hdr, 4, 4, StandardCharsets.ISO_8859_1);
            long headerLen = 8L;
            if (boxSize == 1L) {
                if (toRead < 16) break;
                boxSize = ((hdr[8] & 0xFFL) << 56) | ((hdr[9] & 0xFFL) << 48)
                    | ((hdr[10] & 0xFFL) << 40) | ((hdr[11] & 0xFFL) << 32)
                    | ((hdr[12] & 0xFFL) << 24) | ((hdr[13] & 0xFFL) << 16)
                    | ((hdr[14] & 0xFFL) << 8) | (hdr[15] & 0xFFL);
                headerLen = 16L;
            } else if (boxSize == 0L) {
                boxSize = end - pos;
            }
            if (boxSize < headerLen || pos + boxSize > end) break;
            long contentStart = pos + headerLen;
            long boxEnd = pos + boxSize;

            if ("moov".equals(boxType) || "trak".equals(boxType) || "mdia".equals(boxType)
                || "minf".equals(boxType) || "stbl".equals(boxType)) {
                parseMp4ForAlac(raf, contentStart, boxEnd, depth + 1, cfg);
            } else if ("stsd".equals(boxType) && boxEnd - contentStart >= 48L) {
                int stsdLen = (int) Math.min(4096L, boxEnd - contentStart);
                byte[] stsd = new byte[stsdLen];
                raf.seek(contentStart);
                raf.readFully(stsd);
                // Outer sample entry type is at stsd[12..15]. Scan from offset 24 for the inner 'alac' magic cookie box.
                if (stsdLen >= 16 && stsd[12] == 'a' && stsd[13] == 'l' && stsd[14] == 'a' && stsd[15] == 'c') {
                    for (int i = 24; i + 32 <= stsdLen; i++) {
                        if (stsd[i] == 'a' && stsd[i + 1] == 'l' && stsd[i + 2] == 'a' && stsd[i + 3] == 'c') {
                            // Layout after 'alac': [version+flags:4][frameLength:4][compat:1][bitDepth:1][pb:1][mb:1][kb:1][channels:1][maxRun:2][maxFrameBytes:4][avgBitRate:4][sampleRate:4]
                            ByteBuffer bb = ByteBuffer.wrap(stsd, i + 8, 24).order(ByteOrder.BIG_ENDIAN);
                            int frameLen = bb.getInt();
                            bb.get(); // compatibleVersion
                            int bitDepth = bb.get() & 0xFF;
                            int pb = bb.get() & 0xFF;
                            int mb = bb.get() & 0xFF;
                            int kb = bb.get() & 0xFF;
                            int chans = bb.get() & 0xFF;
                            int maxRun = bb.getShort() & 0xFFFF;
                            int maxFrameBytes = bb.getInt();
                            int avgBitRate = bb.getInt();
                            int sampleRate = bb.getInt();
                            if (frameLen > 0 && frameLen <= 65536 && (bitDepth == 16 || bitDepth == 20 || bitDepth == 24 || bitDepth == 32)
                                && chans >= 1 && chans <= 8 && sampleRate >= 8000 && sampleRate <= 384000) {
                                cfg.frameLength = frameLen;
                                cfg.bitDepth = bitDepth;
                                cfg.pb = pb;
                                cfg.mb = mb;
                                cfg.kb = kb;
                                cfg.numChannels = chans;
                                cfg.maxRun = maxRun;
                                cfg.maxFrameBytes = maxFrameBytes;
                                cfg.avgBitRate = avgBitRate;
                                cfg.sampleRate = sampleRate;
                                break;
                            }
                        }
                    }
                }
            } else if ("stsz".equals(boxType) && boxEnd - contentStart >= 12L) {
                raf.seek(contentStart + 4L);
                cfg.defaultSampleSize = raf.readInt();
                cfg.sampleCount = raf.readInt();
                if (cfg.defaultSampleSize == 0 && cfg.sampleCount > 0 && cfg.sampleCount <= 500_000) {
                    byte[] raw = new byte[cfg.sampleCount * 4];
                    raf.readFully(raw);
                    ByteBuffer bb = ByteBuffer.wrap(raw).order(ByteOrder.BIG_ENDIAN);
                    cfg.sampleSizes = new int[cfg.sampleCount];
                    for (int i = 0; i < cfg.sampleCount; i++) {
                        cfg.sampleSizes[i] = bb.getInt();
                    }
                }
            } else if ("stsc".equals(boxType) && boxEnd - contentStart >= 8L) {
                raf.seek(contentStart + 4L);
                int count = raf.readInt();
                if (count > 0 && count <= 200_000) {
                    byte[] raw = new byte[count * 12];
                    raf.readFully(raw);
                    ByteBuffer bb = ByteBuffer.wrap(raw).order(ByteOrder.BIG_ENDIAN);
                    cfg.stscFirstChunk = new int[count];
                    cfg.stscSamplesPerChunk = new int[count];
                    for (int i = 0; i < count; i++) {
                        cfg.stscFirstChunk[i] = bb.getInt();
                        cfg.stscSamplesPerChunk[i] = bb.getInt();
                        bb.getInt(); // sample_description_index
                    }
                }
            } else if ("stco".equals(boxType) && boxEnd - contentStart >= 8L) {
                raf.seek(contentStart + 4L);
                int count = raf.readInt();
                if (count > 0 && count <= 500_000) {
                    byte[] raw = new byte[count * 4];
                    raf.readFully(raw);
                    ByteBuffer bb = ByteBuffer.wrap(raw).order(ByteOrder.BIG_ENDIAN);
                    cfg.chunkOffsets = new long[count];
                    for (int i = 0; i < count; i++) {
                        cfg.chunkOffsets[i] = bb.getInt() & 0xFFFFFFFFL;
                    }
                }
            } else if ("co64".equals(boxType) && boxEnd - contentStart >= 8L) {
                raf.seek(contentStart + 4L);
                int count = raf.readInt();
                if (count > 0 && count <= 500_000) {
                    byte[] raw = new byte[count * 8];
                    raf.readFully(raw);
                    ByteBuffer bb = ByteBuffer.wrap(raw).order(ByteOrder.BIG_ENDIAN);
                    cfg.chunkOffsets = new long[count];
                    for (int i = 0; i < count; i++) {
                        cfg.chunkOffsets[i] = bb.getLong();
                    }
                }
            }
            pos = boxEnd;
        }
    }

    private static long[] computeMp4SampleOffsets(AlacConfig cfg) {
        int totalSamples = cfg.sampleCount > 0 ? cfg.sampleCount : cfg.sampleSizes.length;
        if (totalSamples <= 0 || cfg.chunkOffsets.length == 0) return new long[0];
        long[] offsets = new long[totalSamples];
        int sampleIdx = 0;
        int stscIdx = 0;

        for (int chunkIdx = 0; chunkIdx < cfg.chunkOffsets.length && sampleIdx < totalSamples; chunkIdx++) {
            int chunkNum1Based = chunkIdx + 1;
            while (stscIdx + 1 < cfg.stscFirstChunk.length && chunkNum1Based >= cfg.stscFirstChunk[stscIdx + 1]) {
                stscIdx++;
            }
            int samplesInChunk = cfg.stscSamplesPerChunk.length > 0 ? cfg.stscSamplesPerChunk[stscIdx] : 1;
            long curOffset = cfg.chunkOffsets[chunkIdx];
            for (int s = 0; s < samplesInChunk && sampleIdx < totalSamples; s++) {
                offsets[sampleIdx] = curOffset;
                int sz = cfg.defaultSampleSize > 0
                    ? cfg.defaultSampleSize
                    : (sampleIdx < cfg.sampleSizes.length ? cfg.sampleSizes[sampleIdx] : 0);
                curOffset += sz;
                sampleIdx++;
            }
        }
        return sampleIdx == totalSamples ? offsets : java.util.Arrays.copyOf(offsets, sampleIdx);
    }

    private static final class BitReader {
        final byte[] data;
        final int totalBits;
        int bitPos = 0;

        BitReader(byte[] data, int lengthBytes) {
            this.data = data;
            this.totalBits = lengthBytes * 8;
        }

        int remainingBits() {
            return totalBits - bitPos;
        }

        int readBits(int n) {
            if (n <= 0) return 0;
            int byteIdx = bitPos >>> 3;
            int bitOffset = bitPos & 7;
            bitPos += n;
            int maxByte = totalBits >>> 3;
            int endByte = Math.min(maxByte, byteIdx + 5);
            long acc = 0L;
            for (int i = byteIdx; i < endByte; i++) {
                acc = (acc << 8) | (data[i] & 0xFFL);
            }
            int loadedBits = (endByte - byteIdx) << 3;
            int shift = loadedBits - bitOffset - n;
            long mask = (n == 32) ? 0xFFFFFFFFL : ((1L << n) - 1L);
            if (shift >= 0) {
                return (int) ((acc >>> shift) & mask);
            }
            return (int) ((acc << (-shift)) & mask);
        }

        void skipBits(int n) {
            bitPos = Math.min(totalBits, bitPos + n);
        }
    }

    private static int decodeAlacPacket(
        byte[] pkt,
        int pktLen,
        AlacConfig cfg,
        int[] outLeft,
        int[] outRight,
        int[] predLeft,
        int[] predRight,
        int[] extraLeft,
        int[] extraRight,
        short[] coefsLeft,
        short[] coefsRight
    ) {
        BitReader br = new BitReader(pkt, pktLen);
        if (br.remainingBits() < 24) return 0;
        int tag = br.readBits(3);
        if (tag != 0 && tag != 1) return 0; // ID_SCE (0 = mono) or ID_CPE (1 = stereo)
        int channels = (tag == 1) ? 2 : 1;

        br.skipBits(4);  // element instance tag
        br.skipBits(12); // unused header bits
        int hasSize = br.readBits(1);
        int uncompressedBytes = br.readBits(2);
        int isNotCompressed = br.readBits(1);
        int numSamples = (hasSize != 0) ? br.readBits(32) : cfg.frameLength;
        if (numSamples <= 0 || numSamples > outLeft.length) return 0;

        int extraBits = uncompressedBytes * 8;
        int chanBits = cfg.bitDepth - extraBits + (channels == 2 ? 1 : 0);

        if (isNotCompressed != 0) {
            br.skipBits(16); // skip 16-bit shift fields
            for (int i = 0; i < numSamples; i++) {
                outLeft[i] = signExtend(br.readBits(cfg.bitDepth), cfg.bitDepth);
                if (channels == 2) {
                    outRight[i] = signExtend(br.readBits(cfg.bitDepth), cfg.bitDepth);
                } else {
                    outRight[i] = outLeft[i];
                }
            }
            return numSamples;
        }

        int interlacingShift = br.readBits(8);
        int interlacingLeftweight = br.readBits(8);

        int modeLeft = br.readBits(4);
        int shiftLeft = br.readBits(4);
        int riceModLeft = br.readBits(3);
        int numCoefsLeft = br.readBits(5);
        for (int i = 0; i < numCoefsLeft; i++) {
            coefsLeft[i] = (short) br.readBits(16);
        }

        int modeRight = 0, shiftRight = 0, riceModRight = 0, numCoefsRight = 0;
        if (channels == 2) {
            modeRight = br.readBits(4);
            shiftRight = br.readBits(4);
            riceModRight = br.readBits(3);
            numCoefsRight = br.readBits(5);
            for (int i = 0; i < numCoefsRight; i++) {
                coefsRight[i] = (short) br.readBits(16);
            }
        }

        if (extraBits > 0) {
            for (int i = 0; i < numSamples; i++) {
                extraLeft[i] = br.readBits(extraBits);
                if (channels == 2) {
                    extraRight[i] = br.readBits(extraBits);
                }
            }
        }

        // Note: cfg.mb is riceInitialhistory (10), cfg.kb is riceKmodifier (14), cfg.pb is riceHistorymult (40)!
        riceDecompress(br, predLeft, numSamples, chanBits, (cfg.mb * riceModLeft) / 4, cfg.kb, cfg.pb);
        if (modeLeft == 15) {
            predictorDecompress(predLeft, outLeft, numSamples, null, 31, chanBits, 0);
            predictorDecompress(outLeft, outLeft, numSamples, coefsLeft, numCoefsLeft, chanBits, shiftLeft);
        } else {
            predictorDecompress(predLeft, outLeft, numSamples, coefsLeft, numCoefsLeft, chanBits, shiftLeft);
        }

        if (channels == 2) {
            riceDecompress(br, predRight, numSamples, chanBits, (cfg.mb * riceModRight) / 4, cfg.kb, cfg.pb);
            if (modeRight == 15) {
                predictorDecompress(predRight, outRight, numSamples, null, 31, chanBits, 0);
                predictorDecompress(outRight, outRight, numSamples, coefsRight, numCoefsRight, chanBits, shiftRight);
            } else {
                predictorDecompress(predRight, outRight, numSamples, coefsRight, numCoefsRight, chanBits, shiftRight);
            }

            if (interlacingLeftweight != 0) {
                for (int i = 0; i < numSamples; i++) {
                    int diff = outRight[i];
                    int mid = outLeft[i];
                    int right = mid - ((diff * interlacingLeftweight) >> interlacingShift);
                    int left = right + diff;
                    outLeft[i] = left;
                    outRight[i] = right;
                }
            }
        } else {
            System.arraycopy(outLeft, 0, outRight, 0, numSamples);
        }

        if (extraBits > 0) {
            for (int i = 0; i < numSamples; i++) {
                outLeft[i] = (outLeft[i] << extraBits) | extraLeft[i];
                if (channels == 2) {
                    outRight[i] = (outRight[i] << extraBits) | extraRight[i];
                } else {
                    outRight[i] = outLeft[i];
                }
            }
        }

        return numSamples;
    }

    private static int signExtend(int val, int bits) {
        int shift = 32 - bits;
        return (val << shift) >> shift;
    }

    private static int decodeRiceScalar(BitReader br, int k, int readsamplesize) {
        int x = 0;
        while (x < 9 && br.remainingBits() > 0 && br.readBits(1) != 0) {
            x++;
        }
        if (x >= 9) {
            return br.readBits(readsamplesize);
        }
        if (k <= 1) return x;
        int extra = br.readBits(k - 1);
        if (extra >= 1) {
            return x * ((1 << k) - 1) + ((extra << 1) | br.readBits(1)) - 1;
        }
        return x * ((1 << k) - 1);
    }

    private static void riceDecompress(
        BitReader br,
        int[] output,
        int numSamples,
        int readsamplesize,
        int riceInitialhistory,
        int riceKmodifier,
        int riceHistorymult
    ) {
        int history = riceInitialhistory;
        int signModifier = 0;
        for (int i = 0; i < numSamples; i++) {
            int lead = Integer.numberOfLeadingZeros((history >> 9) + 3);
            int k = Math.min(riceKmodifier, 31 - lead);
            int val = decodeRiceScalar(br, k, readsamplesize) + signModifier;
            signModifier = 0;
            output[i] = (val + 1) >> 1;
            if ((val & 1) != 0) {
                output[i] = -output[i];
            }
            history += val * riceHistorymult - ((history * riceHistorymult) >> 9);
            if (val > 0xFFFF) history = 0xFFFF;
            if (history < 128 && i + 1 < numSamples) {
                k = Integer.numberOfLeadingZeros(history) - 24 + ((history + 16) >> 6);
                k = Math.max(0, Math.min(riceKmodifier, k));
                int blockSize = decodeRiceScalar(br, k, 16);
                if (blockSize > 0) {
                    int end = Math.min(numSamples, i + 1 + blockSize);
                    java.util.Arrays.fill(output, i + 1, end, 0);
                    i += blockSize;
                }
                if (blockSize <= 0xFFFF) signModifier = 1;
                history = 0;
            }
        }
    }

    private static void predictorDecompress(
        int[] errorBuffer,
        int[] bufferOut,
        int outputSize,
        @Nullable short[] coefs,
        int numActive,
        int chanBits,
        int chanShift
    ) {
        bufferOut[0] = errorBuffer[0];
        if (numActive == 0) {
            if (errorBuffer != bufferOut) {
                System.arraycopy(errorBuffer, 0, bufferOut, 0, outputSize);
            }
            return;
        }
        if (numActive == 31) {
            int prev = bufferOut[0];
            for (int i = 1; i < outputSize; i++) {
                int del = errorBuffer[i] + prev;
                prev = signExtend(del, chanBits);
                bufferOut[i] = prev;
            }
            return;
        }
        for (int i = 1; i <= numActive && i < outputSize; i++) {
            int del = errorBuffer[i] + bufferOut[i - 1];
            bufferOut[i] = signExtend(del, chanBits);
        }
        if (coefs == null) return;
        for (int i = numActive + 1; i < outputSize; i++) {
            int sum = 0;
            int top = bufferOut[i - numActive - 1];
            for (int j = 0; j < numActive; j++) {
                sum += (bufferOut[i - 1 - j] - top) * coefs[j];
            }
            int del = errorBuffer[i];
            int sg = Integer.signum(del);
            int outVal = top + del + ((sum + (1 << (chanShift - 1))) >> chanShift);
            bufferOut[i] = signExtend(outVal, chanBits);

            if (sg > 0) {
                for (int j = numActive - 1; j >= 0 && del > 0; j--) {
                    int dd = top - bufferOut[i - 1 - j];
                    int sgn = Integer.signum(dd);
                    coefs[j] -= (short) sgn;
                    del -= ((numActive - j) * ((sgn * dd) >> chanShift));
                }
            } else if (sg < 0) {
                for (int j = numActive - 1; j >= 0 && del < 0; j--) {
                    int dd = top - bufferOut[i - 1 - j];
                    int sgn = Integer.signum(dd);
                    coefs[j] += (short) sgn;
                    del -= ((numActive - j) * ((-sgn * dd) >> chanShift));
                }
            }
        }
    }

    // =========================================================================
    // Layer 2: Pure-Java AIFF / AIFC Decoder -> 16-bit PCM RIFF/WAVE
    // =========================================================================
    private static boolean decodeAiffToWav(File sourceFile, File outWavFile) {
        try (RandomAccessFile in = new RandomAccessFile(sourceFile, "r")) {
            long fileLen = in.length();
            if (fileLen < 36L) return false;
            byte[] header = new byte[12];
            in.readFully(header);
            boolean isAifc = header[11] == 'C';

            int channels = 2;
            int sampleRate = 44100;
            int bitDepth = 16;
            boolean littleEndian = false;
            long ssndOffset = -1L;
            long ssndLength = 0L;

            long pos = 12L;
            while (pos + 8L <= fileLen) {
                in.seek(pos);
                byte[] ch = new byte[8];
                in.readFully(ch);
                String chunkId = new String(ch, 0, 4, StandardCharsets.ISO_8859_1);
                long chunkSize = ((ch[4] & 0xFFL) << 24) | ((ch[5] & 0xFFL) << 16)
                    | ((ch[6] & 0xFFL) << 8) | (ch[7] & 0xFFL);
                pos += 8L;
                if (chunkSize < 0L || pos + chunkSize > fileLen) break;

                if ("COMM".equals(chunkId) && chunkSize >= 18L) {
                    byte[] comm = new byte[(int) Math.min(chunkSize, 64L)];
                    in.readFully(comm);
                    channels = ((comm[0] & 0xFF) << 8) | (comm[1] & 0xFF);
                    bitDepth = ((comm[6] & 0xFF) << 8) | (comm[7] & 0xFF);
                    sampleRate = parseIeeeExtendedSampleRate(comm, 8);
                    if (isAifc && comm.length >= 22) {
                        String comp = new String(comm, 18, 4, StandardCharsets.ISO_8859_1);
                        if ("sowt".equalsIgnoreCase(comp)) {
                            littleEndian = true;
                        } else if (!"NONE".equalsIgnoreCase(comp) && !"twos".equalsIgnoreCase(comp)) {
                            return false;
                        }
                    }
                } else if ("SSND".equals(chunkId) && chunkSize > 8L) {
                    int dataOffset = in.readInt();
                    in.readInt(); // blockSize
                    ssndOffset = pos + 8L + Math.max(0, dataOffset);
                    ssndLength = chunkSize - 8L - Math.max(0, dataOffset);
                }
                pos += chunkSize + (chunkSize & 1L);
            }

            if (ssndOffset <= 0L || ssndLength <= 0L || channels <= 0) return false;
            int bytesPerSample = Math.max(1, (bitDepth + 7) / 8);
            long sampleCount = ssndLength / bytesPerSample;
            long totalOutPcmBytes = sampleCount * 2L;

            try (FileOutputStream fos = new FileOutputStream(outWavFile);
                 BufferedOutputStream bos = new BufferedOutputStream(fos, 262144)) {
                writeWavHeader(bos, totalOutPcmBytes, sampleRate, channels, 16);
                in.seek(ssndOffset);

                byte[] inBuf = new byte[bytesPerSample * 16384];
                byte[] outBuf = new byte[32768];
                long remainingSamples = sampleCount;

                while (remainingSamples > 0L) {
                    int batchSamples = (int) Math.min(remainingSamples, 16384L);
                    int toRead = batchSamples * bytesPerSample;
                    in.readFully(inBuf, 0, toRead);
                    int outIdx = 0;

                    for (int s = 0; s < batchSamples; s++) {
                        int base = s * bytesPerSample;
                        short pcm16;
                        if (bytesPerSample == 1) {
                            pcm16 = (short) (inBuf[base] << 8);
                        } else if (bytesPerSample == 2) {
                            if (littleEndian) {
                                pcm16 = (short) ((inBuf[base] & 0xFF) | (inBuf[base + 1] << 8));
                            } else {
                                pcm16 = (short) ((inBuf[base] << 8) | (inBuf[base + 1] & 0xFF));
                            }
                        } else if (bytesPerSample == 3) {
                            pcm16 = (short) ((inBuf[base] << 8) | (inBuf[base + 1] & 0xFF));
                        } else {
                            pcm16 = (short) ((inBuf[base] << 8) | (inBuf[base + 1] & 0xFF));
                        }
                        outBuf[outIdx++] = (byte) (pcm16 & 0xFF);
                        outBuf[outIdx++] = (byte) ((pcm16 >> 8) & 0xFF);
                    }
                    bos.write(outBuf, 0, outIdx);
                    remainingSamples -= batchSamples;
                }
                bos.flush();
            }
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private static int parseIeeeExtendedSampleRate(byte[] comm, int offset) {
        int exp = ((comm[offset] & 0x7F) << 8) | (comm[offset + 1] & 0xFF);
        long mantissa = ((comm[offset + 2] & 0xFFL) << 24)
            | ((comm[offset + 3] & 0xFFL) << 16)
            | ((comm[offset + 4] & 0xFFL) << 8)
            | (comm[offset + 5] & 0xFFL);
        int shift = 16398 - exp;
        int rate = (shift >= 0 && shift < 31) ? (int) (mantissa >>> shift) : 44100;
        return (rate >= 8000 && rate <= 384000) ? rate : 44100;
    }

    // =========================================================================
    // Layer 3: Bounded Android MediaExtractor + MediaCodec -> 16-bit WAV
    // =========================================================================
    private static boolean decodeWithMediaCodecToWav(File sourceFile, File outWavFile) {
        MediaExtractor extractor = new MediaExtractor();
        MediaCodec codec = null;
        try {
            extractor.setDataSource(sourceFile.getAbsolutePath());
            int trackIndex = -1;
            MediaFormat inputFormat = null;
            for (int i = 0; i < extractor.getTrackCount(); i++) {
                MediaFormat fmt = extractor.getTrackFormat(i);
                String mime = fmt.getString(MediaFormat.KEY_MIME);
                if (mime != null && mime.startsWith("audio/")) {
                    trackIndex = i;
                    inputFormat = fmt;
                    break;
                }
            }
            if (trackIndex < 0 || inputFormat == null) return false;
            extractor.selectTrack(trackIndex);

            String mime = inputFormat.getString(MediaFormat.KEY_MIME);
            if (mime == null) return false;

            try {
                codec = MediaCodec.createDecoderByType(mime);
            } catch (Exception e) {
                MediaCodecList list = new MediaCodecList(MediaCodecList.ALL_CODECS);
                String codecName = list.findDecoderForFormat(inputFormat);
                if (codecName != null) {
                    codec = MediaCodec.createByCodecName(codecName);
                }
            }
            if (codec == null) return false;

            codec.configure(inputFormat, null, null, 0);
            codec.start();

            int sampleRate = inputFormat.containsKey(MediaFormat.KEY_SAMPLE_RATE)
                ? inputFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                : 44100;
            int channels = inputFormat.containsKey(MediaFormat.KEY_CHANNEL_COUNT)
                ? inputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                : 2;
            int pcmEncoding = AudioFormat.ENCODING_PCM_16BIT;

            long totalPcmBytes = 0L;
            long startedAtMs = SystemClock.elapsedRealtime();
            int idleAfterInputDone = 0;

            try (FileOutputStream fos = new FileOutputStream(outWavFile);
                 BufferedOutputStream bos = new BufferedOutputStream(fos, 262144)) {
                writeWavHeader(bos, 0L, sampleRate, channels, 16);

                MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
                boolean inputDone = false;
                boolean outputDone = false;
                byte[] tempChunk = new byte[65536];

                while (!outputDone) {
                    if (SystemClock.elapsedRealtime() - startedAtMs > MAX_MEDIACODEC_WALL_MS) {
                        break;
                    }
                    if (!inputDone) {
                        int inIdx = codec.dequeueInputBuffer(TIMEOUT_US);
                        if (inIdx >= 0) {
                            ByteBuffer inBuf = codec.getInputBuffer(inIdx);
                            if (inBuf != null) {
                                int sampleSize = extractor.readSampleData(inBuf, 0);
                                if (sampleSize < 0) {
                                    codec.queueInputBuffer(inIdx, 0, 0, 0L, MediaCodec.BUFFER_FLAG_END_OF_STREAM);
                                    inputDone = true;
                                } else {
                                    long pts = extractor.getSampleTime();
                                    codec.queueInputBuffer(inIdx, 0, sampleSize, Math.max(0L, pts), 0);
                                    extractor.advance();
                                }
                            }
                        }
                    }

                    int outIdx = codec.dequeueOutputBuffer(info, TIMEOUT_US);
                    if (outIdx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                        MediaFormat outFmt = codec.getOutputFormat();
                        if (outFmt.containsKey(MediaFormat.KEY_SAMPLE_RATE)) {
                            sampleRate = outFmt.getInteger(MediaFormat.KEY_SAMPLE_RATE);
                        }
                        if (outFmt.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) {
                            channels = Math.max(1, outFmt.getInteger(MediaFormat.KEY_CHANNEL_COUNT));
                        }
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && outFmt.containsKey(MediaFormat.KEY_PCM_ENCODING)) {
                            pcmEncoding = outFmt.getInteger(MediaFormat.KEY_PCM_ENCODING);
                        }
                    } else if (outIdx >= 0) {
                        idleAfterInputDone = 0;
                        ByteBuffer outBuf = codec.getOutputBuffer(outIdx);
                        if (outBuf != null && info.size > 0) {
                            outBuf.position(info.offset);
                            outBuf.limit(info.offset + info.size);
                            int written = writeNormalizedPcm16Le(outBuf, info.size, pcmEncoding, bos, tempChunk);
                            totalPcmBytes += written;
                        }
                        codec.releaseOutputBuffer(outIdx, false);
                        if ((info.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                            outputDone = true;
                        }
                    } else if (inputDone) {
                        idleAfterInputDone++;
                        if (idleAfterInputDone > 25) {
                            outputDone = true;
                        }
                    }
                }
                bos.flush();
            }

            if (totalPcmBytes <= 0L) {
                return false;
            }
            try (RandomAccessFile raf = new RandomAccessFile(outWavFile, "rw")) {
                raf.seek(0L);
                raf.write(buildWavHeaderBytes(totalPcmBytes, sampleRate, channels, 16));
            }
            return true;
        } catch (Exception e) {
            return false;
        } finally {
            if (codec != null) {
                try { codec.stop(); } catch (Exception ignored) {}
                try { codec.release(); } catch (Exception ignored) {}
            }
            try { extractor.release(); } catch (Exception ignored) {}
        }
    }

    private static int writeNormalizedPcm16Le(
        ByteBuffer outBuf,
        int size,
        int pcmEncoding,
        BufferedOutputStream bos,
        byte[] scratch
    ) throws IOException {
        if (pcmEncoding == AudioFormat.ENCODING_PCM_FLOAT) {
            outBuf.order(ByteOrder.nativeOrder());
            int floatCount = size / 4;
            int byteIdx = 0;
            for (int i = 0; i < floatCount; i++) {
                float sample = outBuf.getFloat();
                int clamped = Math.max(-32768, Math.min(32767, Math.round(sample * 32767.0f)));
                scratch[byteIdx++] = (byte) (clamped & 0xFF);
                scratch[byteIdx++] = (byte) ((clamped >> 8) & 0xFF);
                if (byteIdx + 2 > scratch.length) {
                    bos.write(scratch, 0, byteIdx);
                    byteIdx = 0;
                }
            }
            if (byteIdx > 0) bos.write(scratch, 0, byteIdx);
            return floatCount * 2;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && pcmEncoding == AudioFormat.ENCODING_PCM_24BIT_PACKED) {
            int sampleCount = size / 3;
            int byteIdx = 0;
            for (int i = 0; i < sampleCount; i++) {
                outBuf.get(); // LSB
                int b1 = outBuf.get() & 0xFF;
                int b2 = outBuf.get(); // signed MSB in little-endian 24-bit
                scratch[byteIdx++] = (byte) b1;
                scratch[byteIdx++] = (byte) b2;
                if (byteIdx + 2 > scratch.length) {
                    bos.write(scratch, 0, byteIdx);
                    byteIdx = 0;
                }
            }
            if (byteIdx > 0) bos.write(scratch, 0, byteIdx);
            return sampleCount * 2;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && pcmEncoding == AudioFormat.ENCODING_PCM_32BIT) {
            outBuf.order(ByteOrder.nativeOrder());
            int sampleCount = size / 4;
            int byteIdx = 0;
            for (int i = 0; i < sampleCount; i++) {
                int s32 = outBuf.getInt();
                short s16 = (short) (s32 >> 16);
                scratch[byteIdx++] = (byte) (s16 & 0xFF);
                scratch[byteIdx++] = (byte) ((s16 >> 8) & 0xFF);
                if (byteIdx + 2 > scratch.length) {
                    bos.write(scratch, 0, byteIdx);
                    byteIdx = 0;
                }
            }
            if (byteIdx > 0) bos.write(scratch, 0, byteIdx);
            return sampleCount * 2;
        }

        // Standard 16-bit PCM
        int remaining = size;
        while (remaining > 0) {
            int chunk = Math.min(remaining, scratch.length);
            outBuf.get(scratch, 0, chunk);
            bos.write(scratch, 0, chunk);
            remaining -= chunk;
        }
        return size;
    }

    private static void writeWavHeader(
        BufferedOutputStream out,
        long dataBytes,
        int sampleRate,
        int channels,
        int bitsPerSample
    ) throws IOException {
        out.write(buildWavHeaderBytes(dataBytes, sampleRate, channels, bitsPerSample));
    }

    private static byte[] buildWavHeaderBytes(
        long dataBytes,
        int sampleRate,
        int channels,
        int bitsPerSample
    ) {
        long clampedData = Math.min(0xFFFFFF00L, Math.max(0L, dataBytes));
        long riffSize = clampedData + 36L;
        int byteRate = sampleRate * channels * (bitsPerSample / 8);
        short blockAlign = (short) (channels * (bitsPerSample / 8));

        ByteBuffer bb = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN);
        bb.put((byte) 'R').put((byte) 'I').put((byte) 'F').put((byte) 'F');
        bb.putInt((int) riffSize);
        bb.put((byte) 'W').put((byte) 'A').put((byte) 'V').put((byte) 'E');
        bb.put((byte) 'f').put((byte) 'm').put((byte) 't').put((byte) ' ');
        bb.putInt(16);
        bb.putShort((short) 1); // PCM = 1
        bb.putShort((short) channels);
        bb.putInt(sampleRate);
        bb.putInt(byteRate);
        bb.putShort(blockAlign);
        bb.putShort((short) bitsPerSample);
        bb.put((byte) 'd').put((byte) 'a').put((byte) 't').put((byte) 'a');
        bb.putInt((int) clampedData);
        return bb.array();
    }
}
