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
import java.io.FileDescriptor;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.channels.FileChannel;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Serves Storage Access Framework (SAF) content:// URIs over same-origin https://localhost/__folia_saf/stream
 * with full HTTP 206 Partial Content byte-range support and O(1) kernel descriptor seeking so large
 * audio and album video files stream and seek instantaneously without double-seeking or failing
 * Chromium's InputStreamReader::VerifyRequestedRange / SkipToRequestedRange checks.
 */
public final class FoliaSafStreamHandler {
    public static final String STREAM_PATH = "/__folia_saf/stream";
    private static final int MAX_SIZE_CACHE_ENTRIES = 2048;
    private static final ConcurrentHashMap<String, Long> resolvedSizeCache = new ConcurrentHashMap<>();

    private FoliaSafStreamHandler() {}

    public static boolean isSafStreamRequest(WebResourceRequest request) {
        if (request == null || request.getUrl() == null) return false;
        String path = request.getUrl().getPath();
        return STREAM_PATH.equals(path);
    }

    public static WebResourceResponse handleRequest(Context context, WebResourceRequest request) {
        Uri requestUrl = request.getUrl();
        String rawUri = requestUrl.getQueryParameter("uri");
        String explicitMime = requestUrl.getQueryParameter("mime");
        String sizeParam = requestUrl.getQueryParameter("size");
        String method = request.getMethod() != null ? request.getMethod().toUpperCase() : "GET";

        Map<String, String> headers = new HashMap<>();
        headers.put("Access-Control-Allow-Origin", "*");
        headers.put("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        headers.put("Access-Control-Allow-Headers", "Range, Content-Type, Accept");
        headers.put("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges, Content-Type");
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
            : resolver.getType(contentUri);
        if (mimeType == null || mimeType.isEmpty()) {
            mimeType = "application/octet-stream";
        }

        AssetFileDescriptor afd = null;
        SafSeekableInputStream seekableStream = null;
        try {
            afd = resolver.openAssetFileDescriptor(contentUri, "r");
            if (afd == null) {
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", headers, null);
            }

            FileInputStream rawFis = new FileInputStream(afd.getFileDescriptor());
            long totalLength = resolveTotalLength(resolver, contentUri, rawUri, afd, rawFis, sizeParam);

            String rangeHeader = null;
            if (request.getRequestHeaders() != null) {
                for (Map.Entry<String, String> entry : request.getRequestHeaders().entrySet()) {
                    if ("range".equalsIgnoreCase(entry.getKey())) {
                        rangeHeader = entry.getValue();
                        break;
                    }
                }
            }

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

                    // IMPORTANT: Do NOT pre-seek before returning WebResourceResponse!
                    // Chromium's AndroidStreamReaderURLLoader / InputStreamReader::Seek calls:
                    //   1) stream.available() to verify range bounds against total file size
                    //   2) stream.skip(start) to seek to the requested byte offset.
                    // SafSeekableInputStream starts at logical offset 0, reports totalLength in available(),
                    // and executes skip(start) in O(1) via Os.lseek. If a non-WebView caller calls read()
                    // directly without calling skip(start) first, SafSeekableInputStream seeks to start on first read.
                    seekableStream = new SafSeekableInputStream(afd, rawFis, totalLength, start, end);
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
            seekableStream = new SafSeekableInputStream(
                afd,
                rawFis,
                totalLength,
                0L,
                totalLength > 0L ? (totalLength - 1L) : Long.MAX_VALUE - 1L
            );
            return new WebResourceResponse(mimeType, null, 200, "OK", headers, seekableStream);
        } catch (Exception e) {
            closeQuietly(seekableStream);
            closeAfdQuietly(afd);
            return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", headers, null);
        }
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

    private static void closeAfdQuietly(AssetFileDescriptor afd) {
        if (afd == null) return;
        try {
            afd.close();
        } catch (IOException ignored) {
            // Ignore close error.
        }
    }

    /**
     * InputStream tailored to Chromium's AndroidStreamReaderURLLoader + InputStreamReader contract:
     * - Starts at logical offset 0 so InputStreamReader::VerifyRequestedRange sees the full file length
     *   in available() and InputStreamReader::SkipToRequestedRange can call skip(rangeStart).
     * - Executes skip(n) in O(1) via Os.lseek(SEEK_SET) on the underlying kernel file descriptor.
     * - If read() is invoked directly without a prior skip(rangeStart), automatically seeks to rangeStart
     *   before reading the first byte.
     */
    private static final class SafSeekableInputStream extends InputStream {
        private final AssetFileDescriptor afd;
        private final FileInputStream fis;
        private final long baseOffset;
        private final long totalLength;
        private final long rangeStart;
        private final long rangeEndInclusive;
        private long currentOffset = 0L;
        private boolean hasSkippedOrRead = false;
        private boolean closed = false;

        SafSeekableInputStream(
            AssetFileDescriptor afd,
            FileInputStream fis,
            long totalLength,
            long rangeStart,
            long rangeEndInclusive
        ) throws IOException {
            this.afd = afd;
            this.fis = fis;
            this.baseOffset = Math.max(0L, afd.getStartOffset());
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
                }
            }
        }

        private void seekKernelDescriptor(long targetPhysicalPosition) throws IOException {
            try {
                FileDescriptor fd = afd.getFileDescriptor();
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

        @Override
        public long skip(long n) throws IOException {
            if (closed || n <= 0L) return 0L;
            hasSkippedOrRead = true;
            long maxOffsetExclusive = totalLength > 0L
                ? Math.min(totalLength, rangeEndInclusive + 1L)
                : Long.MAX_VALUE;
            long maxSkip = Math.max(0L, maxOffsetExclusive - currentOffset);
            long toSkip = Math.min(n, maxSkip);
            if (toSkip <= 0L) return 0L;

            long targetOffset = currentOffset + toSkip;
            seekKernelDescriptor(baseOffset + targetOffset);
            currentOffset = targetOffset;
            return toSkip;
        }

        @Override
        public int read() throws IOException {
            if (closed) return -1;
            ensurePositionedForRead();
            if (currentOffset > rangeEndInclusive) return -1;
            int b = fis.read();
            if (b != -1) {
                currentOffset += 1L;
            }
            return b;
        }

        @Override
        public int read(byte[] b, int off, int len) throws IOException {
            if (closed) return -1;
            if (len == 0) return 0;
            ensurePositionedForRead();
            long remainingInRange = (rangeEndInclusive - currentOffset) + 1L;
            if (remainingInRange <= 0L) return -1;

            int toRead = (int) Math.min((long) len, remainingInRange);
            int count = fis.read(b, off, toRead);
            if (count > 0) {
                currentOffset += count;
            }
            return count;
        }

        @Override
        public int available() throws IOException {
            if (closed) return 0;
            if (totalLength > 0L) {
                long remaining = Math.max(0L, (rangeEndInclusive + 1L) - currentOffset);
                return (int) Math.min(remaining, (long) Integer.MAX_VALUE);
            }
            return fis.available();
        }

        @Override
        public void close() throws IOException {
            if (closed) return;
            closed = true;
            try {
                fis.close();
            } finally {
                closeAfdQuietly(afd);
            }
        }
    }
}
