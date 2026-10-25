package top.izuna.foliamajor;

import android.content.ContentResolver;
import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import android.system.Os;
import android.system.OsConstants;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import androidx.annotation.Nullable;
import java.io.File;
import java.io.FileDescriptor;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLDecoder;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Serves Storage Access Framework (SAF) content:// URIs over same-origin https://localhost/__folia_saf/stream
 * with:
 *   1. Synchronous & pre-staged local file caching in context.getCacheDir()/saf_audio_stage/ for active
 *      and queued local SAF tracks so playback and HTTP 206 byte-range seeks read from a contiguous local
 *      file with exact Content-Length / Content-Range headers and zero SAF ContentProvider IPC wakeups.
 *   2. Automatic on-the-fly ALAC (.m4a/.alac), AIFF (.aif/.aiff), CAF, WMA, WavPack, Monkey's Audio,
 *      and TTA decoding to seekable 16-bit PCM WAV in saf_audio_stage/ via FoliaAlacAndPcmTranscoder.
 *   3. Chromium AndroidStreamReaderURLLoader / InputStreamReader-compatible SafSeekableInputStream:
 *      - Reports full totalLength in available() prior to InputStreamReader::Seek so VerifyRequestedRange
 *        (byte_range_.ComputeBounds(size)) succeeds for every seek position 0..totalLength-1.
 *      - Handles InputStreamReader::Seek's initial skip(rangeStart) from offset 0 -> rangeStart without
 *        double-skipping to 2 * rangeStart, while also positioning automatically if read() is called directly.
 *      - Reads via stateless FileChannel.read(ByteBuffer, physicalOffset) (pread) with a 512 KB buffer.
 *   4. Direct WebP cover mipmap serving (256x256 for grids/Bravais lattice walls and 1024x1024 for the player)
 *      from context.getFilesDir()/media_cache/covers/ over https://localhost/__folia_cover/{assetId}.
 */
public final class FoliaSafStreamHandler {
    public static final String STREAM_PATH = "/__folia_saf/stream";
    public static final String COVER_PATH_PREFIX = "/__folia_cover/";
    /** 512 KB (524,288 bytes) read & staging buffer to eliminate frequent small SAF IPC wakeups. */
    public static final int STREAM_READ_BUFFER_BYTES = 512 * 1024;
    /** Subdirectory inside context.getCacheDir() holding contiguous pre-staged active + next SAF audio files. */
    public static final String STAGED_AUDIO_CACHE_DIR = "saf_audio_stage";
    private static final int MAX_STAGED_AUDIO_FILES = 10;
    private static final long MAX_STAGED_AUDIO_TOTAL_BYTES = 384L * 1024L * 1024L;
    private static final long MAX_SYNC_STAGE_BYTES = 96L * 1024L * 1024L;
    private static final int MAX_SIZE_CACHE_ENTRIES = 2048;

    private static final ConcurrentHashMap<String, Long> resolvedSizeCache = new ConcurrentHashMap<>();
    private static final ConcurrentHashMap<String, File> stagedUriFileMap = new ConcurrentHashMap<>();
    private static final ConcurrentHashMap<String, String> cachedMimeTypeMap = new ConcurrentHashMap<>();
    private static final ConcurrentHashMap<String, Object> uriStageLocks = new ConcurrentHashMap<>();
    private static final Set<String> inFlightStagingUris = ConcurrentHashMap.newKeySet();
    private static final ExecutorService stageExecutor = Executors.newFixedThreadPool(2);

    private FoliaSafStreamHandler() {}

    public static boolean isSafStreamRequest(WebResourceRequest request) {
        if (request == null || request.getUrl() == null) return false;
        String path = request.getUrl().getPath();
        return STREAM_PATH.equals(path);
    }

    public static boolean isLocalCoverRequest(WebResourceRequest request) {
        if (request == null || request.getUrl() == null) return false;
        String path = request.getUrl().getPath();
        return path != null && path.startsWith(COVER_PATH_PREFIX);
    }

    public static File getStagedAudioCacheDir(Context context) {
        File dir = new File(context.getCacheDir(), STAGED_AUDIO_CACHE_DIR);
        if (!dir.exists()) {
            //noinspection ResultOfMethodCallIgnored
            dir.mkdirs();
        }
        return dir;
    }

