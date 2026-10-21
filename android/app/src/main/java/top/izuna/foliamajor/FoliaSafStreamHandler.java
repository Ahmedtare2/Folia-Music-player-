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
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.channels.FileChannel;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Serves Storage Access Framework (SAF) content:// URIs over same-origin https://localhost/__folia_saf/stream
 * with full HTTP 206 Partial Content byte-range support and O(1) kernel descriptor seeking so large
 * lossless audio files (FLAC/WAV/MP3/M4A/OGG/OPUS) stream and seek instantaneously without blocking
 * the WebView network thread or loading entire files into the JavaScript heap.
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
        FileInputStreamWithAfd baseStream = null;
        try {
            afd = resolver.openAssetFileDescriptor(contentUri, "r");
            if (afd == null) {
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", headers, null);
            }

            baseStream = new FileInputStreamWithAfd(afd);
            long totalLength = resolveTotalLength(resolver, contentUri, rawUri, afd, baseStream, sizeParam);

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
                        closeQuietly(baseStream);
                        headers.put("Content-Range", "bytes */" + totalLength);
                        return new WebResourceResponse("text/plain", "UTF-8", 416, "Range Not Satisfiable", headers, null);
                    }

                    long contentLength = (end - start) + 1L;
                    headers.put("Content-Range", "bytes " + start + "-" + end + "/" + totalLength);
                    headers.put("Content-Length", String.valueOf(contentLength));

                    if ("HEAD".equals(method)) {
                        closeQuietly(baseStream);
                        return new WebResourceResponse(mimeType, null, 206, "Partial Content", headers, null);
                    }

                    if (start > 0L) {
                        baseStream.seekTo(start);
                    }
                    InputStream boundedStream = new BoundedInputStream(baseStream, contentLength);
                    return new WebResourceResponse(
                        mimeType,
                        null,
                        206,
                        "Partial Content",
                        headers,
                        boundedStream
                    );
                }
            }

            if (totalLength > 0L) {
                headers.put("Content-Length", String.valueOf(totalLength));
            }
            if ("HEAD".equals(method)) {
                closeQuietly(baseStream);
                return new WebResourceResponse(mimeType, null, 200, "OK", headers, null);
            }
            InputStream responseStream = totalLength > 0L
                ? new BoundedInputStream(baseStream, totalLength)
                : baseStream;
            return new WebResourceResponse(mimeType, null, 200, "OK", headers, responseStream);
        } catch (Exception e) {
            closeQuietly(baseStream);
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
        FileInputStreamWithAfd baseStream,
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
            FileChannel channel = baseStream.getChannel();
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

    private static final class FileInputStreamWithAfd extends java.io.FileInputStream {
        private final AssetFileDescriptor afd;
        private boolean closed = false;

        FileInputStreamWithAfd(AssetFileDescriptor afd) throws IOException {
            super(afd.getFileDescriptor());
            this.afd = afd;
            long startOffset = afd.getStartOffset();
            if (startOffset > 0L) {
                seekInternal(startOffset);
            }
        }

        void seekTo(long offset) throws IOException {
            long baseOffset = Math.max(0L, afd.getStartOffset());
            seekInternal(baseOffset + offset);
        }

        private void seekInternal(long targetPosition) throws IOException {
            try {
                FileDescriptor fd = afd.getFileDescriptor();
                if (fd != null && fd.valid()) {
                    long positioned = Os.lseek(fd, targetPosition, OsConstants.SEEK_SET);
                    if (positioned == targetPosition) {
                        return;
                    }
                }
            } catch (Exception ignored) {
                // Fall back to FileChannel.position().
            }
            try {
                FileChannel channel = getChannel();
                if (channel != null) {
                    channel.position(targetPosition);
                    return;
                }
            } catch (IOException ignored) {
                // Pipe-backed descriptor: fall back to stream skip.
            }
            long remainingToSkip = targetPosition;
            byte[] skipBuffer = new byte[16384];
            while (remainingToSkip > 0L) {
                long skipped = super.skip(remainingToSkip);
                if (skipped > 0L) {
                    remainingToSkip -= skipped;
                    continue;
                }
                int toRead = (int) Math.min((long) skipBuffer.length, remainingToSkip);
                int read = super.read(skipBuffer, 0, toRead);
                if (read < 0) {
                    break;
                }
                remainingToSkip -= read;
            }
        }

        @Override
        public void close() throws IOException {
            if (closed) return;
            closed = true;
            try {
                super.close();
            } finally {
                try {
                    afd.close();
                } catch (IOException ignored) {
                    // Ignore duplicate AFD close.
                }
            }
        }
    }

    private static final class BoundedInputStream extends FilterInputStream {
        private long remaining;

        BoundedInputStream(InputStream in, long maxBytes) {
            super(in);
            this.remaining = Math.max(0L, maxBytes);
        }

        @Override
        public int read() throws IOException {
            if (remaining <= 0L) return -1;
            int result = super.read();
            if (result != -1) {
                remaining -= 1L;
            }
            return result;
        }

        @Override
        public int read(byte[] b, int off, int len) throws IOException {
            if (remaining <= 0L) return -1;
            int toRead = (int) Math.min((long) len, remaining);
            int count = super.read(b, off, toRead);
            if (count > 0) {
                remaining -= count;
            }
            return count;
        }

        @Override
        public long skip(long n) throws IOException {
            if (remaining <= 0L || n <= 0L) return 0L;
            long toSkip = Math.min(n, remaining);
            long skipped = super.skip(toSkip);
            if (skipped > 0L) {
                remaining -= skipped;
            }
            return skipped;
        }

        @Override
        public int available() throws IOException {
            if (remaining <= 0L) return 0;
            int underlying = super.available();
            return (int) Math.min((long) underlying, Math.min(remaining, (long) Integer.MAX_VALUE));
        }

        @Override
        public void close() throws IOException {
            remaining = 0L;
            super.close();
        }
    }
}
