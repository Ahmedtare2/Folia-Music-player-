package top.izuna.foliamajor;

import android.content.ContentResolver;
import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.net.Uri;
import androidx.annotation.Nullable;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.channels.FileChannel;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.json.JSONObject;

/**
 * Fast, zero-copy FileChannel tag extractor for embedded synchronized/unsynchronized lyrics
 * (TTML, Enhanced LRC, LRC, QRC/YRC/KRC, and plain text) across MP3 (ID3v2.2/2.3/2.4),
 * FLAC (Vorbis comments), M4A/MP4/ALAC/AAC (iTunes ilst ©lyr and ---- freeform boxes, even when
 * moov is at the end of the file after mdat or after a multi-megabyte cover), OGG/Opus (OggS
 * Vorbis/OpusTags packets), and WAV (RIFF ID3 chunks), backed by a persistent disk cache in
 * context.getFilesDir()/media_cache/lyrics/ so container tags are never parsed twice.
 */
public final class FoliaEmbeddedLyricsExtractor {
    private static final int MAX_LYRIC_TAG_BYTES = 2 * 1024 * 1024; // 2 MiB safety cap per lyric tag
    private static final String EMBEDDED_LYRIC_DISK_CACHE_VERSION = "v1";

    public static final class ExtractedLyrics {
        public final String lyrics;
        @Nullable
        public final String translationLyrics;

        public ExtractedLyrics(String lyrics, @Nullable String translationLyrics) {
            this.lyrics = lyrics;
            this.translationLyrics = translationLyrics;
        }
    }

    private static final class LyricCandidate {
        final String text;
        final boolean isTranslation;
        final int qualityRank; // 4 = TTML, 3 = Enhanced Word LRC, 2 = Timed LRC/VTT, 1 = Plain text

        LyricCandidate(String text, boolean isTranslation, int qualityRank) {
            this.text = text;
            this.isTranslation = isTranslation;
            this.qualityRank = qualityRank;
        }
    }

    private FoliaEmbeddedLyricsExtractor() {}

    @Nullable
    public static ExtractedLyrics extract(ContentResolver resolver, Uri uri) {
        return extract(null, resolver, uri);
    }

    @Nullable
    public static ExtractedLyrics extract(@Nullable Context context, ContentResolver resolver, Uri uri) {
        if (resolver == null || uri == null) return null;
        try (AssetFileDescriptor afd = resolver.openAssetFileDescriptor(uri, "r")) {
            if (afd == null) return null;
            try (FileInputStream fis = new FileInputStream(afd.getFileDescriptor())) {
                FileChannel channel = fis.getChannel();
                if (channel == null) return null;
                long baseOffset = Math.max(0L, afd.getStartOffset());
                long declaredLength = afd.getLength();
                long channelSize = channel.size();
                long totalLength = declaredLength > 0L
                    ? declaredLength
                    : Math.max(0L, channelSize - baseOffset);
                if (totalLength <= 12L) return null;

                File diskCacheFile = resolveEmbeddedLyricCacheFile(context, uri, baseOffset, totalLength);
                if (diskCacheFile != null && diskCacheFile.isFile() && diskCacheFile.length() > 0L) {
                    try {
                        String rawJson = readUtf8File(diskCacheFile);
                        JSONObject cached = new JSONObject(rawJson);
                        if (EMBEDDED_LYRIC_DISK_CACHE_VERSION.equals(cached.optString("v"))) {
                            if (!cached.optBoolean("hasLyrics", false)) {
                                return null;
                            }
                            String cachedLyrics = cached.optString("lyrics", "");
                            String cachedTrans = cached.optString("translationLyrics", "");
                            if (!cachedLyrics.isEmpty()) {
                                return new ExtractedLyrics(
                                    cachedLyrics,
                                    cachedTrans.isEmpty() ? null : cachedTrans
                                );
                            }
                        }
                    } catch (Exception ignored) {
                        // Corrupt cache entry; re-extract below.
                    }
                }

                ExtractedLyrics extracted = extractFromChannel(channel, baseOffset, totalLength);
                if (diskCacheFile != null) {
                    try {
                        JSONObject record = new JSONObject();
                        record.put("v", EMBEDDED_LYRIC_DISK_CACHE_VERSION);
                        record.put("hasLyrics", extracted != null && extracted.lyrics != null && !extracted.lyrics.isEmpty());
                        if (extracted != null && extracted.lyrics != null) {
                            record.put("lyrics", extracted.lyrics);
                            if (extracted.translationLyrics != null) {
                                record.put("translationLyrics", extracted.translationLyrics);
                            }
                        }
                        writeUtf8FileAtomically(diskCacheFile, record.toString());
                    } catch (Exception ignored) {
                        // Ignore cache write errors.
                    }
                }
                return extracted;
            }
        } catch (Exception ignored) {
            return null;
        }
    }

