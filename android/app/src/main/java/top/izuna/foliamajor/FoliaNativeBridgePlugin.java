package top.izuna.foliamajor;

import android.app.Activity;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.UriPermission;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Build;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import androidx.activity.result.ActivityResult;
import androidx.annotation.Nullable;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.documentfile.provider.DocumentFile;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.Map;
import java.util.zip.GZIPInputStream;
import java.util.zip.InflaterInputStream;
import java.lang.ref.WeakReference;
import java.security.MessageDigest;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

/**
 * Capacitor plugin providing Storage Access Framework (SAF) folder/file import with persisted URI
 * permissions, fast DocumentsContract tree scanning, native off-thread metadata/artwork extraction,
 * bounded byte-slice reading, sidecar lyric discovery (.ttml, .lrc, .vtt, .qrc, .yrc, .krc, .fia),
 * AndroidX Media3 playback service control, and AndroidX WindowInsetsControllerCompat system bar visibility.
 */
@CapacitorPlugin(name = "FoliaNativeBridge")
public class FoliaNativeBridgePlugin extends Plugin {
    private static WeakReference<FoliaNativeBridgePlugin> activeInstanceRef = new WeakReference<>(null);
    // Dedicated fast executor for foreground playback readability checks & path resolution so
    // background library scanning or metadata hydration never blocks track switching.
    private final ExecutorService playbackExecutor = Executors.newFixedThreadPool(2);
    private final ExecutorService ioExecutor = Executors.newFixedThreadPool(4);

    private static final String[] TREE_PROJECTION = new String[] {
        DocumentsContract.Document.COLUMN_DOCUMENT_ID,
        DocumentsContract.Document.COLUMN_DISPLAY_NAME,
        DocumentsContract.Document.COLUMN_MIME_TYPE,
        DocumentsContract.Document.COLUMN_SIZE,
        DocumentsContract.Document.COLUMN_LAST_MODIFIED
    };

    @Override
    public void load() {
        super.load();
        activeInstanceRef = new WeakReference<>(this);
    }

    public static void dispatchMediaAction(String action, @Nullable Long seekTimeMs) {
        FoliaNativeBridgePlugin instance = activeInstanceRef.get();
        if (instance == null) return;
        JSObject data = new JSObject();
        data.put("action", action);
        if (seekTimeMs != null) {
            data.put("seekTimeMs", seekTimeMs);
        }
        instance.notifyListeners("mediaAction", data, true);
    }


    private static boolean isAllowedLyricProxyHost(@Nullable String hostname) {
        if (hostname == null || hostname.isEmpty()) return false;
        String host = hostname.toLowerCase(Locale.ROOT);
        return "qq.com".equals(host)
            || host.endsWith(".qq.com")
            || "y.gtimg.cn".equals(host)
            || "kugou.com".equals(host)
            || host.endsWith(".kugou.com")
            || "kgimg.com".equals(host)
            || host.endsWith(".kgimg.com")
            || "api.amll.dev".equals(host)
            || "163.com".equals(host)
            || host.endsWith(".163.com")
            || "lrclib.net".equals(host);
    }

