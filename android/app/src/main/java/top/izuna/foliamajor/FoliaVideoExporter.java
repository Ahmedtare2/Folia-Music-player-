package top.izuna.foliamajor;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaMuxer;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.List;

/**
 * One video export in progress: takes Annex B H.264 / HEVC chunks produced by the WebView's WebCodecs encoder, muxes
 * them into an MP4 together with an AAC track made from the song file, and saves the result to Movies/Folia.
 * All calls for one export must come from one thread at a time (the plugin uses a single export executor).
 */
final class FoliaVideoExporter {
    private static final class AudioSample {
        final byte[] data;
        final long ptsUs;

        AudioSample(byte[] data, long ptsUs) {
            this.data = data;
            this.ptsUs = ptsUs;
        }
    }

    private final Context context;
    private final File tempFile;
    private final String mime;
    private final int width;
    private final int height;
    private final int fps;
    private final boolean hevc;
    private MediaMuxer muxer;
    private int videoTrack = -1;
    private int audioTrack = -1;
    private boolean started = false;
    private boolean finished = false;
    private MediaFormat audioFormat;
    private final List<AudioSample> audioSamples = new ArrayList<>();
    private int audioCursor = 0;
    private String audioError = null;

    FoliaVideoExporter(Context context, String mime, int width, int height, int fps) throws IOException {
        this.context = context;
        this.mime = mime;
        this.width = width;
        this.height = height;
        this.fps = fps;
        this.hevc = "video/hevc".equals(mime);
        this.tempFile = File.createTempFile("folia_export_", ".mp4", context.getCacheDir());
    }

    String getAudioError() {
        return audioError;
    }

    int getAudioSampleCount() {
        return audioSamples.size();
    }

    // ---------------------------------------------------------------- audio: file -> PCM -> AAC, kept in memory