    private static String computeStageFileName(String rawUri) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(rawUri.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder("stage_");
            for (int i = 0; i < 16 && i < digest.length; i++) {
                sb.append(String.format(Locale.ROOT, "%02x", digest[i] & 0xff));
            }
            sb.append(".bin");
            return sb.toString();
        } catch (Exception ignored) {
            return "stage_" + Integer.toHexString(rawUri.hashCode()) + ".bin";
        }
    }

    /**
     * Returns the contiguous local staged File inside context.getCacheDir()/saf_audio_stage/
     * if `rawUri` has already been staged and verified non-empty, or null if not yet staged.
     */
    @Nullable
    public static File getStagedAudioFileIfReady(Context context, @Nullable String rawUri) {
        if (context == null || rawUri == null || rawUri.isEmpty()) return null;
        String normalizedUri = rawUri.trim();
        File mapped = stagedUriFileMap.get(normalizedUri);
        if (mapped != null && mapped.isFile() && mapped.length() > 0L) {
            return mapped;
        }
        File target = new File(getStagedAudioCacheDir(context), computeStageFileName(normalizedUri));
        if (target.isFile() && target.length() > 0L) {
            stagedUriFileMap.put(normalizedUri, target);
            cacheResolvedSize(normalizedUri, target.length());
            return target;
        }
        return null;
    }

    /**
     * Copies a local SAF content:// audio track into context.getCacheDir()/saf_audio_stage/
     * using a 512 KB buffer so subsequent playback and byte-range seeks read directly from
     * a contiguous local file without SAF ContentProvider IPC calls.
     */
    @Nullable
    public static File stageAudioUriToCache(Context context, @Nullable String rawUri) {
        if (context == null || rawUri == null || rawUri.isEmpty()) return null;
        String normalizedUri = rawUri.trim();
        if (!normalizedUri.startsWith("content://")) {
            return null;
        }

        File existing = getStagedAudioFileIfReady(context, normalizedUri);
        if (existing != null) {
            //noinspection ResultOfMethodCallIgnored
            existing.setLastModified(System.currentTimeMillis());
            return existing;
        }

        if (uriStageLocks.size() > 512) {
            uriStageLocks.clear();
        }
        Object uriLock = uriStageLocks.computeIfAbsent(normalizedUri, k -> new Object());

        synchronized (uriLock) {
            File readyAfterWait = getStagedAudioFileIfReady(context, normalizedUri);
            if (readyAfterWait != null) {
                //noinspection ResultOfMethodCallIgnored
                readyAfterWait.setLastModified(System.currentTimeMillis());
                return readyAfterWait;
            }

            inFlightStagingUris.add(normalizedUri);
            File stageDir = getStagedAudioCacheDir(context);
            File targetFile = new File(stageDir, computeStageFileName(normalizedUri));
            File tempFile = new File(stageDir, targetFile.getName() + ".tmp." + Thread.currentThread().getId());

            try {
                ContentResolver resolver = context.getContentResolver();
                Uri contentUri = Uri.parse(normalizedUri);
                String resolvedMime = resolver.getType(contentUri);
                if (resolvedMime != null && !resolvedMime.isEmpty()) {
                    cachedMimeTypeMap.put(normalizedUri, resolvedMime);
                }

                try (AssetFileDescriptor afd = resolver.openAssetFileDescriptor(contentUri, "r")) {
                    if (afd == null) return null;
                    try (InputStream in = afd.createInputStream();
                         FileOutputStream out = new FileOutputStream(tempFile)) {
                        byte[] copyBuffer = new byte[STREAM_READ_BUFFER_BYTES];
                        long totalCopied = 0L;
                        int read;
                        while ((read = in.read(copyBuffer)) != -1) {
                            out.write(copyBuffer, 0, read);
                            totalCopied += read;
                        }
                        out.flush();
                        if (totalCopied <= 0L) {
                            //noinspection ResultOfMethodCallIgnored
                            tempFile.delete();
                            return null;
                        }
                    }
                }

                if (!tempFile.renameTo(targetFile)) {
                    try (FileInputStream in = new FileInputStream(tempFile);
                         FileOutputStream out = new FileOutputStream(targetFile)) {
                        byte[] copyBuffer = new byte[STREAM_READ_BUFFER_BYTES];
                        int read;
                        while ((read = in.read(copyBuffer)) != -1) {
                            out.write(copyBuffer, 0, read);
                        }
                        out.flush();
                    } finally {
                        //noinspection ResultOfMethodCallIgnored
                        tempFile.delete();
                    }
                }

                if (targetFile.isFile() && targetFile.length() > 0L) {
                    //noinspection ResultOfMethodCallIgnored
                    targetFile.setLastModified(System.currentTimeMillis());
                    stagedUriFileMap.put(normalizedUri, targetFile);
                    cacheResolvedSize(normalizedUri, targetFile.length());
                    // Pre-transcode ALAC/AIFF tracks to WAV immediately when staged so playback starts instantly
                    if (FoliaAlacAndPcmTranscoder.needsWavTranscode(targetFile, cachedMimeTypeMap.get(normalizedUri), normalizedUri, false)) {
                        FoliaAlacAndPcmTranscoder.transcodeToCachedWav(context, targetFile, targetFile.getName());
                    }
                    pruneStagedAudioCache(stageDir, targetFile);
                    return targetFile;
                }
            } catch (Exception ignored) {
                //noinspection ResultOfMethodCallIgnored
                tempFile.delete();
            } finally {
                inFlightStagingUris.remove(normalizedUri);
            }
            return null;
        }
    }

    /**
     * Asynchronously pre-stages a single SAF content:// URI in the background if not already cached.
     */
    public static void prestageAudioUriAsync(final Context context, @Nullable final String rawUri) {
        if (context == null || rawUri == null || !rawUri.startsWith("content://")) return;
        String normalized = rawUri.trim();
        if (getStagedAudioFileIfReady(context, normalized) != null || inFlightStagingUris.contains(normalized)) {
            return;
        }
        final Context appContext = context.getApplicationContext() != null ? context.getApplicationContext() : context;
        stageExecutor.execute(() -> stageAudioUriToCache(appContext, normalized));
    }

    /**
     * Synchronously or asynchronously pre-stages a batch of SAF audio URIs (typically the active
     * track and the next queued track) into context.getCacheDir()/saf_audio_stage/.
     */
    public static List<File> prestageAudioUris(Context context, List<String> rawUris) {
        List<File> staged = new ArrayList<>();
        if (context == null || rawUris == null || rawUris.isEmpty()) return staged;
        for (String uri : rawUris) {
            if (uri == null || uri.trim().isEmpty()) continue;
            File file = stageAudioUriToCache(context, uri.trim());
            if (file != null) {
                staged.add(file);
            }
        }
        return staged;
    }

    private static void pruneStagedAudioCache(File stageDir, @Nullable File protectedFile) {
        if (stageDir == null || !stageDir.isDirectory()) return;
        File[] files = stageDir.listFiles();
        if (files == null || files.length == 0) return;

        List<File> cachedFiles = new ArrayList<>();
        long totalBytes = 0L;
        long now = System.currentTimeMillis();
        for (File f : files) {
            if (!f.isFile()) continue;
            String name = f.getName();
            if (name.contains(".tmp.")) {
                if (now - f.lastModified() > 120_000L) {
                    //noinspection ResultOfMethodCallIgnored
                    f.delete();
                }
                continue;
            }
            if (name.startsWith("stage_") && (name.endsWith(".bin") || name.endsWith("_pcm.wav"))) {
                cachedFiles.add(f);
                totalBytes += f.length();
            }
        }

        if (cachedFiles.size() <= MAX_STAGED_AUDIO_FILES && totalBytes <= MAX_STAGED_AUDIO_TOTAL_BYTES) {
            return;
        }

        File[] sorted = cachedFiles.toArray(new File[0]);
        Arrays.sort(sorted, Comparator.comparingLong(File::lastModified));

        String protectedPrefix = protectedFile != null ? protectedFile.getName() : null;
        int remainingCount = sorted.length;
        for (File candidate : sorted) {
            if (remainingCount <= MAX_STAGED_AUDIO_FILES && totalBytes <= MAX_STAGED_AUDIO_TOTAL_BYTES) {
                break;
            }
            if (protectedPrefix != null && candidate.getName().startsWith(protectedPrefix)) {
                continue;
            }
            long len = candidate.length();
            if (candidate.delete()) {
                totalBytes = Math.max(0L, totalBytes - len);
                remainingCount--;
                stagedUriFileMap.values().removeIf(mapped -> mapped.equals(candidate));
            }
        }
    }

    /**
     * Serves pre-extracted 256x256 and 1024x1024 WebP album cover mipmaps directly from
     * context.getFilesDir()/media_cache/covers/ without Base64 or IndexedDB/OPFS overhead.
     */
    public static WebResourceResponse handleCoverRequest(Context context, WebResourceRequest request) {
        if (context == null || request == null || request.getUrl() == null) return null;
        try {
            Uri url = request.getUrl();
            String rawPath = url.getEncodedPath();
            if (rawPath == null || !rawPath.startsWith(COVER_PATH_PREFIX)) {
                rawPath = url.getPath();
            }
            if (rawPath == null || !rawPath.startsWith(COVER_PATH_PREFIX)) return null;

            String tail = rawPath.substring(COVER_PATH_PREFIX.length());
            String decoded = URLDecoder.decode(tail, StandardCharsets.UTF_8.name()).trim().toLowerCase(Locale.ROOT);
            String digest = decoded.startsWith("sha256:") ? decoded.substring("sha256:".length()) : decoded;
            if (digest.length() != 64 || !digest.matches("^[0-9a-f]{64}$")) {
                return null;
            }

            int requestedSize = 1024;
            String sizeParam = url.getQueryParameter("size");
            if (sizeParam != null && !sizeParam.isEmpty()) {
                try {
                    requestedSize = Integer.parseInt(sizeParam.trim());
                } catch (NumberFormatException ignored) {
                    requestedSize = 1024;
                }
            }

            File coversDir = FoliaNativeBridgePlugin.getMediaCacheNamespaceDir(context, FoliaNativeBridgePlugin.CACHE_NAMESPACE_COVERS);
            File file256 = new File(coversDir, digest + "_256.webp");
            File file1024 = new File(coversDir, digest + "_1024.webp");

            // Grids and Bravais lattice walls request size <= 512 (256 or 512); full-screen player requests 1024.
            File chosen = (requestedSize <= 512)
                ? (file256.isFile() && file256.length() > 0L ? file256 : file1024)
                : (file1024.isFile() && file1024.length() > 0L ? file1024 : file256);

            if (!chosen.isFile() || chosen.length() <= 0L) {
                return null;
            }

            Map<String, String> headers = new HashMap<>();
            headers.put("Access-Control-Allow-Origin", "*");
            headers.put("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
            headers.put("Cache-Control", "public, max-age=31536000, immutable");
            headers.put("Content-Length", String.valueOf(chosen.length()));

            return new WebResourceResponse(
                "image/webp",
                null,
                200,
                "OK",
                headers,
                new FileInputStream(chosen)
            );
        } catch (Exception ignored) {
            return null;
        }
    }

    public static WebResourceResponse handleRequest(Context context, WebResourceRequest request) {
        Uri requestUrl = request.getUrl();
        String rawUri = requestUrl.getQueryParameter("uri");
        String explicitMime = requestUrl.getQueryParameter("mime");
        String sizeParam = requestUrl.getQueryParameter("size");
        String transcodeParam = requestUrl.getQueryParameter("transcode");
        String method = request.getMethod() != null ? request.getMethod().toUpperCase(Locale.ROOT) : "GET";

        Map<String, String> headers = new HashMap<>();
        headers.put("Access-Control-Allow-Origin", "*");
        headers.put("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        headers.put("Access-Control-Allow-Headers", "Range, Content-Type, Accept");
        headers.put("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges, Content-Type, X-Folia-Saf-Source");
        headers.put("Accept-Ranges", "bytes");
        headers.put("Cache-Control", "private, max-age=3600");

        if ("OPTIONS".equals(method)) {
            return new WebResourceResponse("text/plain", "UTF-8", 200, "OK", headers, null);
        }

        if (rawUri == null || rawUri.isEmpty()) {
            return new WebResourceResponse("text/plain", "UTF-8", 400, "Bad Request", headers, null);
        }

        String normalizedUri = rawUri.trim();
        ContentResolver resolver = context.getContentResolver();
        Uri contentUri = Uri.parse(normalizedUri);
        String mimeType = (explicitMime != null && !explicitMime.isEmpty())
            ? explicitMime
            : cachedMimeTypeMap.get(normalizedUri);
        if (mimeType == null || mimeType.isEmpty()) {
            mimeType = resolver.getType(contentUri);
            if (mimeType != null && !mimeType.isEmpty()) {
                cachedMimeTypeMap.put(normalizedUri, mimeType);
            }
        }
        if (mimeType == null || mimeType.isEmpty()) {
            mimeType = "application/octet-stream";
        }

        long hintedSize = -1L;
        if (sizeParam != null && !sizeParam.isEmpty()) {
            try {
                hintedSize = Long.parseLong(sizeParam.trim());
                if (hintedSize > 0L) {
                    cacheResolvedSize(normalizedUri, hintedSize);
                }
            } catch (NumberFormatException ignored) {
                hintedSize = -1L;
            }
        }
        if (hintedSize <= 0L) {
            Long cached = resolvedSizeCache.get(normalizedUri);
            if (cached != null && cached > 0L) {
                hintedSize = cached;
            }
        }

        String rangeHeader = null;
        if (request.getRequestHeaders() != null) {
            for (Map.Entry<String, String> entry : request.getRequestHeaders().entrySet()) {
                if ("range".equalsIgnoreCase(entry.getKey())) {
                    rangeHeader = entry.getValue();
                    break;
                }
            }
        }

        boolean forceWavTranscode = "wav".equalsIgnoreCase(transcodeParam) || "1".equals(transcodeParam);
        boolean isAudioStream = mimeType.startsWith("audio/")
            || "application/ogg".equals(mimeType)
            || "application/octet-stream".equals(mimeType)
            || forceWavTranscode;

        File stagedFile = getStagedAudioFileIfReady(context, normalizedUri);
        if (stagedFile == null && isAudioStream && normalizedUri.startsWith("content://")) {
            if (hintedSize <= 0L || hintedSize <= MAX_SYNC_STAGE_BYTES) {
                stagedFile = stageAudioUriToCache(context, normalizedUri);
            } else {
                prestageAudioUriAsync(context, normalizedUri);
            }
        }

        if (stagedFile != null && stagedFile.isFile() && stagedFile.length() > 0L) {
            File fileToServe = stagedFile;
            String mimeToServe = mimeType;
            String sourceTag = "staged-cache";

            if (FoliaAlacAndPcmTranscoder.needsWavTranscode(stagedFile, mimeType, normalizedUri, forceWavTranscode)) {
                File wavFile = FoliaAlacAndPcmTranscoder.transcodeToCachedWav(
                    context,
                    stagedFile,
                    stagedFile.getName()
                );
                if (wavFile != null && wavFile.isFile() && wavFile.length() > 44L) {
                    fileToServe = wavFile;
                    mimeToServe = "audio/wav";
                    sourceTag = "transcoded-wav-cache";
                }
            }

            FileInputStream stagedFis = null;
            try {
                long totalLength = fileToServe.length();
                stagedFis = new FileInputStream(fileToServe);
                headers.put("X-Folia-Saf-Source", sourceTag);
                return buildStreamResponse(
                    method,
                    mimeToServe,
                    headers,
                    rangeHeader,
                    null,
                    stagedFis,
                    totalLength
                );
            } catch (Exception ignored) {
                closeQuietly(stagedFis);
            }
        }

        AssetFileDescriptor afd = null;
        FileInputStream rawFis = null;
        try {
            afd = resolver.openAssetFileDescriptor(contentUri, "r");
            if (afd == null) {
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", headers, null);
            }

            rawFis = new FileInputStream(afd.getFileDescriptor());
            long totalLength = resolveTotalLength(resolver, contentUri, normalizedUri, afd, rawFis, sizeParam);
            headers.put("X-Folia-Saf-Source", "buffered-saf-512k");

            return buildStreamResponse(
                method,
                mimeType,
                headers,
                rangeHeader,
                afd,
                rawFis,
                totalLength
            );
        } catch (Exception e) {
            closeQuietly(rawFis);
            closeAfdQuietly(afd);
            return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", headers, null);
        }
    }

    private static WebResourceResponse buildStreamResponse(
        String method,
        String mimeType,
        Map<String, String> headers,
        @Nullable String rangeHeader,
        @Nullable AssetFileDescriptor afd,
        FileInputStream rawFis,
        long totalLength
    ) throws IOException {
        if (rangeHeader != null && rangeHeader.startsWith("bytes=") && totalLength > 0L) {
            String rangeSpec = rangeHeader.substring("bytes=".length()).trim();
            int commaIndex = rangeSpec.indexOf(',');
            if (commaIndex >= 0) {
                rangeSpec = rangeSpec.substring(0, commaIndex).trim();
            }
            int dashIndex = rangeSpec.indexOf('-');
            if (dashIndex >= 0) {
                String startPart = rangeSpec.substring(0, dashIndex).trim();
                String endPart = rangeSpec.substring(dashIndex + 1).trim();

                long start;
                long end;
                if (startPart.isEmpty()) {
                    long suffixLength = endPart.isEmpty() ? 0L : Long.parseLong(endPart);
                    if (suffixLength <= 0L) {
                        start = 0L;
                        end = totalLength - 1L;
                    } else {
                        start = Math.max(0L, totalLength - suffixLength);
                        end = totalLength - 1L;
                    }
                } else {
                    start = Long.parseLong(startPart);
                    end = endPart.isEmpty() ? (totalLength - 1L) : Long.parseLong(endPart);
                    if (end >= totalLength) {
                        end = totalLength - 1L;
                    }
                }

                if (start < 0L || start >= totalLength || start > end) {
                    closeQuietly(rawFis);
                    closeAfdQuietly(afd);
                    headers.put("Content-Range", "bytes */" + totalLength);
                    return new WebResourceResponse("text/plain", "UTF-8", 416, "Range Not Satisfiable", headers, null);
                }

                long contentLength = (end - start) + 1L;
                headers.put("Content-Range", "bytes " + start + "-" + end + "/" + totalLength);
                headers.put("Content-Length", String.valueOf(contentLength));

                if ("HEAD".equals(method)) {
                    closeQuietly(rawFis);
                    closeAfdQuietly(afd);
                    return new WebResourceResponse(mimeType, null, 206, "Partial Content", headers, null);
                }

                SafSeekableInputStream seekableStream = new SafSeekableInputStream(afd, rawFis, totalLength, start, end);
                return new WebResourceResponse(
                    mimeType,
                    null,
                    206,
                    "Partial Content",
                    headers,
                    seekableStream
                );
            }
        }

        if (totalLength > 0L) {
            headers.put("Content-Length", String.valueOf(totalLength));
        }
        if ("HEAD".equals(method)) {
            closeQuietly(rawFis);
            closeAfdQuietly(afd);
            return new WebResourceResponse(mimeType, null, 200, "OK", headers, null);
        }
        SafSeekableInputStream seekableStream = new SafSeekableInputStream(
            afd,
            rawFis,
            totalLength,
            0L,
            totalLength > 0L ? (totalLength - 1L) : Long.MAX_VALUE - 1L
        );
        return new WebResourceResponse(mimeType, null, 200, "OK", headers, seekableStream);
    }

    public static void cacheResolvedSize(String rawUri, long size) {
        if (rawUri == null || size <= 0L) return;
        if (resolvedSizeCache.size() >= MAX_SIZE_CACHE_ENTRIES) {
            resolvedSizeCache.clear();
        }
        resolvedSizeCache.put(rawUri, size);
    }

    private static long resolveTotalLength(
        ContentResolver resolver,
        Uri contentUri,
        String rawUri,
        AssetFileDescriptor afd,
        FileInputStream rawFis,
        String sizeParam
    ) {
        long declared = afd.getLength();
        if (declared > 0L) {
            cacheResolvedSize(rawUri, declared);
            return declared;
        }

        try {
            ParcelFileDescriptor pfd = afd.getParcelFileDescriptor();
            if (pfd != null) {
                long statSize = pfd.getStatSize();
                if (statSize > 0L) {
                    cacheResolvedSize(rawUri, statSize);
                    return statSize;
                }
            }
        } catch (Exception ignored) {}

        try {
            FileChannel channel = rawFis.getChannel();
            if (channel != null) {
                long channelSize = channel.size();
                long startOffset = Math.max(0L, afd.getStartOffset());
                if (channelSize > startOffset) {
                    long resolved = channelSize - startOffset;
                    cacheResolvedSize(rawUri, resolved);
                    return resolved;
                }
            }
        } catch (Exception ignored) {}

        if (sizeParam != null && !sizeParam.isEmpty()) {
            try {
                long parsedSize = Long.parseLong(sizeParam.trim());
                if (parsedSize > 0L) {
                    cacheResolvedSize(rawUri, parsedSize);
                    return parsedSize;
                }
            } catch (NumberFormatException ignored) {}
        }

        Long cachedSize = rawUri != null ? resolvedSizeCache.get(rawUri) : null;
        if (cachedSize != null && cachedSize > 0L) {
            return cachedSize;
        }

        try (Cursor cursor = resolver.query(contentUri, new String[] { OpenableColumns.SIZE }, null, null, null)) {
            if (cursor != null && cursor.moveToFirst() && !cursor.isNull(0)) {
                long queriedSize = cursor.getLong(0);
                if (queriedSize > 0L) {
                    cacheResolvedSize(rawUri, queriedSize);
                    return queriedSize;
                }
            }
        } catch (Exception ignored) {}

        return -1L;
    }

    private static void closeQuietly(InputStream stream) {
        if (stream == null) return;
        try {
            stream.close();
        } catch (IOException ignored) {}
    }

    private static void closeAfdQuietly(@Nullable AssetFileDescriptor afd) {
        if (afd == null) return;
        try {
            afd.close();
        } catch (IOException ignored) {}
    }

    /**
     * Seekable stream wrapper compatible with Chromium's AndroidStreamReaderURLLoader / InputStreamReader:
     *   1. When a Range request `bytes=rangeStart-rangeEnd` is intercepted by WebView's shouldInterceptRequest,
     *      Chromium's InputStreamReader::VerifyRequestedRange first calls `inputStream.available()` and checks
     *      `byte_range_.ComputeBounds(available)` (requiring `available > rangeStart`), and then
     *      InputStreamReader::Seek calls `inputStream.skip(rangeStart)` to advance from byte 0 to `rangeStart`.
     *   2. Starting `currentOffset` at 0L with `positionedToRangeStart = (rangeStart == 0L)` allows
     *      Chromium's `available()` check to see the full `totalLength` and `skip(rangeStart)` to advance
     *      `currentOffset` cleanly to `rangeStart` without double-skipping to `2 * rangeStart`.
     *   3. If a direct caller calls `read()` without calling `skip(rangeStart)` first, `ensurePositionedForRead()`
     *      automatically advances `currentOffset` to `rangeStart` before the first read.
     */
    private static final class SafSeekableInputStream extends InputStream {
        @Nullable
        private final AssetFileDescriptor afd;
        private final FileInputStream fis;
        @Nullable
        private final FileChannel channel;
        private final long baseOffset;
        private final long totalLength;
        private final long rangeStart;
        private final long rangeEndInclusive;
        private final byte[] readBuffer = new byte[STREAM_READ_BUFFER_BYTES];
        private int bufferPos = 0;
        private int bufferLimit = 0;
        private long currentOffset = 0L;
        private boolean positionedToRangeStart;
        private boolean fallbackDescriptorPositioned = false;
        private boolean usePositionalChannelRead = true;
        private boolean closed = false;

        SafSeekableInputStream(
            @Nullable AssetFileDescriptor afd,
            FileInputStream fis,
            long totalLength,
            long rangeStart,
            long rangeEndInclusive
        ) {
            this.afd = afd;
            this.fis = fis;
            this.channel = fis.getChannel();
            this.baseOffset = afd != null ? Math.max(0L, afd.getStartOffset()) : 0L;
            this.totalLength = totalLength;
            this.rangeStart = Math.max(0L, rangeStart);
            this.rangeEndInclusive = rangeEndInclusive;
            this.currentOffset = 0L;
            this.positionedToRangeStart = (this.rangeStart == 0L);
        }

        private void ensurePositionedForRead() {
            if (!positionedToRangeStart) {
                positionedToRangeStart = true;
                if (currentOffset < rangeStart) {
                    currentOffset = rangeStart;
                    bufferPos = 0;
                    bufferLimit = 0;
                }
            }
        }

        private void ensurePositionedForFallbackRead() throws IOException {
            if (!fallbackDescriptorPositioned) {
                fallbackDescriptorPositioned = true;
                seekKernelDescriptor(baseOffset + currentOffset, 0L);
            }
        }

        private void seekKernelDescriptor(long targetPhysicalPosition, long currentPhysicalPosition) throws IOException {
            try {
                FileDescriptor fd = afd != null ? afd.getFileDescriptor() : fis.getFD();
                if (fd != null && fd.valid()) {
                    long positioned = Os.lseek(fd, targetPhysicalPosition, OsConstants.SEEK_SET);
                    if (positioned == targetPhysicalPosition) {
                        return;
                    }
                }
            } catch (Exception ignored) {}
            try {
                if (channel != null) {
                    channel.position(targetPhysicalPosition);
                    return;
                }
            } catch (IOException ignored) {}
            long delta = targetPhysicalPosition - currentPhysicalPosition;
            if (delta > 0L) {
                byte[] skipScratch = new byte[16 * 1024];
                long remaining = delta;
                while (remaining > 0L) {
                    int toRead = (int) Math.min((long) skipScratch.length, remaining);
                    int got = fis.read(skipScratch, 0, toRead);
                    if (got <= 0) break;
                    remaining -= got;
                }
            }
        }

        private int fillReadBuffer() throws IOException {
            bufferPos = 0;
            bufferLimit = 0;
            long remainingInRange = (rangeEndInclusive - currentOffset) + 1L;
            if (remainingInRange <= 0L) {
                return -1;
            }
            int maxToFill = (int) Math.min((long) readBuffer.length, remainingInRange);
            int totalFilled = 0;

            if (usePositionalChannelRead && channel != null) {
                try {
                    long physicalStart = baseOffset + currentOffset;
                    while (totalFilled < maxToFill) {
                        ByteBuffer dst = ByteBuffer.wrap(readBuffer, totalFilled, maxToFill - totalFilled);
                        int count = channel.read(dst, physicalStart + totalFilled);
                        if (count <= 0) {
                            break;
                        }
                        totalFilled += count;
                    }
                    if (totalFilled > 0) {
                        bufferLimit = totalFilled;
                        return totalFilled;
                    }
                    if (totalLength > 0L && currentOffset >= totalLength) {
                        return -1;
                    }
                } catch (Exception ignored) {
                    usePositionalChannelRead = false;
                }
            }

            ensurePositionedForFallbackRead();
            while (totalFilled < maxToFill) {
                int count = fis.read(readBuffer, totalFilled, maxToFill - totalFilled);
                if (count <= 0) {
                    break;
                }
                totalFilled += count;
            }
            if (totalFilled <= 0) {
                return -1;
            }
            bufferLimit = totalFilled;
            return totalFilled;
        }

        @Override
        public long skip(long n) throws IOException {
            if (closed || n <= 0L) return 0L;
            long maxOffsetExclusive = totalLength > 0L
                ? Math.min(totalLength, rangeEndInclusive + 1L)
                : Long.MAX_VALUE;
            long maxSkip = Math.max(0L, maxOffsetExclusive - currentOffset);
            long toSkip = Math.min(n, maxSkip);
            if (toSkip <= 0L) return 0L;

            int bufferedRemaining = bufferLimit - bufferPos;
            if (toSkip <= bufferedRemaining) {
                bufferPos += (int) toSkip;
                currentOffset += toSkip;
                if (currentOffset >= rangeStart) {
                    positionedToRangeStart = true;
                }
                return toSkip;
            }

            long oldPhysical = baseOffset + currentOffset + bufferedRemaining;
            long targetOffset = currentOffset + toSkip;
            long physicalOffset = baseOffset + targetOffset;
            bufferPos = 0;
            bufferLimit = 0;
            if (!usePositionalChannelRead && fallbackDescriptorPositioned) {
                seekKernelDescriptor(physicalOffset, oldPhysical);
            }
            currentOffset = targetOffset;
            if (currentOffset >= rangeStart) {
                positionedToRangeStart = true;
            }
            return toSkip;
        }

        @Override
        public int read() throws IOException {
            if (closed) return -1;
            ensurePositionedForRead();
            if (currentOffset > rangeEndInclusive) return -1;
            if (bufferPos >= bufferLimit) {
                if (fillReadBuffer() <= 0) {
                    return -1;
                }
            }
            int b = readBuffer[bufferPos++] & 0xff;
            currentOffset += 1L;
            return b;
        }

        @Override
        public int read(byte[] b, int off, int len) throws IOException {
            if (closed) return -1;
            if (len == 0) return 0;
            ensurePositionedForRead();
            long remainingInRange = (rangeEndInclusive - currentOffset) + 1L;
            if (remainingInRange <= 0L) return -1;

            int requested = (int) Math.min((long) len, remainingInRange);
            int totalCopied = 0;

            while (totalCopied < requested) {
                int bufferedAvailable = bufferLimit - bufferPos;
                if (bufferedAvailable <= 0) {
                    if (fillReadBuffer() <= 0) {
                        break;
                    }
                    bufferedAvailable = bufferLimit - bufferPos;
                }
                int chunk = Math.min(requested - totalCopied, bufferedAvailable);
                System.arraycopy(readBuffer, bufferPos, b, off + totalCopied, chunk);
                bufferPos += chunk;
                totalCopied += chunk;
                currentOffset += chunk;
            }

            return totalCopied > 0 ? totalCopied : -1;
        }

        @Override
        public int available() throws IOException {
            if (closed) return 0;
            if (totalLength > 0L) {
                // Before InputStreamReader::Seek has skipped to rangeStart, report full totalLength
                // so Chromium's VerifyRequestedRange (byte_range_.ComputeBounds(size)) succeeds
                // for every seek target 0..totalLength-1 (including bounded Range: bytes=X-Y requests).
                if (!positionedToRangeStart) {
                    return (int) Math.min(totalLength, (long) Integer.MAX_VALUE);
                }
                long remaining = Math.max(0L, (rangeEndInclusive + 1L) - currentOffset);
                return (int) Math.min(remaining, (long) Integer.MAX_VALUE);
            }
            int buffered = Math.max(0, bufferLimit - bufferPos);
            return buffered > 0 ? buffered : fis.available();
        }

        @Override
        public void close() throws IOException {
            if (closed) return;
            closed = true;
            bufferPos = 0;
            bufferLimit = 0;
            try {
                fis.close();
            } finally {
                closeAfdQuietly(afd);
            }
        }
    }
}