    /**
     * Native HTTP/HTTPS relay for online lyric providers (matching Electron's proxyLyricRequest in
     * electron/main.cjs) so Android WebView can query QQ Music, KuGou, AMLL TTML DB, and NetEase
     * lyric endpoints without browser CORS or HTTP mixed-content blocks.
     */
    @PluginMethod
    public void fetchLyricProxy(PluginCall call) {
        final String targetUrlStr = call.getString("url");
        if (targetUrlStr == null || targetUrlStr.trim().isEmpty()) {
            call.reject("Missing url parameter");
            return;
        }
        final String method = call.getString("method", "GET");
        final JSObject reqHeaders = call.getObject("headers", new JSObject());
        final String reqBody = call.getString("body");
        final Integer timeoutParam = call.getInt("timeoutMs", 8000);
        final int timeoutMs = Math.max(1500, Math.min(15000, timeoutParam != null ? timeoutParam : 8000));

        ioExecutor.execute(() -> {
            HttpURLConnection conn = null;
            try {
                URL targetUrl = new URL(targetUrlStr.trim());
                String host = targetUrl.getHost();
                if (!isAllowedLyricProxyHost(host)) {
                    call.reject("Forbidden lyric proxy host: " + host);
                    return;
                }

                conn = (HttpURLConnection) targetUrl.openConnection();
                conn.setInstanceFollowRedirects(true);
                conn.setConnectTimeout(timeoutMs);
                conn.setReadTimeout(timeoutMs);
                String upperMethod = method != null ? method.toUpperCase(Locale.ROOT) : "GET";
                conn.setRequestMethod(upperMethod);

                if (reqHeaders != null) {
                    Iterator<String> keys = reqHeaders.keys();
                    while (keys.hasNext()) {
                        String key = keys.next();
                        if (key == null) continue;
                        String lowerKey = key.toLowerCase(Locale.ROOT);
                        if ("host".equals(lowerKey)
                            || "connection".equals(lowerKey)
                            || "content-length".equals(lowerKey)
                            || "origin".equals(lowerKey)
                            || "referer".equals(lowerKey)) {
                            continue;
                        }
                        String val = reqHeaders.getString(key);
                        if (val != null) {
                            conn.setRequestProperty(key, val);
                        }
                    }
                }
                if (host != null && (host.equals("163.com") || host.endsWith(".163.com"))) {
                    conn.setRequestProperty("Referer", "https://music.163.com");
                }

                if (reqBody != null && !reqBody.isEmpty() && ("POST".equals(upperMethod) || "PUT".equals(upperMethod))) {
                    conn.setDoOutput(true);
                    byte[] bodyBytes = reqBody.getBytes(StandardCharsets.UTF_8);
                    conn.setFixedLengthStreamingMode(bodyBytes.length);
                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(bodyBytes);
                        os.flush();
                    }
                }

                int status = conn.getResponseCode();
                String statusText = conn.getResponseMessage();
                InputStream rawStream = status >= 400 ? conn.getErrorStream() : conn.getInputStream();
                String bodyText = "";
                if (rawStream != null) {
                    String contentEncoding = conn.getContentEncoding();
                    InputStream decodedStream = rawStream;
                    if (contentEncoding != null) {
                        String lowerEnc = contentEncoding.toLowerCase(Locale.ROOT);
                        if (lowerEnc.contains("gzip")) {
                            decodedStream = new GZIPInputStream(rawStream);
                        } else if (lowerEnc.contains("deflate")) {
                            decodedStream = new InflaterInputStream(rawStream);
                        }
                    }
                    try (InputStream in = decodedStream; ByteArrayOutputStream baos = new ByteArrayOutputStream(16384)) {
                        byte[] buf = new byte[8192];
                        int read;
                        while ((read = in.read(buf)) != -1) {
                            baos.write(buf, 0, read);
                        }
                        bodyText = new String(baos.toByteArray(), StandardCharsets.UTF_8);
                    }
                }

                JSObject respHeaders = new JSObject();
                Map<String, List<String>> headerFields = conn.getHeaderFields();
                if (headerFields != null) {
                    for (Map.Entry<String, List<String>> entry : headerFields.entrySet()) {
                        if (entry.getKey() != null && entry.getValue() != null && !entry.getValue().isEmpty()) {
                            respHeaders.put(entry.getKey().toLowerCase(Locale.ROOT), entry.getValue().get(0));
                        }
                    }
                }

                JSObject result = new JSObject();
                result.put("ok", status >= 200 && status < 300);
                result.put("status", status);
                result.put("statusText", statusText != null ? statusText : "");
                result.put("headers", respHeaders);
                result.put("bodyText", bodyText);
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Native lyric proxy request failed: " + e.getMessage(), e);
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        });
    }

    @PluginMethod
    public void minimizeApp(PluginCall call) {
        Activity activity = getActivity();
        if (activity != null) {
            activity.runOnUiThread(() -> activity.moveTaskToBack(true));
        }
        call.resolve();
    }