    /** Decodes [startUs, startUs + durationUs) of the song and encodes it as AAC. On any failure the video is made without sound. */
    void prepareAudio(Uri uri, long startUs, long durationUs) {
        MediaExtractor extractor = new MediaExtractor();
        MediaCodec decoder = null;
        MediaCodec encoder = null;
        try {
            extractor.setDataSource(context, uri, null);
            int track = -1;
            MediaFormat inFormat = null;
            for (int i = 0; i < extractor.getTrackCount(); i++) {
                MediaFormat f = extractor.getTrackFormat(i);
                String m = f.getString(MediaFormat.KEY_MIME);
                if (m != null && m.startsWith("audio/")) {
                    track = i;
                    inFormat = f;
                    break;
                }
            }
            if (track < 0 || inFormat == null) throw new IOException("no audio track in the song file");
            extractor.selectTrack(track);
            if (startUs > 0) extractor.seekTo(startUs, MediaExtractor.SEEK_TO_PREVIOUS_SYNC);

            decoder = MediaCodec.createDecoderByType(inFormat.getString(MediaFormat.KEY_MIME));
            decoder.configure(inFormat, null, null, 0);
            decoder.start();

            MediaCodec.BufferInfo decInfo = new MediaCodec.BufferInfo();
            MediaCodec.BufferInfo encInfo = new MediaCodec.BufferInfo();
            long limitUs = startUs + durationUs + 1_000_000L;
            boolean inputDone = false;
            boolean decoderDone = false;
            boolean encoderEosSent = false;
            boolean encoderDone = false;
            int sampleRate = 0;
            int channels = 0;
            long targetBytes = Long.MAX_VALUE;
            long fedBytes = 0;
            byte[] pending = null;
            int pendingPos = 0;
            long deadline = System.currentTimeMillis() + 10 * 60 * 1000L;

            while (!encoderDone) {
                if (System.currentTimeMillis() > deadline) throw new IOException("audio preparation took too long");

                // 1. compressed audio into the decoder
                if (!inputDone) {
                    int idx = decoder.dequeueInputBuffer(5000);
                    if (idx >= 0) {
                        ByteBuffer buf = decoder.getInputBuffer(idx);
                        int size = buf == null ? -1 : extractor.readSampleData(buf, 0);
                        long t = size < 0 ? -1 : extractor.getSampleTime();
                        if (size < 0 || t > limitUs) {
                            decoder.queueInputBuffer(idx, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM);
                            inputDone = true;
                        } else {
                            decoder.queueInputBuffer(idx, 0, size, t, 0);
                            extractor.advance();
                        }
                    }
                }

                // 2. PCM out of the decoder (only when the previous PCM has been handed to the encoder)
                if (!decoderDone && pending == null) {
                    int out = decoder.dequeueOutputBuffer(decInfo, 5000);
                    if (out >= 0) {
                        if (encoder == null) {
                            MediaFormat of = decoder.getOutputFormat();
                            sampleRate = of.getInteger(MediaFormat.KEY_SAMPLE_RATE);
                            channels = of.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
                            if (channels < 1 || channels > 2) throw new IOException("unsupported channel count " + channels);
                            MediaFormat ef = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, sampleRate, channels);
                            ef.setInteger(MediaFormat.KEY_AAC_PROFILE, android.media.MediaCodecInfo.CodecProfileLevel.AACObjectLC);
                            ef.setInteger(MediaFormat.KEY_BIT_RATE, 192000);
                            ef.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16384);
                            encoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC);
                            encoder.configure(ef, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE);
                            encoder.start();
                            targetBytes = (durationUs * (long) sampleRate / 1_000_000L) * 2L * channels;
                        }
                        ByteBuffer ob = decoder.getOutputBuffer(out);
                        if (ob != null && decInfo.size > 0) {
                            int frameBytes = 2 * channels;
                            int size = decInfo.size - (decInfo.size % frameBytes);
                            long bufStartUs = decInfo.presentationTimeUs;
                            long bufEndUs = bufStartUs + (size / frameBytes) * 1_000_000L / sampleRate;
                            int skip = 0;
                            if (bufEndUs <= startUs) {
                                size = 0;
                            } else if (bufStartUs < startUs) {
                                long skipFrames = (startUs - bufStartUs) * (long) sampleRate / 1_000_000L;
                                skip = (int) Math.min((long) size, skipFrames * frameBytes);
                            }
                            int keep = size - skip;
                            if (keep > 0) {
                                if (fedBytes + keep > targetBytes) {
                                    keep = (int) (targetBytes - fedBytes);
                                    keep -= keep % frameBytes;
                                    inputDone = true;
                                    decoderDone = true;
                                }
                                if (keep > 0) {
                                    byte[] pcm = new byte[keep];
                                    ob.position(decInfo.offset + skip);
                                    ob.limit(decInfo.offset + skip + keep);
                                    ob.get(pcm);
                                    pending = pcm;
                                    pendingPos = 0;
                                }
                            }
                        }
                        decoder.releaseOutputBuffer(out, false);
                        if ((decInfo.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) decoderDone = true;
                    }
                }

                // 3. PCM into the encoder
                if (encoder != null && pending != null) {
                    int ei = encoder.dequeueInputBuffer(5000);
                    if (ei >= 0) {
                        ByteBuffer eb = encoder.getInputBuffer(ei);
                        eb.clear();
                        int frameBytes = 2 * channels;
                        int n = Math.min(eb.remaining(), pending.length - pendingPos);
                        n -= n % frameBytes;
                        eb.put(pending, pendingPos, n);
                        long pts = fedBytes * 1_000_000L / ((long) sampleRate * frameBytes);
                        encoder.queueInputBuffer(ei, 0, n, pts, 0);
                        fedBytes += n;
                        pendingPos += n;
                        if (pendingPos >= pending.length) pending = null;
                    }
                } else if (encoder != null && decoderDone && pending == null && !encoderEosSent) {
                    int ei = encoder.dequeueInputBuffer(5000);
                    if (ei >= 0) {
                        long pts = fedBytes * 1_000_000L / ((long) sampleRate * 2L * channels);
                        encoder.queueInputBuffer(ei, 0, 0, pts, MediaCodec.BUFFER_FLAG_END_OF_STREAM);
                        encoderEosSent = true;
                    }
                }
                if (encoder == null && decoderDone) throw new IOException("the song produced no audio");

                // 4. AAC out of the encoder
                if (encoder != null) {
                    int oi = encoder.dequeueOutputBuffer(encInfo, 5000);
                    if (oi == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                        audioFormat = encoder.getOutputFormat();
                    } else if (oi >= 0) {
                        ByteBuffer ob = encoder.getOutputBuffer(oi);
                        if ((encInfo.flags & MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0 && encInfo.size > 0 && ob != null) {
                            byte[] d = new byte[encInfo.size];
                            ob.position(encInfo.offset);
                            ob.limit(encInfo.offset + encInfo.size);
                            ob.get(d);
                            audioSamples.add(new AudioSample(d, encInfo.presentationTimeUs));
                        }
                        encoder.releaseOutputBuffer(oi, false);
                        if ((encInfo.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) encoderDone = true;
                    }
                }
            }
            if (audioFormat == null || audioSamples.isEmpty()) throw new IOException("no AAC audio was produced");
        } catch (Throwable error) {
            audioError = String.valueOf(error);
            audioSamples.clear();
            audioFormat = null;
        } finally {
            try { if (decoder != null) { decoder.stop(); decoder.release(); } } catch (Throwable ignored) { }
            try { if (encoder != null) { encoder.stop(); encoder.release(); } } catch (Throwable ignored) { }
            try { extractor.release(); } catch (Throwable ignored) { }
        }
    }

