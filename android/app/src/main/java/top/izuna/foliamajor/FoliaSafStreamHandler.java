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
 *   1. Fast temporary local file pre-staging in context.getCacheDir()/saf_audio_stage/ for the currently
 *      playing and next queued local SAF tracks so playback and HTTP 206 seeks read from a contiguous local
 *      file with zero SAF ContentProvider IPC wakeups during lyrics rendering.
 *   2. A 512 KB (524,288-byte) in-memory read buffer inside SafSeekableInputStream so any un-staged or
 *      in-progress SAF stream coalesces small WebView media demuxer reads into 512 KB chunks.
 *   3. Direct WebP cover mipmap serving (256x256 for grids/Bravais lattice walls and 1024x1024 for the player)
 *      from context.getFilesDir()/media_cache/covers/ over https://localhost/__folia_cover/{assetId}.
 */
public final class FoliaSafStreamHandler {
    public static final String STREAM_PATH = "/__folia_saf/stream";
    public static final String COVER_PATH_PREFIX = "/__folia_cover/";
    /** 512 KB (524,288 bytes) read & staging buffer to eliminate frequent small SAF IPC wakeups. */
    public static final int STREAM_READ_BUFFER_BYTES = 512 * 1024;
    /** Subdirectory inside context.getCacheDir() holding contiguous pre-staged active + next SAF audio files. */
    public static final String STAGED_AUDIO_CACHE_DIR = "saf_audio_stage";
    private static final int MAX_STAGED_AUDIO_FILES = 6;
    private static final long MAX_STAGED_AUDIO_TOTAL_BYTES = 256L * 1024L * 1024L;
    private static final int MAX_SIZE_CACHE_ENTRIES = 2048;

    private static final ConcurrentHashMap<String, Long> resolvedSizeCache = new ConcurrentHashMap<>();
    private static final ConcurrentHashMap<String, File> stagedUriFileMap = new ConcurrentHashMap<>();
    private static final ConcurrentHashMap<String, String> cachedMimeTypeMap = new ConcurrentHashMap<>();
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
        File mapped = stagedUriFileMap.get(rawUri);
        if (mapped != null && mapped.isFile() && mapped.length() > 0L) {
            return mapped;
        }
        File target = new File(getStagedAudioCacheDir(context), computeStageFileName(rawUri));
        if (target.isFile() && target.length() > 0L) {
            stagedUriFileMap.put(rawUri, target);
            cacheResolvedSize(rawUri, target.length());
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
            // Touch lastModified to keep active/next track hot in LRU cache.
            //noinspection ResultOfMethodCallIgnored
            existing.setLastModified(System.currentTimeMillis());
            return existing;
        }

        if (!inFlightStagingUris.add(normalizedUri)) {
            return getStagedAudioFileIfReady(context, normalizedUri);
        }

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
                // Fallback copy if rename across filesystem boundary fails.
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

    /**
     * Asynchronously pre-stages a single SAF content:// URI in the background if not already cached.
     */
    public static void prestageAudioUriAsync(final Context context, @Nullable final String rawUri) {
        if (context == null || rawUri == null || !rawUri.startsWith("content://")) return;
        if (getStagedAudioFileIfReady(context, rawUri) != null || inFlightStagingUris.contains(rawUri)) {
            return;
        }
        final Context appContext = context.getApplicationContext() != null ? context.getApplicationContext() : context;
        stageExecutor.execute(() -> stageAudioUriToCache(appContext, rawUri));
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

        List<File> binFiles = new ArrayList<>();
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
            if (name.startsWith("stage_") && name.endsWith(".bin")) {
                binFiles.add(f);
                totalBytes += f.length();
            }
        }

        if (binFiles.size() <= MAX_STAGED_AUDIO_FILES && totalBytes <= MAX_STAGED_AUDIO_TOTAL_BYTES) {
            return;
        }

        File[] sorted = binFiles.toArray(new File[0]);
        Arrays.sort(sorted, Comparator.comparingLong(File::lastModified));

