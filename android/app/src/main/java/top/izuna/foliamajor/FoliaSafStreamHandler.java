package top.izuna.foliamajor;

import android.content.ContentResolver;
import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.channels.FileChannel;
import java.util.HashMap;
import java.util.Map;

/**
 * Serves Storage Access Framework (SAF) content:// URIs over same-origin https://localhost/__folia_saf/stream
 * with full HTTP 206 Partial Content byte-range support so large lossless audio files (FLAC/WAV) stream and
 * seek instantaneously without loading entire files into the WebView JavaScript heap.
 */
public final class FoliaSafStreamHandler {
    public static final String STREAM_PATH = "/__folia_saf/stream";

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

        Map<String, String> headers = new HashMap<>();
        headers.put("Access-Control-Allow-Origin", "*");
        headers.put("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        headers.put("Access-Control-Allow-Headers", "Range, Content-Type");
        headers.put("Accept-Ranges", "bytes");
        headers.put("Cache-Control", "no-store");

        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
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

        try {
            AssetFileDescriptor afd = resolver.openAssetFileDescriptor(contentUri, "r");
            if (afd == null) {
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", headers, null);
            }

            long totalLength = afd.getLength();
            FileInputStreamWithAfd baseStream = new FileInputStreamWithAfd(afd);

            String rangeHeader = null;
            if (request.getRequestHeaders() != null) {
                for (Map.Entry<String, String> entry : request.getRequestHeaders().entrySet()) {
                    if ("range".equalsIgnoreCase(entry.getKey())) {
                        rangeHeader = entry.getValue();
                        break;
                    }
                }
            }

            if (rangeHeader != null && rangeHeader.startsWith("bytes=") && totalLength > 0) {
                String rangeSpec = rangeHeader.substring("bytes=".length()).trim();
                int dashIndex = rangeSpec.indexOf('-');
                if (dashIndex >= 0) {
                    String startPart = rangeSpec.substring(0, dashIndex).trim();
                    String endPart = rangeSpec.substring(dashIndex + 1).trim();

                    long start = startPart.isEmpty() ? 0 : Long.parseLong(startPart);
                    long end = endPart.isEmpty() ? (totalLength - 1) : Long.parseLong(endPart);
                    if (end >= totalLength) {
                        end = totalLength - 1;
                    }

                    if (start >= 0 && start <= end && start < totalLength) {
                        long contentLength = (end - start) + 1;
                        baseStream.seekTo(start);
                        InputStream boundedStream = new BoundedInputStream(baseStream, contentLength);
                        headers.put("Content-Range", "bytes " + start + "-" + end + "/" + totalLength);
                        headers.put("Content-Length", String.valueOf(contentLength));
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
            }

            if (totalLength >= 0) {
                headers.put("Content-Length", String.valueOf(totalLength));
            }
            return new WebResourceResponse(mimeType, null, 200, "OK", headers, baseStream);
        } catch (Exception e) {
            return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", headers, null);
        }
    }

    private static final class FileInputStreamWithAfd extends java.io.FileInputStream {
        private final AssetFileDescriptor afd;

        FileInputStreamWithAfd(AssetFileDescriptor afd) throws IOException {
            super(afd.getFileDescriptor());
            this.afd = afd;
            long startOffset = afd.getStartOffset();
            if (startOffset > 0) {
                getChannel().position(startOffset);
            }
        }

        void seekTo(long offset) throws IOException {
            long baseOffset = Math.max(0L, afd.getStartOffset());
            FileChannel channel = getChannel();
            channel.position(baseOffset + offset);
        }

        @Override
        public void close() throws IOException {
            try {
                super.close();
            } finally {
                afd.close();
            }
        }
    }

    private static final class BoundedInputStream extends FilterInputStream {
        private long remaining;

        BoundedInputStream(InputStream in, long maxBytes) {
            super(in);
            this.remaining = maxBytes;
        }

        @Override
        public int read() throws IOException {
            if (remaining <= 0) return -1;
            int result = super.read();
            if (result != -1) {
                remaining -= 1;
            }
            return result;
        }

        @Override
        public int read(byte[] b, int off, int len) throws IOException {
            if (remaining <= 0) return -1;
            int toRead = (int) Math.min(len, remaining);
            int count = super.read(b, off, toRead);
            if (count > 0) {
                remaining -= count;
            }
            return count;
        }
    }
}