    // ---------------------------------------------------------------- video chunks (Annex B)

    /** Start code position, payload start (first byte after the start code) and end (exclusive) of each NAL unit. */
    private static List<int[]> findNals(byte[] d, int off, int len) {
        List<int[]> nals = new ArrayList<>();
        int end = off + len;
        int prevPayload = -1;
        int prevStart = -1;
        int i = off;
        while (i + 3 <= end) {
            if (d[i] == 0 && d[i + 1] == 0 && d[i + 2] == 1) {
                int startCode = (i > off && d[i - 1] == 0) ? i - 1 : i;
                if (prevPayload >= 0) nals.add(new int[] {prevStart, prevPayload, startCode});
                prevStart = startCode;
                prevPayload = i + 3;
                i += 3;
            } else {
                i++;
            }
        }
        if (prevPayload >= 0) nals.add(new int[] {prevStart, prevPayload, end});
        return nals;
    }

    private int nalType(byte[] d, int payloadStart) {
        int b = d[payloadStart] & 0xFF;
        return hevc ? ((b >> 1) & 0x3F) : (b & 0x1F);
    }

    private boolean isParameterSet(int type) {
        return hevc ? (type == 32 || type == 33 || type == 34) : (type == 7 || type == 8);
    }

    private ByteBuffer joinWithStartCodes(byte[] d, List<int[]> nals, int... types) {
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        for (int type : types) {
            for (int[] nal : nals) {
                if (nal[1] < nal[2] && nalType(d, nal[1]) == type) {
                    out.write(0);
                    out.write(0);
                    out.write(0);
                    out.write(1);
                    out.write(d, nal[1], nal[2] - nal[1]);
                }
            }
        }
        return ByteBuffer.wrap(out.toByteArray());
    }