    /**
     * Controls native Android status bar and navigation bar visibility using AndroidX
     * WindowInsetsControllerCompat with BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE.
     */
    @PluginMethod
    public void setSystemBarsVisibility(PluginCall call) {
        final boolean hideStatusBar = Boolean.TRUE.equals(call.getBoolean("hideStatusBar", false));
        final boolean hideNavigationBar = Boolean.TRUE.equals(call.getBoolean("hideNavigationBar", false));
        Activity activity = getActivity();
        if (activity instanceof MainActivity) {
            ((MainActivity) activity).applySystemBarsConfig(hideStatusBar, hideNavigationBar);
            JSObject res = new JSObject();
            res.put("supported", true);
            res.put("hideStatusBar", hideStatusBar);
            res.put("hideNavigationBar", hideNavigationBar);
            res.put("behavior", "SHOW_TRANSIENT_BARS_BY_SWIPE");
            call.resolve(res);
            return;
        }
        if (activity != null) {
            activity.runOnUiThread(() -> {
                Window window = activity.getWindow();
                if (window != null && window.getDecorView() != null) {
                    View decorView = window.getDecorView();
                    WindowCompat.setDecorFitsSystemWindows(window, false);
                    WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, decorView);
                    if (controller != null) {
                        controller.setSystemBarsBehavior(
                            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                        );
                        if (hideStatusBar) {
                            controller.hide(WindowInsetsCompat.Type.statusBars());
                        } else {
                            controller.show(WindowInsetsCompat.Type.statusBars());
                        }
                        if (hideNavigationBar) {
                            controller.hide(WindowInsetsCompat.Type.navigationBars());
                        } else {
                            controller.show(WindowInsetsCompat.Type.navigationBars());
                        }
                    }
                }
            });
            JSObject res = new JSObject();
            res.put("supported", true);
            res.put("hideStatusBar", hideStatusBar);
            res.put("hideNavigationBar", hideNavigationBar);
            res.put("behavior", "SHOW_TRANSIENT_BARS_BY_SWIPE");
            call.resolve(res);
            return;
        }
        JSObject res = new JSObject();
        res.put("supported", false);
        res.put("hideStatusBar", hideStatusBar);
        res.put("hideNavigationBar", hideNavigationBar);
        call.resolve(res);
    }

    @PluginMethod
    public void getSystemBarsVisibility(PluginCall call) {
        Activity activity = getActivity();
        JSObject res = new JSObject();
        if (activity instanceof MainActivity) {
            MainActivity main = (MainActivity) activity;
            res.put("supported", true);
            res.put("hideStatusBar", main.isStatusBarHiddenRequested());
            res.put("hideNavigationBar", main.isNavigationBarHiddenRequested());
            res.put("behavior", "SHOW_TRANSIENT_BARS_BY_SWIPE");
            call.resolve(res);
            return;
        }
        res.put("supported", activity != null);
        res.put("hideStatusBar", false);
        res.put("hideNavigationBar", false);
        res.put("behavior", "SHOW_TRANSIENT_BARS_BY_SWIPE");
        call.resolve(res);
    }

    @PluginMethod
    public void pickDirectory(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION
            | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
            | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION
        );
        startActivityForResult(call, intent, "handlePickDirectoryResult");
    }

    @ActivityCallback
    private void handlePickDirectoryResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            JSObject cancelled = new JSObject();
            cancelled.put("cancelled", true);
            call.resolve(cancelled);
            return;
        }

        Uri treeUri = result.getData().getData();
        Context context = getContext();
        try {
            int takeFlags = Intent.FLAG_GRANT_READ_URI_PERMISSION;
            context.getContentResolver().takePersistableUriPermission(treeUri, takeFlags);
        } catch (SecurityException ignored) {
            // Some providers grant read access for the session without persistable flags.
        }

        DocumentFile treeDoc = DocumentFile.fromTreeUri(context, treeUri);
        String folderName = (treeDoc != null && treeDoc.getName() != null && !treeDoc.getName().isEmpty())
            ? treeDoc.getName()
            : deriveFallbackFolderName(treeUri);
        String documentId = DocumentsContract.getTreeDocumentId(treeUri);

        JSObject response = new JSObject();
        response.put("treeUri", treeUri.toString());
        response.put("name", folderName);
        response.put("documentId", documentId != null ? documentId : "");
        call.resolve(response);
    }

    @PluginMethod
    public void pickAudioFiles(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        String requestedMime = call.getString("mimeType", "*/*");
        intent.setType(requestedMime != null && !requestedMime.isEmpty() ? requestedMime : "*/*");
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION
            | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        );
        startActivityForResult(call, intent, "handlePickAudioFilesResult");
    }

    @ActivityCallback
    private void handlePickAudioFilesResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            JSObject cancelled = new JSObject();
            cancelled.put("cancelled", true);
            call.resolve(cancelled);
            return;
        }

        Intent data = result.getData();
        Context context = getContext();
        ContentResolver resolver = context.getContentResolver();
        JSArray filesArray = new JSArray();

        ClipData clipData = data.getClipData();
        if (clipData != null) {
            for (int i = 0; i < clipData.getItemCount(); i++) {
                Uri uri = clipData.getItemAt(i).getUri();
                if (uri != null) {
                    persistReadPermissionQuietly(resolver, uri);
                    JSObject descriptor = querySingleDocumentUri(resolver, uri);
                    if (descriptor != null) filesArray.put(descriptor);
                }
            }
        } else if (data.getData() != null) {
            Uri uri = data.getData();
            persistReadPermissionQuietly(resolver, uri);
            JSObject descriptor = querySingleDocumentUri(resolver, uri);
            if (descriptor != null) filesArray.put(descriptor);
        }

        JSObject response = new JSObject();
        response.put("rootName", "Selected Music");
        response.put("treeUri", "folia-picked://selected-music");
        response.put("documentId", "selected-music");
        response.put("files", filesArray);
        call.resolve(response);
    }

    @PluginMethod
    public void checkDirectoryPermission(PluginCall call) {
        String rawTreeUri = call.getString("treeUri", "");
        if (rawTreeUri == null || rawTreeUri.isEmpty()) {
            JSObject res = new JSObject();
            res.put("granted", false);
            res.put("exists", false);
            call.resolve(res);
            return;
        }

        Context context = getContext();
        Uri treeUri = Uri.parse(rawTreeUri);
        boolean hasPersisted = false;
        List<UriPermission> permissions = context.getContentResolver().getPersistedUriPermissions();
        for (UriPermission perm : permissions) {
            if (perm.getUri().equals(treeUri) && perm.isReadPermission()) {
                hasPersisted = true;
                break;
            }
        }

        DocumentFile doc = DocumentFile.fromTreeUri(context, treeUri);
        boolean exists = doc != null && doc.exists() && doc.canRead();

        JSObject res = new JSObject();
        res.put("granted", hasPersisted || exists);
        res.put("exists", exists);
        call.resolve(res);
    }

    @PluginMethod
    public void scanDirectoryTree(PluginCall call) {
        final String rawTreeUri = call.getString("treeUri", "");
        final String rootDocIdParam = call.getString("documentId", "");
        if (rawTreeUri == null || rawTreeUri.isEmpty()) {
            JSObject empty = new JSObject();
            empty.put("entries", new JSArray());
            call.resolve(empty);
            return;
        }

        final Context context = getContext();
        ioExecutor.execute(() -> {
            try {
                Uri treeUri = Uri.parse(rawTreeUri);
                String rootDocId = (rootDocIdParam != null && !rootDocIdParam.isEmpty())
                    ? rootDocIdParam
                    : DocumentsContract.getTreeDocumentId(treeUri);

                JSArray entries = new JSArray();
                ContentResolver resolver = context.getContentResolver();
                Set<String> visitedDocs = new HashSet<>();
                Deque<FolderQueueItem> queue = new ArrayDeque<>();
                queue.add(new FolderQueueItem(rootDocId, ""));

                while (!queue.isEmpty()) {
                    FolderQueueItem current = queue.removeFirst();
                    if (current.documentId == null || !visitedDocs.add(current.documentId)) {
                        continue;
                    }

                    Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, current.documentId);
                    try (Cursor cursor = resolver.query(childrenUri, TREE_PROJECTION, null, null, null)) {
                        if (cursor == null) continue;
                        while (cursor.moveToNext()) {
                            String docId = cursor.getString(0);
                            String name = cursor.getString(1);
                            String mimeType = cursor.getString(2);
                            long size = cursor.isNull(3) ? 0L : cursor.getLong(3);
                            long lastModified = cursor.isNull(4) ? 0L : cursor.getLong(4);

                            if (docId == null || name == null || name.isEmpty()) {
                                continue;
                            }

                            String relPath = current.relativePrefix.isEmpty()
                                ? name
                                : (current.relativePrefix + "/" + name);
                            boolean isDirectory = DocumentsContract.Document.MIME_TYPE_DIR.equals(mimeType);
                            Uri contentUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, docId);

                            if (isDirectory) {
                                JSObject dirEntry = new JSObject();
                                dirEntry.put("name", name);
                                dirEntry.put("relativePath", relPath);
                                dirEntry.put("kind", "directory");
                                dirEntry.put("documentId", docId);
                                dirEntry.put("contentUri", contentUri.toString());
                                dirEntry.put("mimeType", mimeType);
                                dirEntry.put("size", 0);
                                dirEntry.put("lastModified", lastModified);
                                entries.put(dirEntry);

                                if (!".foliaignore".equalsIgnoreCase(name)) {
                                    queue.addLast(new FolderQueueItem(docId, relPath));
                                }
                            } else if (isRelevantMusicOrLyricOrCoverFile(name)) {
                                JSObject fileEntry = new JSObject();
                                fileEntry.put("name", name);
                                fileEntry.put("relativePath", relPath);
                                fileEntry.put("kind", "file");
                                fileEntry.put("documentId", docId);
                                fileEntry.put("contentUri", contentUri.toString());
                                fileEntry.put("mimeType", mimeType != null ? mimeType : "application/octet-stream");
                                fileEntry.put("size", size);
                                fileEntry.put("lastModified", lastModified);
                                entries.put(fileEntry);
                            }
                        }
                    } catch (Exception ignored) {
                        // Skip unreadable subdirectory and continue scanning.
                    }
                }

                JSObject result = new JSObject();
                result.put("entries", entries);
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Failed to scan SAF directory tree: " + e.getMessage(), e);
            }
        });
    }

    @PluginMethod
    public void resolveRelativeFile(PluginCall call) {
        final String rawTreeUri = call.getString("treeUri", "");
        final String relativePath = call.getString("relativePath", "");
        if (rawTreeUri == null || rawTreeUri.isEmpty() || relativePath == null || relativePath.isEmpty()) {
            JSObject empty = new JSObject();
            empty.put("entry", JSONObject.NULL);
            call.resolve(empty);
            return;
        }

        final Context context = getContext();
        playbackExecutor.execute(() -> {
            try {
                Uri treeUri = Uri.parse(rawTreeUri);
                ContentResolver resolver = context.getContentResolver();
                String currentDocId = DocumentsContract.getTreeDocumentId(treeUri);
                String[] segments = relativePath.split("/");

                String matchedName = "";
                String matchedMime = "application/octet-stream";
                long matchedSize = 0L;
                long matchedLastModified = 0L;
                boolean matchedIsDir = false;

                for (int i = 0; i < segments.length; i++) {
                    String segment = segments[i];
                    if (segment.isEmpty() || ".".equals(segment)) continue;
                    boolean isLast = (i == segments.length - 1);

                    Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, currentDocId);
                    String nextDocId = null;
                    try (Cursor cursor = resolver.query(childrenUri, TREE_PROJECTION, null, null, null)) {
                        if (cursor != null) {
                            while (cursor.moveToNext()) {
                                String candidateName = cursor.getString(1);
                                if (segment.equals(candidateName)) {
                                    nextDocId = cursor.getString(0);
                                    matchedName = candidateName;
                                    matchedMime = cursor.getString(2);
                                    matchedSize = cursor.isNull(3) ? 0L : cursor.getLong(3);
                                    matchedLastModified = cursor.isNull(4) ? 0L : cursor.getLong(4);
                                    matchedIsDir = DocumentsContract.Document.MIME_TYPE_DIR.equals(matchedMime);
                                    break;
                                }
                            }
                        }
                    }

                    if (nextDocId == null) {
                        currentDocId = null;
                        break;
                    }
                    currentDocId = nextDocId;
                    if (!isLast && !matchedIsDir) {
                        currentDocId = null;
                        break;
                    }
                }

                JSObject res = new JSObject();
                if (currentDocId == null) {
                    res.put("entry", JSONObject.NULL);
                    call.resolve(res);
                    return;
                }

                Uri contentUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, currentDocId);
                JSObject entry = new JSObject();
                entry.put("name", matchedName);
                entry.put("relativePath", relativePath);
                entry.put("kind", matchedIsDir ? "directory" : "file");
                entry.put("documentId", currentDocId);
                entry.put("contentUri", contentUri.toString());
                entry.put("mimeType", matchedMime != null ? matchedMime : "application/octet-stream");
                entry.put("size", matchedSize);
                entry.put("lastModified", matchedLastModified);
                res.put("entry", entry);
                call.resolve(res);
            } catch (Exception e) {
                JSObject res = new JSObject();
                res.put("entry", JSONObject.NULL);
                call.resolve(res);
            }
        });
    }

    @PluginMethod
    public void checkFileReadable(PluginCall call) {
        final String rawContentUri = call.getString("contentUri", "");
        if (rawContentUri == null || rawContentUri.isEmpty()) {
            JSObject res = new JSObject();
            res.put("readable", false);
            call.resolve(res);
            return;
        }

        final Context context = getContext();
        playbackExecutor.execute(() -> {
            JSObject res = new JSObject();
            try {
                Uri uri = Uri.parse(rawContentUri);
                ContentResolver resolver = context.getContentResolver();
                try (Cursor cursor = resolver.query(uri, new String[] {
                    OpenableColumns.SIZE,
                    DocumentsContract.Document.COLUMN_LAST_MODIFIED
                }, null, null, null)) {
                    if (cursor != null && cursor.moveToFirst()) {
                        res.put("readable", true);
                        if (!cursor.isNull(0)) res.put("size", cursor.getLong(0));
                        if (cursor.getColumnCount() > 1 && !cursor.isNull(1)) {
                            res.put("lastModified", cursor.getLong(1));
                        }
                        call.resolve(res);
                        return;
                    }
                }
                try (InputStream is = resolver.openInputStream(uri)) {
                    res.put("readable", is != null);
                }
            } catch (Exception e) {
                res.put("readable", false);
            }
            call.resolve(res);
        });
    }

    @PluginMethod
    public void readFileBase64(PluginCall call) {
        final String rawContentUri = call.getString("contentUri", "");
        final Long offsetParam = call.getLong("offset", 0L);
        final Integer lengthParam = call.getInt("length", -1);
        if (rawContentUri == null || rawContentUri.isEmpty()) {
            call.reject("Missing contentUri");
            return;
        }

        final Context context = getContext();
        ioExecutor.execute(() -> {
            try {
                Uri uri = Uri.parse(rawContentUri);
                ContentResolver resolver = context.getContentResolver();
                long offset = offsetParam != null && offsetParam > 0L ? offsetParam : 0L;
                int maxLength = lengthParam != null && lengthParam > 0 ? lengthParam : -1;

                ByteArrayOutputStream buffer = new ByteArrayOutputStream(maxLength > 0 ? Math.min(maxLength, 262144) : 32768);
                try (InputStream is = resolver.openInputStream(uri)) {
                    if (is == null) {
                        call.reject("Unable to open InputStream for " + rawContentUri);
                        return;
                    }
                    long remainingSkip = offset;
                    while (remainingSkip > 0L) {
                        long skipped = is.skip(remainingSkip);
                        if (skipped <= 0L) {
                            if (is.read() == -1) break;
                            remainingSkip -= 1L;
                        } else {
                            remainingSkip -= skipped;
                        }
                    }

                    byte[] chunk = new byte[16384];
                    int totalRead = 0;
                    while (true) {
                        int toRead = maxLength > 0
                            ? Math.min(chunk.length, maxLength - totalRead)
                            : chunk.length;
                        if (toRead <= 0) break;
                        int read = is.read(chunk, 0, toRead);
                        if (read == -1) break;
                        buffer.write(chunk, 0, read);
                        totalRead += read;
                    }
                }
                byte[] bytes = buffer.toByteArray();
                String encoded = Base64.encodeToString(bytes, Base64.NO_WRAP);
                String mimeType = resolver.getType(uri);

                JSObject res = new JSObject();
                res.put("data", encoded);
                res.put("mimeType", mimeType != null ? mimeType : "application/octet-stream");
                res.put("size", bytes.length);
                res.put("lastModified", System.currentTimeMillis());
                call.resolve(res);
            } catch (Exception e) {
                call.reject("Failed to read file base64: " + e.getMessage(), e);
            }
        });
    }

    @PluginMethod
    public void extractAudioMetadata(PluginCall call) {
        final String rawContentUri = call.getString("contentUri", "");
        final boolean includeCover = Boolean.TRUE.equals(call.getBoolean("includeCover", false));
        final int maxCoverDimension = Math.max(128, call.getInt("maxCoverDimension", 512));

        if (rawContentUri == null || rawContentUri.isEmpty()) {
            call.reject("Missing contentUri");
            return;
        }

        final Context context = getContext();
        ioExecutor.execute(() -> {
            MediaMetadataRetriever retriever = new MediaMetadataRetriever();
            JSObject res = new JSObject();
            try {
                Uri uri = Uri.parse(rawContentUri);
                retriever.setDataSource(context, uri);

                String title = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE);
                String artist = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST);
                String albumArtist = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUMARTIST);
                String album = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM);
                String durationStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
                String bitrateStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_BITRATE);
                String trackStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_CD_TRACK_NUMBER);
                String discStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DISC_NUMBER);
                String yearStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_YEAR);
                String genreStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_GENRE);
                String mimeStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_MIMETYPE);

                if (title != null && !title.trim().isEmpty()) res.put("title", title.trim());
                if (artist != null && !artist.trim().isEmpty()) {
                    res.put("artist", artist.trim());
                } else if (albumArtist != null && !albumArtist.trim().isEmpty()) {
                    res.put("artist", albumArtist.trim());
                }
                if (albumArtist != null && !albumArtist.trim().isEmpty()) {
                    res.put("albumArtist", albumArtist.trim());
                }
                if (album != null && !album.trim().isEmpty()) res.put("album", album.trim());
                if (genreStr != null && !genreStr.trim().isEmpty()) res.put("genre", genreStr.trim());
                if (mimeStr != null && !mimeStr.trim().isEmpty()) res.put("codec", mimeStr.trim());

                long durationMs = parseLeadingLong(durationStr, 0L);
                if (durationMs > 0L) res.put("durationMs", durationMs);

                long bitrate = parseLeadingLong(bitrateStr, 0L);
                if (bitrate > 0L) res.put("bitrate", bitrate);

                int trackNumber = (int) parseLeadingLong(trackStr, 0L);
                if (trackNumber > 0) res.put("trackNumber", trackNumber);

                int discNumber = (int) parseLeadingLong(discStr, 0L);
                if (discNumber > 0) res.put("discNumber", discNumber);

                int year = (int) parseLeadingLong(yearStr, 0L);
                if (year > 0) res.put("year", year);

                if (includeCover) {
                    byte[] rawArt = retriever.getEmbeddedPicture();
                    if (rawArt != null && rawArt.length > 0) {
                        res.put("hasEmbeddedCover", true);
                        EncodedCoverResult coverResult = downscaleCoverIfNeeded(rawArt, maxCoverDimension);
                        if (coverResult != null) {
                            res.put("coverBase64", Base64.encodeToString(coverResult.bytes, Base64.NO_WRAP));
                            res.put("coverMimeType", coverResult.mimeType);
                            res.put("coverAssetId", sha256AssetId(coverResult.bytes));
                        }
                    } else {
                        res.put("hasEmbeddedCover", false);
                    }
                }

                try {
                    FoliaEmbeddedLyricsExtractor.ExtractedLyrics extractedLyrics =
                        FoliaEmbeddedLyricsExtractor.extract(context.getContentResolver(), uri);
                    if (extractedLyrics != null && extractedLyrics.lyrics != null && !extractedLyrics.lyrics.isEmpty()) {
                        res.put("hasEmbeddedLyrics", true);
                        res.put("lyrics", extractedLyrics.lyrics);
                        if (extractedLyrics.translationLyrics != null && !extractedLyrics.translationLyrics.isEmpty()) {
                            res.put("translationLyrics", extractedLyrics.translationLyrics);
                        }
                    } else {
                        res.put("hasEmbeddedLyrics", false);
                    }
                } catch (Exception ignored) {
                    // Ignore lyric extraction error and resolve basic metadata.
                }

                call.resolve(res);
            } catch (Exception e) {
                call.resolve(res);
            } finally {
                try {
                    retriever.release();
                } catch (Exception ignored) {
                    // Ignore release exception.
                }
            }
        });
    }

    @PluginMethod
    public void syncPlaybackState(PluginCall call) {
        Context context = getContext();
        String title = call.getString("title", "Folia");
        String artist = call.getString("artist", "");
        String album = call.getString("album", "");
        String artworkUrl = call.getString("artworkUrl", "");
        Long durationMs = call.getLong("durationMs", 0L);
        Long positionMs = call.getLong("positionMs", 0L);
        Boolean isPlaying = call.getBoolean("isPlaying", false);
        Float speed = call.getFloat("playbackSpeed", 1.0f);

        Intent serviceIntent = new Intent(context, FoliaPlaybackService.class);
        serviceIntent.setAction(FoliaPlaybackService.ACTION_UPDATE_STATE);
        serviceIntent.putExtra(FoliaPlaybackService.EXTRA_TITLE, title);
        serviceIntent.putExtra(FoliaPlaybackService.EXTRA_ARTIST, artist);
        serviceIntent.putExtra(FoliaPlaybackService.EXTRA_ALBUM, album);
        serviceIntent.putExtra(FoliaPlaybackService.EXTRA_ARTWORK_URL, artworkUrl);
        serviceIntent.putExtra(FoliaPlaybackService.EXTRA_DURATION_MS, durationMs != null ? durationMs : 0L);
        serviceIntent.putExtra(FoliaPlaybackService.EXTRA_POSITION_MS, positionMs != null ? positionMs : 0L);
        serviceIntent.putExtra(FoliaPlaybackService.EXTRA_IS_PLAYING, isPlaying != null && isPlaying);
        serviceIntent.putExtra(FoliaPlaybackService.EXTRA_PLAYBACK_SPEED, speed != null ? speed : 1.0f);

        try {
            if (Boolean.TRUE.equals(isPlaying) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to start FoliaPlaybackService: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void stopPlaybackService(PluginCall call) {
        Context context = getContext();
        Intent serviceIntent = new Intent(context, FoliaPlaybackService.class);
        serviceIntent.setAction(FoliaPlaybackService.ACTION_STOP_SERVICE);
        try {
            context.startService(serviceIntent);
        } catch (Exception ignored) {
            // Service may not be running yet.
        }
        call.resolve();
    }

    private static long parseLeadingLong(@Nullable String raw, long fallback) {
        if (raw == null || raw.isEmpty()) return fallback;
        String trimmed = raw.trim();
        int slashIdx = trimmed.indexOf('/');
        if (slashIdx > 0) {
            trimmed = trimmed.substring(0, slashIdx).trim();
        }
        try {
            return Long.parseLong(trimmed);
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    @Nullable
    private static EncodedCoverResult downscaleCoverIfNeeded(byte[] rawBytes, int maxDimension) {
        try {
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(rawBytes, 0, rawBytes.length, bounds);
            int width = bounds.outWidth;
            int height = bounds.outHeight;
            String outMime = bounds.outMimeType != null ? bounds.outMimeType : "image/jpeg";

            if (width <= 0 || height <= 0) {
                return new EncodedCoverResult(rawBytes, outMime);
            }
            if (width <= maxDimension && height <= maxDimension && rawBytes.length <= 350_000) {
                return new EncodedCoverResult(rawBytes, outMime);
            }

            int sampleSize = 1;
            int maxSide = Math.max(width, height);
            while ((maxSide / (sampleSize * 2)) >= maxDimension) {
                sampleSize *= 2;
            }

            BitmapFactory.Options decodeOpts = new BitmapFactory.Options();
            decodeOpts.inSampleSize = sampleSize;
            decodeOpts.inPreferredConfig = Bitmap.Config.RGB_565;
            Bitmap decoded = BitmapFactory.decodeByteArray(rawBytes, 0, rawBytes.length, decodeOpts);
            if (decoded == null) {
                return new EncodedCoverResult(rawBytes, outMime);
            }

            Bitmap target = decoded;
            int decodedMax = Math.max(decoded.getWidth(), decoded.getHeight());
            if (decodedMax > maxDimension) {
                float scale = (float) maxDimension / (float) decodedMax;
                int scaledW = Math.max(1, Math.round(decoded.getWidth() * scale));
                int scaledH = Math.max(1, Math.round(decoded.getHeight() * scale));
                Bitmap scaled = Bitmap.createScaledBitmap(decoded, scaledW, scaledH, true);
                if (scaled != decoded) {
                    decoded.recycle();
                    target = scaled;
                }
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream(65536);
            target.compress(Bitmap.CompressFormat.JPEG, 84, out);
            target.recycle();
            return new EncodedCoverResult(out.toByteArray(), "image/jpeg");
        } catch (Exception ignored) {
            return new EncodedCoverResult(rawBytes, "image/jpeg");
        }
    }

    private static String sha256AssetId(byte[] bytes) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(bytes);
            StringBuilder sb = new StringBuilder("sha256:");
            for (byte b : digest) {
                sb.append(String.format(Locale.ROOT, "%02x", b & 0xff));
            }
            return sb.toString();
        } catch (Exception ignored) {
            return "";
        }
    }

    private static final class EncodedCoverResult {
        final byte[] bytes;
        final String mimeType;

        EncodedCoverResult(byte[] bytes, String mimeType) {
            this.bytes = bytes;
            this.mimeType = mimeType;
        }
    }

    private static boolean isRelevantMusicOrLyricOrCoverFile(String fileName) {
        String lower = fileName.toLowerCase(Locale.ROOT);
        if (".foliaignore".equals(lower)
            || "cover.png".equals(lower)
            || "cover.jpg".equals(lower)
            || "cover.jpeg".equals(lower)) {
            return true;
        }
        return lower.endsWith(".mp3")
            || lower.endsWith(".flac")
            || lower.endsWith(".m4a")
            || lower.endsWith(".wav")
            || lower.endsWith(".ogg")
            || lower.endsWith(".opus")
            || lower.endsWith(".aac")
            || lower.endsWith(".lrc")
            || lower.endsWith(".vtt")
            || lower.endsWith(".ttml")
            || lower.endsWith(".qrc")
            || lower.endsWith(".yrc")
            || lower.endsWith(".krc")
            || lower.endsWith(".fia")
            || lower.endsWith(".mp4")
            || lower.endsWith(".webm")
            || lower.endsWith(".mkv")
            || lower.endsWith(".m4v")
            || lower.endsWith(".mov")
            || lower.endsWith(".3gp");
    }

    private static void persistReadPermissionQuietly(ContentResolver resolver, Uri uri) {
        try {
            resolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (SecurityException ignored) {
            // Ignore if provider does not support persistable permissions for single files.
        }
    }

    @Nullable
    private static JSObject querySingleDocumentUri(ContentResolver resolver, Uri uri) {
        String displayName = null;
        long size = 0L;
        try (Cursor cursor = resolver.query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                int sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (nameIndex >= 0) displayName = cursor.getString(nameIndex);
                if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) size = cursor.getLong(sizeIndex);
            }
        } catch (Exception ignored) {
            return null;
        }
        if (displayName == null || displayName.isEmpty() || !isRelevantMusicOrLyricOrCoverFile(displayName)) {
            return null;
        }
        String mimeType = resolver.getType(uri);
        JSObject item = new JSObject();
        item.put("name", displayName);
        item.put("relativePath", displayName);
        item.put("kind", "file");
        item.put("documentId", uri.toString());
        item.put("contentUri", uri.toString());
        item.put("mimeType", mimeType != null ? mimeType : "application/octet-stream");
        item.put("size", size);
        item.put("lastModified", System.currentTimeMillis());
        return item;
    }

    private static String deriveFallbackFolderName(Uri treeUri) {
        try {
            String docId = DocumentsContract.getTreeDocumentId(treeUri);
            if (docId != null) {
                int colon = docId.lastIndexOf(':');
                String tail = colon >= 0 ? docId.substring(colon + 1) : docId;
                int slash = tail.lastIndexOf('/');
                String name = slash >= 0 ? tail.substring(slash + 1) : tail;
                if (!name.isEmpty()) return name;
            }
        } catch (Exception ignored) {
            // Fall through.
        }
        return "Music";
    }

    private static final class FolderQueueItem {
        final String documentId;
        final String relativePrefix;

        FolderQueueItem(String documentId, String relativePrefix) {
            this.documentId = documentId;
            this.relativePrefix = relativePrefix;
        }
    }
}