    @Nullable
    private static File resolveEmbeddedLyricCacheFile(@Nullable Context context, Uri uri, long baseOffset, long totalLength) {
        if (context == null) return null;
        try {
            File dir = new File(new File(context.getFilesDir(), "media_cache"), "lyrics");
            if (!dir.exists() && !dir.mkdirs()) return null;
            String rawKey = uri.toString() + "::" + baseOffset + "::" + totalLength;
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(rawKey.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder("raw_embedded_");
            for (byte b : digest) {
                sb.append(String.format(Locale.ROOT, "%02x", b & 0xFF));
            }
            sb.append(".json");
            return new File(dir, sb.toString());
        } catch (Exception ignored) {
            return null;
        }
    }

    private static String readUtf8File(File file) throws IOException {
        try (FileInputStream fis = new FileInputStream(file);
             ByteArrayOutputStream bos = new ByteArrayOutputStream((int) Math.min(file.length(), 65536L))) {
            byte[] buf = new byte[8192];
            int r;
            while ((r = fis.read(buf)) != -1) {
                bos.write(buf, 0, r);
            }
            return new String(bos.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    private static void writeUtf8FileAtomically(File targetFile, String content) throws IOException {
        File parent = targetFile.getParentFile();
        if (parent != null && !parent.exists()) {
            parent.mkdirs();
        }
        File tempFile = new File(parent, targetFile.getName() + ".tmp." + Thread.currentThread().getId());
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        try (FileOutputStream fos = new FileOutputStream(tempFile)) {
            fos.write(bytes);
            fos.getFD().sync();
        }
        if (!tempFile.renameTo(targetFile)) {
            try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                fos.write(bytes);
                fos.getFD().sync();
            } finally {
                tempFile.delete();
            }
        }
    }

    @Nullable
    public static ExtractedLyrics extractFromChannel(FileChannel channel, long baseOffset, long totalLength) throws IOException {
        List<LyricCandidate> candidates = new ArrayList<>();
        byte[] magic = readBytesAt(channel, baseOffset, (int) Math.min(16L, totalLength));
        if (magic == null || magic.length < 4) return null;

        long cursor = 0L;
        if (magic[0] == 'I' && magic[1] == 'D' && magic[2] == '3' && magic.length >= 10) {
            int id3Size = readSynchsafeInt(magic, 6);
            parseId3v2(channel, baseOffset, Math.min(totalLength, 10L + id3Size), candidates);
            cursor = 10L + id3Size;
            if (cursor + 4L < totalLength) {
                byte[] afterId3 = readBytesAt(channel, baseOffset + cursor, 4);
                if (afterId3 != null && afterId3.length == 4
                    && afterId3[0] == 'f' && afterId3[1] == 'L' && afterId3[2] == 'a' && afterId3[3] == 'C') {
                    parseFlac(channel, baseOffset + cursor, totalLength - cursor, candidates);
                }
            }
        } else if (magic[0] == 'f' && magic[1] == 'L' && magic[2] == 'a' && magic[3] == 'C') {
            parseFlac(channel, baseOffset, totalLength, candidates);
        } else if (magic[0] == 'O' && magic[1] == 'g' && magic[2] == 'g' && magic[3] == 'S') {
            parseOgg(channel, baseOffset, totalLength, candidates);
        } else if (magic[0] == 'R' && magic[1] == 'I' && magic[2] == 'F' && magic[3] == 'F' && magic.length >= 12
            && magic[8] == 'W' && magic[9] == 'A' && magic[10] == 'V' && magic[11] == 'E') {
            parseWavRiff(channel, baseOffset, totalLength, candidates);
        } else if (magic.length >= 8 && isMp4TopLevelAtom(magic, 4)) {
            parseMp4Boxes(channel, baseOffset, 0L, totalLength, 0, candidates);
        }

        return selectBestCandidates(candidates);
    }

    private static boolean isMp4TopLevelAtom(byte[] buf, int offset) {
        if (offset + 4 > buf.length) return false;
        String type = new String(buf, offset, 4, StandardCharsets.ISO_8859_1);
        return "ftyp".equals(type) || "moov".equals(type) || "mdat".equals(type)
            || "free".equals(type) || "wide".equals(type) || "skip".equals(type) || "udta".equals(type);
    }

    @Nullable
    private static ExtractedLyrics selectBestCandidates(List<LyricCandidate> candidates) {
        if (candidates.isEmpty()) return null;
        LyricCandidate bestMain = null;
        LyricCandidate bestTrans = null;

        for (LyricCandidate c : candidates) {
            if (!c.isTranslation) {
                if (bestMain == null || c.qualityRank > bestMain.qualityRank) {
                    bestMain = c;
                }
            } else {
                if (bestTrans == null || c.qualityRank > bestTrans.qualityRank) {
                    bestTrans = c;
                }
            }
        }
        if (bestMain == null) {
            bestMain = bestTrans;
            bestTrans = null;
        }
        if (bestMain == null) return null;
        String transText = (bestTrans != null && !bestTrans.text.equals(bestMain.text))
            ? bestTrans.text
            : null;
        return new ExtractedLyrics(bestMain.text, transText);
    }

    private static void addCandidate(List<LyricCandidate> list, @Nullable String rawText, boolean isTranslation) {
        if (rawText == null) return;
        String cleaned = rawText.replace("\uFEFF", "").replace("\u0000", "").replace("\r\n", "\n").replace("\r", "\n").trim();
        if (cleaned.isEmpty()) return;
        int rank = computeLyricQualityRank(cleaned);
        for (LyricCandidate existing : list) {
            if (existing.text.equals(cleaned)) return;
        }
        list.add(new LyricCandidate(cleaned, isTranslation, rank));
    }

    private static int computeLyricQualityRank(String text) {
        String lower = text.toLowerCase(Locale.ROOT);
        if (lower.contains("<tt") && (lower.contains("<p") || lower.contains("<body") || lower.contains("<div") || lower.contains("begin="))) {
            return 4; // TTML (word or line synchronized XML)
        }
        if (text.matches("(?s).*<\\d{1,2}:\\d{2}[.:]\\d{2,3}>.*")
            || text.matches("(?s).*\\[\\d{1,2}:\\d{2}[.:]\\d{2,3}\\][^\\[\\]\\n]+\\[\\d{1,2}:\\d{2}[.:]\\d{2,3}\\].*")) {
            return 3; // Enhanced word-by-word LRC
        }
        if (text.matches("(?s).*\\[\\d{1,2}:\\d{2}(?:[.:]\\d{1,3})?\\].*")
            || lower.startsWith("webvtt")
            || text.contains("-->")) {
            return 2; // Standard timed LRC / VTT
        }
        return 1; // Unsynchronized / other text
    }

    private static boolean isTranslationDescriptor(@Nullable String lang, @Nullable String desc) {
        if (lang != null) {
            String l = lang.toLowerCase(Locale.ROOT);
            if ("chi".equals(l) || "zho".equals(l)) return true;
        }
        if (desc != null) {
            String d = desc.toLowerCase(Locale.ROOT);
            return d.contains("trans") || d.contains("译");
        }
        return false;
    }

    // =========================================================================
    // 1. MP3 / ID3v2 (v2.2, v2.3, v2.4)
    // =========================================================================
    private static void parseId3v2(FileChannel channel, long baseOffset, long tagLimit, List<LyricCandidate> out) throws IOException {
        byte[] header = readBytesAt(channel, baseOffset, 10);
        if (header == null || header.length < 10) return;
        int versionMajor = header[3] & 0xFF;
        int flags = header[5] & 0xFF;
        long pos = 10L;

        if ((flags & 0x40) != 0 && (versionMajor == 3 || versionMajor == 4)) {
            byte[] ext = readBytesAt(channel, baseOffset + pos, 4);
            if (ext != null && ext.length == 4) {
                int extSize = versionMajor == 4 ? readSynchsafeInt(ext, 0) : readBigEndianInt(ext, 0);
                if (extSize > 0 && pos + extSize < tagLimit) {
                    pos += extSize;
                }
            }
        }

        int frameHeaderLen = (versionMajor == 2) ? 6 : 10;
        while (pos + frameHeaderLen <= tagLimit) {
            byte[] fh = readBytesAt(channel, baseOffset + pos, frameHeaderLen);
            if (fh == null || fh.length < frameHeaderLen || fh[0] == 0) break;

            String frameId;
            int frameSize;
            int frameFlags = 0;
            if (versionMajor == 2) {
                frameId = new String(fh, 0, 3, StandardCharsets.ISO_8859_1);
                frameSize = ((fh[3] & 0xFF) << 16) | ((fh[4] & 0xFF) << 8) | (fh[5] & 0xFF);
            } else {
                frameId = new String(fh, 0, 4, StandardCharsets.ISO_8859_1);
                if (versionMajor == 4) {
                    int synchSize = readSynchsafeInt(fh, 4);
                    int rawSize = readBigEndianInt(fh, 4);
                    frameSize = (synchSize > 0 && pos + 10L + synchSize <= tagLimit) ? synchSize : rawSize;
                } else {
                    frameSize = readBigEndianInt(fh, 4);
                }
                frameFlags = ((fh[8] & 0xFF) << 8) | (fh[9] & 0xFF);
            }

            if (frameSize <= 0 || pos + frameHeaderLen + frameSize > tagLimit) {
                break;
            }

            long payloadOffset = baseOffset + pos + frameHeaderLen;
            if ("USLT".equals(frameId) || "ULT".equals(frameId)) {
                if (frameSize <= MAX_LYRIC_TAG_BYTES) {
                    byte[] payload = readBytesAt(channel, payloadOffset, frameSize);
                    if (payload != null) {
                        payload = stripId3UnsyncAndDataLen(payload, versionMajor, flags, frameFlags);
                        parseUsltPayload(payload, out);
                    }
                }
            } else if ("TXXX".equals(frameId) || "TXX".equals(frameId)) {
                if (frameSize <= MAX_LYRIC_TAG_BYTES) {
                    byte[] payload = readBytesAt(channel, payloadOffset, frameSize);
                    if (payload != null) {
                        payload = stripId3UnsyncAndDataLen(payload, versionMajor, flags, frameFlags);
                        parseTxxxPayload(payload, out);
                    }
                }
            }

            pos += frameHeaderLen + (long) frameSize;
        }
    }

    private static byte[] stripId3UnsyncAndDataLen(byte[] data, int versionMajor, int tagFlags, int frameFlags) {
        int start = 0;
        boolean hasDataLen = (versionMajor == 4 && (frameFlags & 0x0001) != 0)
            || (versionMajor == 3 && (frameFlags & 0x0080) != 0);
        if (hasDataLen && data.length >= 4) {
            start = 4;
        }
        boolean unsync = ((tagFlags & 0x80) != 0)
            || (versionMajor == 4 && (frameFlags & 0x0002) != 0);
        if (!unsync && start == 0) return data;

        ByteArrayOutputStream bos = new ByteArrayOutputStream(data.length - start);
        for (int i = start; i < data.length; i++) {
            int b = data[i] & 0xFF;
            bos.write(b);
            if (unsync && b == 0xFF && i + 1 < data.length && data[i + 1] == 0x00) {
                i++;
            }
        }
        return bos.toByteArray();
    }

    private static void parseUsltPayload(byte[] payload, List<LyricCandidate> out) {
        if (payload.length < 5) return;
        int encoding = payload[0] & 0xFF;
        String lang = new String(payload, 1, 3, StandardCharsets.ISO_8859_1);
        int descStart = 4;
        int descEnd = findId3StringTerminator(payload, descStart, encoding);
        int textStart = advancePastId3Terminator(payload, descEnd, encoding);
        if (textStart >= payload.length) return;
        String desc = decodeId3String(payload, descStart, descEnd - descStart, encoding);
        String lyricText = decodeId3String(payload, textStart, payload.length - textStart, encoding);
        addCandidate(out, lyricText, isTranslationDescriptor(lang, desc));
    }

    private static void parseTxxxPayload(byte[] payload, List<LyricCandidate> out) {
        if (payload.length < 3) return;
        int encoding = payload[0] & 0xFF;
        int descStart = 1;
        int descEnd = findId3StringTerminator(payload, descStart, encoding);
        int textStart = advancePastId3Terminator(payload, descEnd, encoding);
        if (textStart >= payload.length) return;
        String desc = decodeId3String(payload, descStart, descEnd - descStart, encoding);
        String lowerDesc = desc.trim().toLowerCase(Locale.ROOT);
        if (lowerDesc.contains("lyric") || lowerDesc.contains("ttml") || lowerDesc.contains("uslt") || lowerDesc.contains("sylt") || lowerDesc.equals("lrc")) {
            String lyricText = decodeId3String(payload, textStart, payload.length - textStart, encoding);
            addCandidate(out, lyricText, isTranslationDescriptor(null, lowerDesc));
        }
    }

    private static int findId3StringTerminator(byte[] buf, int start, int encoding) {
        if (encoding == 1 || encoding == 2) {
            for (int i = start; i + 1 < buf.length; i += 2) {
                if (buf[i] == 0 && buf[i + 1] == 0) return i;
            }
            return buf.length;
        }
        for (int i = start; i < buf.length; i++) {
            if (buf[i] == 0) return i;
        }
        return buf.length;
    }

    private static int advancePastId3Terminator(byte[] buf, int termPos, int encoding) {
        if (encoding == 1 || encoding == 2) {
            return Math.min(buf.length, termPos + 2);
        }
        return Math.min(buf.length, termPos + 1);
    }

    private static String decodeId3String(byte[] buf, int offset, int length, int encoding) {
        if (length <= 0 || offset >= buf.length) return "";
        int safeLen = Math.min(length, buf.length - offset);
        if (encoding == 3) {
            return new String(buf, offset, safeLen, StandardCharsets.UTF_8);
        }
        if (encoding == 2) {
            return new String(buf, offset, safeLen, StandardCharsets.UTF_16BE);
        }
        if (encoding == 1) {
            if (safeLen >= 2) {
                int b0 = buf[offset] & 0xFF;
                int b1 = buf[offset + 1] & 0xFF;
                if (b0 == 0xFF && b1 == 0xFE) {
                    return new String(buf, offset + 2, safeLen - 2, StandardCharsets.UTF_16LE);
                }
                if (b0 == 0xFE && b1 == 0xFF) {
                    return new String(buf, offset + 2, safeLen - 2, StandardCharsets.UTF_16BE);
                }
            }
            return new String(buf, offset, safeLen, StandardCharsets.UTF_16LE);
        }
        if (isValidUtf8(buf, offset, safeLen)) {
            return new String(buf, offset, safeLen, StandardCharsets.UTF_8);
        }
        return new String(buf, offset, safeLen, StandardCharsets.ISO_8859_1);
    }

    private static boolean isValidUtf8(byte[] buf, int offset, int length) {
        int end = offset + length;
        int i = offset;
        while (i < end) {
            int b = buf[i] & 0xFF;
            if (b < 0x80) {
                i++;
                continue;
            }
            int extraBytes;
            if ((b & 0xE0) == 0xC0) extraBytes = 1;
            else if ((b & 0xF0) == 0xE0) extraBytes = 2;
            else if ((b & 0xF8) == 0xF0) extraBytes = 3;
            else return false;
            if (i + extraBytes >= end) return false;
            for (int j = 1; j <= extraBytes; j++) {
                if ((buf[i + j] & 0xC0) != 0x80) return false;
            }
            i += 1 + extraBytes;
        }
        return true;
    }

    // =========================================================================
    // 2. FLAC (Vorbis Comments, skipping PICTURE blocks in O(1))
    // =========================================================================
    private static void parseFlac(FileChannel channel, long baseOffset, long totalLength, List<LyricCandidate> out) throws IOException {
        long pos = 4L;
        while (pos + 4L <= totalLength) {
            byte[] bh = readBytesAt(channel, baseOffset + pos, 4);
            if (bh == null || bh.length < 4) break;
            boolean isLast = (bh[0] & 0x80) != 0;
            int blockType = bh[0] & 0x7F;
            int blockLen = ((bh[1] & 0xFF) << 16) | ((bh[2] & 0xFF) << 8) | (bh[3] & 0xFF);
            pos += 4L;
            if (blockLen < 0 || pos + blockLen > totalLength) break;

            if (blockType == 4 && blockLen > 8 && blockLen <= MAX_LYRIC_TAG_BYTES * 2) {
                byte[] commentBlock = readBytesAt(channel, baseOffset + pos, blockLen);
                if (commentBlock != null) {
                    parseVorbisCommentBlock(commentBlock, 0, commentBlock.length, out);
                }
            }
            pos += blockLen;
            if (isLast) break;
        }
    }

    private static void parseVorbisCommentBlock(byte[] buf, int offset, int length, List<LyricCandidate> out) {
        int end = offset + length;
        if (offset + 8 > end) return;
        ByteBuffer bb = ByteBuffer.wrap(buf, offset, length).order(ByteOrder.LITTLE_ENDIAN);
        int vendorLen = bb.getInt();
        if (vendorLen < 0 || bb.position() + vendorLen + 4 > end) return;
        bb.position(bb.position() + vendorLen);
        int commentCount = bb.getInt();
        if (commentCount < 0 || commentCount > 4096) return;

        for (int i = 0; i < commentCount && bb.remaining() >= 4; i++) {
            int cLen = bb.getInt();
            if (cLen <= 0 || cLen > bb.remaining()) break;
            int cPos = bb.position();
            bb.position(cPos + cLen);
            if (cLen > MAX_LYRIC_TAG_BYTES) continue;

            int eqIdx = -1;
            int searchMax = Math.min(cPos + 64, cPos + cLen);
            for (int k = cPos; k < searchMax; k++) {
                if (buf[k] == '=') {
                    eqIdx = k;
                    break;
                }
            }
            if (eqIdx <= cPos) continue;
            String key = new String(buf, cPos, eqIdx - cPos, StandardCharsets.US_ASCII).trim().toLowerCase(Locale.ROOT);
            if (key.contains("lyric") || key.equals("ttml") || key.equals("uslt") || key.equals("lrc")) {
                String val = new String(buf, eqIdx + 1, (cPos + cLen) - (eqIdx + 1), StandardCharsets.UTF_8);
                addCandidate(out, val, isTranslationDescriptor(null, key));
            }
        }
    }

    // =========================================================================
    // 3. M4A / MP4 / ALAC / AAC (moov -> udta -> meta -> ilst -> ©lyr & ----)
    // =========================================================================
    private static void parseMp4Boxes(
        FileChannel channel,
        long baseOffset,
        long startRel,
        long endRel,
        int depth,
        List<LyricCandidate> out
    ) throws IOException {
        if (depth > 8) return;
        long pos = startRel;
        while (pos + 8L <= endRel) {
            byte[] header = readBytesAt(channel, baseOffset + pos, (int) Math.min(16L, endRel - pos));
            if (header == null || header.length < 8) break;

            long boxSize = readBigEndianInt(header, 0) & 0xFFFFFFFFL;
            int type0 = header[4] & 0xFF;
            int type1 = header[5] & 0xFF;
            int type2 = header[6] & 0xFF;
            int type3 = header[7] & 0xFF;
            String boxType = new String(header, 4, 4, StandardCharsets.ISO_8859_1);

            long headerLen = 8L;
            if (boxSize == 1L) {
                if (header.length < 16) break;
                boxSize = readBigEndianLong(header, 8);
                headerLen = 16L;
            } else if (boxSize == 0L) {
                boxSize = endRel - pos;
            }

            if (boxSize < headerLen || pos + boxSize > endRel) {
                break;
            }

            long boxContentStart = pos + headerLen;
            long boxEnd = pos + boxSize;

            if ("moov".equals(boxType) || "udta".equals(boxType) || "ilst".equals(boxType)) {
                parseMp4Boxes(channel, baseOffset, boxContentStart, boxEnd, depth + 1, out);
            } else if ("meta".equals(boxType)) {
                long childStart = boxContentStart + 4L;
                if (childStart + 8L <= boxEnd) {
                    byte[] probe = readBytesAt(channel, baseOffset + childStart, 8);
                    if (probe != null && probe.length == 8) {
                        String childType = new String(probe, 4, 4, StandardCharsets.ISO_8859_1);
                        if ("hdlr".equals(childType) || "ilst".equals(childType) || "keys".equals(childType) || "free".equals(childType)) {
                            parseMp4Boxes(channel, baseOffset, childStart, boxEnd, depth + 1, out);
                        } else {
                            parseMp4Boxes(channel, baseOffset, boxContentStart, boxEnd, depth + 1, out);
                        }
                    }
                }
            } else if ((type0 == 0xA9 && type1 == 'l' && type2 == 'y' && type3 == 'r')
                || "lyr ".equalsIgnoreCase(boxType)
                || "ttml".equalsIgnoreCase(boxType)) {
                extractMp4IlstDataBox(channel, baseOffset, boxContentStart, boxEnd, false, out);
            } else if ("----".equals(boxType)) {
                extractMp4FreeformBox(channel, baseOffset, boxContentStart, boxEnd, out);
            }

            pos = boxEnd;
        }
    }

    private static void extractMp4IlstDataBox(
        FileChannel channel,
        long baseOffset,
        long startRel,
        long endRel,
        boolean isTranslation,
        List<LyricCandidate> out
    ) throws IOException {
        long pos = startRel;
        while (pos + 16L <= endRel) {
            byte[] dh = readBytesAt(channel, baseOffset + pos, 16);
            if (dh == null || dh.length < 16) break;
            long dSize = readBigEndianInt(dh, 0) & 0xFFFFFFFFL;
            String dType = new String(dh, 4, 4, StandardCharsets.ISO_8859_1);
            if (dSize < 16L || pos + dSize > endRel) break;

            if ("data".equals(dType)) {
                int payloadLen = (int) Math.min(dSize - 16L, (long) MAX_LYRIC_TAG_BYTES);
                if (payloadLen > 0) {
                    byte[] payload = readBytesAt(channel, baseOffset + pos + 16L, payloadLen);
                    if (payload != null) {
                        int typeIndicator = readBigEndianInt(dh, 8);
                        Charset cs = (typeIndicator == 2) ? StandardCharsets.UTF_16BE : StandardCharsets.UTF_8;
                        String text = decodeId3String(payload, 0, payload.length, cs == StandardCharsets.UTF_16BE ? 2 : 3);
                        addCandidate(out, text, isTranslation);
                    }
                }
            }
            pos += dSize;
        }
    }

    private static void extractMp4FreeformBox(
        FileChannel channel,
        long baseOffset,
        long startRel,
        long endRel,
        List<LyricCandidate> out
    ) throws IOException {
        long pos = startRel;
        String atomName = "";
        while (pos + 12L <= endRel) {
            byte[] bh = readBytesAt(channel, baseOffset + pos, 16);
            if (bh == null || bh.length < 12) break;
            long bSize = readBigEndianInt(bh, 0) & 0xFFFFFFFFL;
            String bType = new String(bh, 4, 4, StandardCharsets.ISO_8859_1);
            if (bSize < 12L || pos + bSize > endRel) break;

            if ("name".equals(bType) && bSize > 12L && bSize <= 256L) {
                byte[] nameBytes = readBytesAt(channel, baseOffset + pos + 12L, (int) (bSize - 12L));
                if (nameBytes != null) {
                    atomName = new String(nameBytes, StandardCharsets.UTF_8).trim().toLowerCase(Locale.ROOT);
                }
            } else if ("data".equals(bType) && bSize > 16L) {
                if (atomName.contains("lyric") || atomName.contains("ttml") || atomName.contains("lrc") || atomName.contains("uslt")) {
                    int payloadLen = (int) Math.min(bSize - 16L, (long) MAX_LYRIC_TAG_BYTES);
                    byte[] payload = readBytesAt(channel, baseOffset + pos + 16L, payloadLen);
                    if (payload != null) {
                        String text = decodeId3String(payload, 0, payload.length, 3);
                        addCandidate(out, text, isTranslationDescriptor(null, atomName));
                    }
                }
            }
            pos += bSize;
        }
    }

    // =========================================================================
    // 4. OGG / Opus (OggS pages containing Vorbis or OpusTags comments)
    // =========================================================================
    private static void parseOgg(FileChannel channel, long baseOffset, long totalLength, List<LyricCandidate> out) throws IOException {
        long maxScan = Math.min(totalLength, 512L * 1024L);
        byte[] chunk = readBytesAt(channel, baseOffset, (int) maxScan);
        if (chunk == null || chunk.length < 36) return;

        ByteArrayOutputStream packetOut = new ByteArrayOutputStream(16384);
        int pos = 0;
        int pageCount = 0;
        while (pos + 27 <= chunk.length && pageCount < 32) {
            if (chunk[pos] != 'O' || chunk[pos + 1] != 'g' || chunk[pos + 2] != 'g' || chunk[pos + 3] != 'S') {
                break;
            }
            int numSegments = chunk[pos + 26] & 0xFF;
            if (pos + 27 + numSegments > chunk.length) break;
            int dataOffset = pos + 27 + numSegments;
            for (int s = 0; s < numSegments; s++) {
                int segLen = chunk[pos + 27 + s] & 0xFF;
                if (dataOffset + segLen > chunk.length) return;
                packetOut.write(chunk, dataOffset, segLen);
                dataOffset += segLen;
                if (segLen < 255) {
                    byte[] pkt = packetOut.toByteArray();
                    packetOut.reset();
                    if (pkt.length > 16) {
                        if (pkt[0] == 3 && pkt[1] == 'v' && pkt[2] == 'o' && pkt[3] == 'r' && pkt[4] == 'b' && pkt[5] == 'i' && pkt[6] == 's') {
                            parseVorbisCommentBlock(pkt, 7, pkt.length - 7, out);
                            return;
                        }
                        if (pkt[0] == 'O' && pkt[1] == 'p' && pkt[2] == 'u' && pkt[3] == 's'
                            && pkt[4] == 'T' && pkt[5] == 'a' && pkt[6] == 'g' && pkt[7] == 's') {
                            parseVorbisCommentBlock(pkt, 8, pkt.length - 8, out);
                            return;
                        }
                    }
                }
            }
            pos = dataOffset;
            pageCount++;
        }
    }

    // =========================================================================
    // 5. WAV (RIFF 'ID3 ' or 'id3 ' chunk)
    // =========================================================================
    private static void parseWavRiff(FileChannel channel, long baseOffset, long totalLength, List<LyricCandidate> out) throws IOException {
        long pos = 12L;
        while (pos + 8L <= totalLength) {
            byte[] ch = readBytesAt(channel, baseOffset + pos, 8);
            if (ch == null || ch.length < 8) break;
            String chunkId = new String(ch, 0, 4, StandardCharsets.ISO_8859_1);
            long chunkSize = ((ch[4] & 0xFFL))
                | ((ch[5] & 0xFFL) << 8)
                | ((ch[6] & 0xFFL) << 16)
                | ((ch[7] & 0xFFL) << 24);
            pos += 8L;
            if (chunkSize < 0 || pos + chunkSize > totalLength) break;
            if ("ID3 ".equalsIgnoreCase(chunkId) && chunkSize > 10L) {
                parseId3v2(channel, baseOffset + pos, chunkSize, out);
                return;
            }
            pos += chunkSize + (chunkSize & 1L);
        }
    }

    @Nullable
    private static byte[] readBytesAt(FileChannel channel, long position, int length) throws IOException {
        if (length <= 0) return null;
        byte[] buf = new byte[length];
        ByteBuffer bb = ByteBuffer.wrap(buf);
        long currentPos = position;
        while (bb.hasRemaining()) {
            int read = channel.read(bb, currentPos);
            if (read <= 0) break;
            currentPos += read;
        }
        if (bb.position() == 0) return null;
        if (bb.position() < length) {
            byte[] trimmed = new byte[bb.position()];
            System.arraycopy(buf, 0, trimmed, 0, bb.position());
            return trimmed;
        }
        return buf;
    }

    private static int readSynchsafeInt(byte[] b, int offset) {
        return ((b[offset] & 0x7F) << 21)
            | ((b[offset + 1] & 0x7F) << 14)
            | ((b[offset + 2] & 0x7F) << 7)
            | (b[offset + 3] & 0x7F);
    }

    private static int readBigEndianInt(byte[] b, int offset) {
        return ((b[offset] & 0xFF) << 24)
            | ((b[offset + 1] & 0xFF) << 16)
            | ((b[offset + 2] & 0xFF) << 8)
            | (b[offset + 3] & 0xFF);
    }

    private static long readBigEndianLong(byte[] b, int offset) {
        return ((long) (b[offset] & 0xFF) << 56)
            | ((long) (b[offset + 1] & 0xFF) << 48)
            | ((long) (b[offset + 2] & 0xFF) << 40)
            | ((long) (b[offset + 3] & 0xFF) << 32)
            | ((long) (b[offset + 4] & 0xFF) << 24)
            | ((long) (b[offset + 5] & 0xFF) << 16)
            | ((long) (b[offset + 6] & 0xFF) << 8)
            | ((long) (b[offset + 7] & 0xFF));
    }
}