    private void startMuxer(byte[] d, int off, int len) throws IOException {
        List<int[]> nals = findNals(d, off, len);
        MediaFormat vf = MediaFormat.createVideoFormat(mime, width, height);
        vf.setInteger(MediaFormat.KEY_FRAME_RATE, fps);
        if (hevc) {
            ByteBuffer csd0 = joinWithStartCodes(d, nals, 32, 33, 34);
            if (csd0.capacity() == 0) throw new IOException("the first HEVC chunk has no parameter sets");
            vf.setByteBuffer("csd-0", csd0);
        } else {
            ByteBuffer sps = joinWithStartCodes(d, nals, 7);
            ByteBuffer pps = joinWithStartCodes(d, nals, 8);
            if (sps.capacity() == 0 || pps.capacity() == 0) throw new IOException("the first H.264 chunk has no SPS/PPS");
            vf.setByteBuffer("csd-0", sps);
            vf.setByteBuffer("csd-1", pps);
        }
        muxer = new MediaMuxer(tempFile.getAbsolutePath(), MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
        videoTrack = muxer.addTrack(vf);
        if (audioFormat != null && !audioSamples.isEmpty()) audioTrack = muxer.addTrack(audioFormat);
        muxer.start();
        started = true;
    }

    private void writeAudioUpTo(long ptsLimitUs) {
        if (audioTrack < 0) return;
        MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
        while (audioCursor < audioSamples.size() && audioSamples.get(audioCursor).ptsUs <= ptsLimitUs) {
            AudioSample s = audioSamples.get(audioCursor++);
            info.set(0, s.data.length, s.ptsUs, 0);
            muxer.writeSampleData(audioTrack, ByteBuffer.wrap(s.data), info);
        }
    }

    void writeVideo(byte[] data, int off, int len, long ptsUs, boolean keyFrame) throws IOException {
        if (finished) throw new IOException("export already finished");
        if (!started) startMuxer(data, off, len);
        // Parameter sets live in the track header; keep them out of the samples.
        List<int[]> nals = findNals(data, off, len);
        java.io.ByteArrayOutputStream sample = new java.io.ByteArrayOutputStream(len);
        for (int[] nal : nals) {
            if (nal[1] >= nal[2]) continue;
            if (isParameterSet(nalType(data, nal[1]))) continue;
            sample.write(data, nal[0], nal[2] - nal[0]);
        }
        byte[] bytes = sample.toByteArray();
        if (bytes.length > 0) {
            MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
            info.set(0, bytes.length, ptsUs, keyFrame ? MediaCodec.BUFFER_FLAG_KEY_FRAME : 0);
            muxer.writeSampleData(videoTrack, ByteBuffer.wrap(bytes), info);
        }
        writeAudioUpTo(ptsUs + 500_000L);
    }

    // ---------------------------------------------------------------- finish, save, abort

    /** Writes the rest of the audio, closes the MP4 and saves it to Movies/Folia. Returns {uri, bytes}. */
    String[] finishAndSave(String displayName) throws IOException {
        if (finished) throw new IOException("export already finished");
        finished = true;
        if (!started) throw new IOException("no video was written");
        writeAudioUpTo(Long.MAX_VALUE);
        try {
            muxer.stop();
        } finally {
            muxer.release();
            muxer = null;
        }
        long bytes = tempFile.length();
        String uri = saveToMovies(displayName);
        tempFile.delete();
        return new String[] {uri, String.valueOf(bytes)};
    }

    void abort() {
        finished = true;
        try {
            if (muxer != null) {
                if (started) muxer.stop();
                muxer.release();
            }
        } catch (Throwable ignored) {
        }
        muxer = null;
        tempFile.delete();
    }

    private String saveToMovies(String displayName) throws IOException {
        if (Build.VERSION.SDK_INT >= 29) {
            ContentResolver resolver = context.getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, displayName);
            values.put(MediaStore.MediaColumns.MIME_TYPE, "video/mp4");
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/Folia");
            values.put(MediaStore.MediaColumns.IS_PENDING, 1);
            Uri uri = resolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IOException("could not create the gallery entry");
            try (InputStream in = new FileInputStream(tempFile); OutputStream out = resolver.openOutputStream(uri)) {
                if (out == null) throw new IOException("could not open the gallery entry");
                copy(in, out);
            } catch (IOException error) {
                resolver.delete(uri, null, null);
                throw error;
            }
            ContentValues done = new ContentValues();
            done.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(uri, done, null, null);
            return uri.toString();
        }
        File dir = context.getExternalFilesDir(Environment.DIRECTORY_MOVIES);
        if (dir == null) throw new IOException("no storage folder available");
        File target = new File(dir, displayName);
        try (InputStream in = new FileInputStream(tempFile); OutputStream out = new FileOutputStream(target)) {
            copy(in, out);
        }
        return Uri.fromFile(target).toString();
    }

    private static void copy(InputStream in, OutputStream out) throws IOException {
        byte[] buffer = new byte[256 * 1024];
        int read;
        while ((read = in.read(buffer)) > 0) out.write(buffer, 0, read);
        out.flush();
    }
}