        int remainingCount = sorted.length;
        for (File candidate : sorted) {
            if (remainingCount <= MAX_STAGED_AUDIO_FILES && totalBytes <= MAX_STAGED_AUDIO_TOTAL_BYTES) {
                break;
            }
            if (protectedFile != null && candidate.equals(protectedFile)) {
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
        String method = request.getMethod() != null ? request.getMethod().toUpperCase(Locale.ROOT) : "GET";

        Map<String, String> headers = new HashMap<>();
        headers.put("Access-Control-Allow-Origin", "*");
        headers.put("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        headers.put("Access-Control-Allow-Headers", "Range, Content-Type, Accept");
        headers.put("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges, Content-Type, X-Folia-Saf-Source");
        headers.put("Accept-Ranges", "bytes");
        headers.put("Cache-Control", "no-store");

        if ("OPTIONS".equals(method)) {
            return new WebResourceResponse("text/plain", "UTF-8", 200, "OK", headers, null);
        }

        if (rawUri == null || rawUri.isEmpty()) {
            return new WebResourceResponse("text/plain", "UTF-8", 400, "Bad Request", headers, null);
        }

        ContentResolver resolver = context.getContentResolver();
        Uri contentUri = Uri.parse(rawUri);
        String mimeType = (explicitMime != null && !explicitMime.isEmpty())
            ? explicitMime
            : cachedMimeTypeMap.get(rawUri);
        if (mimeType == null || mimeType.isEmpty()) {
            mimeType = resolver.getType(contentUri);
            if (mimeType != null && !mimeType.isEmpty()) {
                cachedMimeTypeMap.put(rawUri, mimeType);
            }
        }
        if (mimeType == null || mimeType.isEmpty()) {
            mimeType = "application/octet-stream";
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

        // Fast path: serve directly from the contiguous pre-staged local file in context.getCacheDir()/saf_audio_stage/
        // when available so playback makes zero IPC calls to Android's SAF ContentProvider.
        File stagedFile = getStagedAudioFileIfReady(context, rawUri);
        if (stagedFile != null && stagedFile.isFile() && stagedFile.length() > 0L) {
            FileInputStream stagedFis = null;
            SafSeekableInputStream stagedStream = null;
            try {
                long totalLength = stagedFile.length();
                stagedFis = new FileInputStream(stagedFile);
                headers.put("X-Folia-Saf-Source", "staged-cache");
                return buildStreamResponse(
                    method,
                    mimeType,
                    headers,
                    rangeHeader,
                    null,
                    stagedFis,
                    totalLength
                );
            } catch (Exception ignored) {
                closeQuietly(stagedStream);
                closeQuietly(stagedFis);
                // Fall through to direct SAF descriptor streaming with 512 KB read buffer.
            }
        } else if (mimeType.startsWith("audio/") || "application/ogg".equals(mimeType) || "application/octet-stream".equals(mimeType)) {
            // Trigger background staging into context.getCacheDir()/saf_audio_stage/ for subsequent reads/seeks.
            prestageAudioUriAsync(context, rawUri);
        }

        AssetFileDescriptor afd = null;
        FileInputStream rawFis = null;
        try {
            afd = resolver.openAssetFileDescriptor(contentUri, "r");
            if (afd == null) {
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", headers, null);
            }

            rawFis = new FileInputStream(afd.getFileDescriptor());
            long totalLength = resolveTotalLength(resolver, contentUri, rawUri, afd, rawFis, sizeParam);
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

    private static void cacheResolvedSize(String rawUri, long size) {
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
        } catch (Exception ignored) {
            // Fall through to FileChannel.size().
        }

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
        } catch (Exception ignored) {
            // Fall through to cached or query param size.
        }

        if (sizeParam != null && !sizeParam.isEmpty()) {
            try {
                long parsedSize = Long.parseLong(sizeParam);
                if (parsedSize > 0L) {
                    cacheResolvedSize(rawUri, parsedSize);
                    return parsedSize;
                }
            } catch (NumberFormatException ignored) {
                // Fall through.
            }
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
        } catch (Exception ignored) {
            // Unknown length.
        }

        return -1L;
    }

    private static void closeQuietly(InputStream stream) {
        if (stream == null) return;
        try {
            stream.close();
        } catch (IOException ignored) {
            // Ignore close error.
        }
    }

    private static void closeAfdQuietly(@Nullable AssetFileDescriptor afd) {
        if (afd == null) return;
        try {
            afd.close();
        } catch (IOException ignored) {
            // Ignore close error.
        }
    }

    /**
     * Seekable stream wrapper with a 512 KB (524,288-byte) internal read buffer so small WebView
     * media demuxer reads are satisfied from contiguous RAM without triggering hundreds of SAF IPC
     * calls during lyrics visualization.
     */
    private static final class SafSeekableInputStream extends InputStream {
        @Nullable
        private final AssetFileDescriptor afd;
        private final FileInputStream fis;
        private final long baseOffset;
        private final long totalLength;
        private final long rangeStart;
        private final long rangeEndInclusive;
        private final byte[] readBuffer = new byte[STREAM_READ_BUFFER_BYTES];
        private int bufferPos = 0;
        private int bufferLimit = 0;
        private long currentOffset = 0L;
        private boolean hasSkippedOrRead = false;
        private boolean closed = false;

        SafSeekableInputStream(
            @Nullable AssetFileDescriptor afd,
            FileInputStream fis,
            long totalLength,
            long rangeStart,
            long rangeEndInclusive
        ) throws IOException {
            this.afd = afd;
            this.fis = fis;
            this.baseOffset = afd != null ? Math.max(0L, afd.getStartOffset()) : 0L;
            this.totalLength = totalLength;
            this.rangeStart = Math.max(0L, rangeStart);
            this.rangeEndInclusive = rangeEndInclusive;
            if (this.baseOffset > 0L) {
                seekKernelDescriptor(this.baseOffset);
            }
        }

        private void ensurePositionedForRead() throws IOException {
            if (!hasSkippedOrRead) {
                hasSkippedOrRead = true;
                if (currentOffset < rangeStart) {
                    seekKernelDescriptor(baseOffset + rangeStart);
                    currentOffset = rangeStart;
                    bufferPos = 0;
                    bufferLimit = 0;
                }
            }
        }

        private void seekKernelDescriptor(long targetPhysicalPosition) throws IOException {
            try {
                FileDescriptor fd = afd != null ? afd.getFileDescriptor() : fis.getFD();
                if (fd != null && fd.valid()) {
                    long positioned = Os.lseek(fd, targetPhysicalPosition, OsConstants.SEEK_SET);
                    if (positioned == targetPhysicalPosition) {
                        return;
                    }
                }
            } catch (Exception ignored) {
                // Fall back to FileChannel.position().
            }
            try {
                FileChannel channel = fis.getChannel();
                if (channel != null) {
                    channel.position(targetPhysicalPosition);
                    return;
                }
            } catch (IOException ignored) {
                // Pipe-backed descriptor: fall back to stream skip.
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
            // Coalesce underlying reads up to 512 KB (or EOF/end-of-range) in one burst.
            while (totalFilled < maxToFill) {
                int count = fis.read(readBuffer, totalFilled, maxToFill - totalFilled);
                if (count <= 0) {
                    break;
                }
                totalFilled += count;
                // If backed by a pipe that returned partial data and has no more immediately available, break.
                if (totalFilled < maxToFill && fis.available() <= 0 && afd != null) {
                    break;
                }
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
            ensurePositionedForRead();
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
                return toSkip;
            }

            long targetOffset = currentOffset + toSkip;
            long physicalOffset = baseOffset + targetOffset;
            bufferPos = 0;
            bufferLimit = 0;
            seekKernelDescriptor(physicalOffset);
            currentOffset = targetOffset;
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
