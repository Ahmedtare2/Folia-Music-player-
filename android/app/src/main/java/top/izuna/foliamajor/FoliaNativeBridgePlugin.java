package top.izuna.foliamajor;

import android.app.Activity;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.UriPermission;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
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
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.ref.WeakReference;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.zip.GZIPInputStream;
import java.util.zip.InflaterInputStream;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Capacitor plugin providing Storage Access Framework (SAF) folder/file import with persisted URI
 * permissions, fast DocumentsContract tree scanning, native off-thread metadata/artwork extraction,
 * persistent internal disk caching (context.getFilesDir()/media_cache/{covers,lyrics,palettes,index}),
 * 256x256 + 1024x1024 WebP cover mipmap generation & native Monet/palette color extraction,
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

    public static final String MEDIA_CACHE_ROOT_DIR = "folia_media_cache";
    public static final String LEGACY_MEDIA_CACHE_ROOT_DIR = "media_cache";
    public static final String CACHE_NAMESPACE_COVERS = "covers";
    public static final String CACHE_NAMESPACE_LYRICS = "lyrics";
    public static final String CACHE_NAMESPACE_PALETTES = "palettes";
    public static final String CACHE_NAMESPACE_INDEX = "index";
    @Nullable
    private static volatile PaletteIndexSqliteHelper paletteDbHelper = null;

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
        Context context = getContext();
        if (context != null) {
            ioExecutor.execute(() -> ensureMediaCacheDirectories(context));
        }
    }

    public static void ensureMediaCacheDirectories(Context context) {
        if (context == null) return;
        File root = new File(context.getFilesDir(), MEDIA_CACHE_ROOT_DIR);
        new File(root, CACHE_NAMESPACE_COVERS).mkdirs();
        new File(root, CACHE_NAMESPACE_LYRICS).mkdirs();
        new File(root, CACHE_NAMESPACE_PALETTES).mkdirs();
        new File(root, CACHE_NAMESPACE_INDEX).mkdirs();
        getPaletteDbHelper(context);
    }

    @Nullable
    private static PaletteIndexSqliteHelper getPaletteDbHelper(@Nullable Context context) {
        if (context == null) return null;
        if (paletteDbHelper == null) {
            synchronized (FoliaNativeBridgePlugin.class) {
                if (paletteDbHelper == null) {
                    File indexDir = getMediaCacheNamespaceDir(context.getApplicationContext(), CACHE_NAMESPACE_INDEX);
                    File dbFile = new File(indexDir, "palette_cache.db");
                    paletteDbHelper = new PaletteIndexSqliteHelper(context.getApplicationContext(), dbFile.getAbsolutePath());
                }
            }
        }
        return paletteDbHelper;
    }

    public static File getMediaCacheNamespaceDir(Context context, String namespace) {
        String safeNamespace;
        if (CACHE_NAMESPACE_COVERS.equals(namespace)
            || CACHE_NAMESPACE_LYRICS.equals(namespace)
            || CACHE_NAMESPACE_PALETTES.equals(namespace)
            || CACHE_NAMESPACE_INDEX.equals(namespace)) {
            safeNamespace = namespace;
        } else {
            safeNamespace = CACHE_NAMESPACE_LYRICS;
        }
        File dir = new File(new File(context.getFilesDir(), MEDIA_CACHE_ROOT_DIR), safeNamespace);
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return dir;
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

    public static void dispatchPlaybackClockAnchor(FoliaPlaybackService.PlaybackClockSnapshot snapshot) {
        if (snapshot == null || !MainActivity.isMainActivityForegroundVisible()) {
            return;
        }
        FoliaNativeBridgePlugin instance = activeInstanceRef.get();
        if (instance == null) return;
        JSObject data = new JSObject();
        data.put("trackId", snapshot.trackId);
        data.put("positionMs", snapshot.positionMs);
        data.put("durationMs", snapshot.durationMs);
        data.put("bufferedPositionMs", snapshot.bufferedPositionMs);
        data.put("elapsedRealtimeMs", snapshot.elapsedRealtimeMs);
        data.put("isPlaying", snapshot.isPlaying);
        data.put("playbackSpeed", snapshot.playbackSpeed);
        data.put("playbackState", snapshot.playbackState);
        data.put("ended", snapshot.ended);
        data.put("reason", snapshot.reason);
        instance.notifyListeners("playbackClockAnchor", data, true);
    }

    public static void dispatchDisplayRefreshRateChanged(float refreshRateHz) {
        FoliaNativeBridgePlugin instance = activeInstanceRef.get();
        if (instance == null) return;
        float safeHz = (Float.isNaN(refreshRateHz) || Float.isInfinite(refreshRateHz) || refreshRateHz < 30.0f)
            ? 60.0f
            : Math.min(240.0f, refreshRateHz);
        int roundedHz = Math.round(safeHz);
        JSObject data = new JSObject();
        data.put("refreshRate", roundedHz);
        data.put("rawRefreshRate", safeHz);
        data.put("vsyncIntervalMs", 1000.0f / safeHz);
        instance.notifyListeners("displayRefreshRateChanged", data, true);
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

    /**
     * Reads a serialized JSON payload from context.getFilesDir()/media_cache/<namespace>/<safeKey>.json.
     */
    @PluginMethod
    public void readDiskCacheJson(PluginCall call) {
        final String namespace = call.getString("namespace", CACHE_NAMESPACE_LYRICS);
        final String key = call.getString("key", "");
        if (key == null || key.trim().isEmpty()) {
            JSObject miss = new JSObject();
            miss.put("hit", false);
            call.resolve(miss);
            return;
        }
        final Context context = getContext();
        playbackExecutor.execute(() -> {
            JSObject res = new JSObject();
            try {
                File dir = getMediaCacheNamespaceDir(context, namespace != null ? namespace : CACHE_NAMESPACE_LYRICS);
                File target = new File(dir, toSafeDiskCacheFileName(key) + ".json");
                if (!target.exists() || !target.isFile() || target.length() <= 0L) {
                    res.put("hit", false);
                    call.resolve(res);
                    return;
                }
                String json = readUtf8File(target);
                if (json == null || json.isEmpty()) {
                    res.put("hit", false);
                    call.resolve(res);
                    return;
                }
                res.put("hit", true);
                res.put("json", json);
                call.resolve(res);
            } catch (Exception e) {
                res.put("hit", false);
                call.resolve(res);
            }
        });
    }

    /**
     * Atomically writes a serialized JSON payload into context.getFilesDir()/media_cache/<namespace>/<safeKey>.json.
     */
    @PluginMethod
    public void writeDiskCacheJson(PluginCall call) {
        final String namespace = call.getString("namespace", CACHE_NAMESPACE_LYRICS);
        final String key = call.getString("key", "");
        final String json = call.getString("json", "");
        if (key == null || key.trim().isEmpty() || json == null) {
            call.reject("Missing key or json parameter");
            return;
        }
        final Context context = getContext();
        ioExecutor.execute(() -> {
            JSObject res = new JSObject();
            try {
                File dir = getMediaCacheNamespaceDir(context, namespace != null ? namespace : CACHE_NAMESPACE_LYRICS);
                File target = new File(dir, toSafeDiskCacheFileName(key) + ".json");
                byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
                writeFileAtomically(target, bytes);
                res.put("ok", true);
                res.put("size", bytes.length);
                call.resolve(res);
            } catch (Exception e) {
                res.put("ok", false);
                call.resolve(res);
            }
        });
    }

    /**
     * Deletes a specific cache entry or clears an entire namespace inside context.getFilesDir()/media_cache/.
     */
    @PluginMethod
    public void deleteDiskCacheEntry(PluginCall call) {
        final String namespace = call.getString("namespace", CACHE_NAMESPACE_LYRICS);
        final String key = call.getString("key", "");
        final Context context = getContext();
        ioExecutor.execute(() -> {
            JSObject res = new JSObject();
            try {
                File dir = getMediaCacheNamespaceDir(context, namespace != null ? namespace : CACHE_NAMESPACE_LYRICS);
                if (key == null || key.trim().isEmpty() || "*".equals(key.trim())) {
                    File[] files = dir.listFiles();
                    if (files != null) {
                        for (File f : files) {
                            if (f.isFile()) {
                                //noinspection ResultOfMethodCallIgnored
                                f.delete();
                            }
                        }
                    }
                } else {
                    String safeName = toSafeDiskCacheFileName(key);
                    File target = new File(dir, safeName + ".json");
                    if (target.exists()) {
                        //noinspection ResultOfMethodCallIgnored
                        target.delete();
                    }
                    if (CACHE_NAMESPACE_COVERS.equals(namespace)) {
                        String digest = extractHexDigest(key);
                        if (digest != null) {
                            //noinspection ResultOfMethodCallIgnored
                            new File(dir, digest + "_256.webp").delete();
                            //noinspection ResultOfMethodCallIgnored
                            new File(dir, digest + "_1024.webp").delete();
                        }
                    }
                }
                res.put("ok", true);
            } catch (Exception ignored) {
                res.put("ok", false);
            }
            call.resolve(res);
        });
    }

    /**
     * Returns byte usage and file counts for context.getFilesDir()/media_cache/{covers,lyrics,palettes,index}.
     */
    @PluginMethod
    public void getDiskCacheStats(PluginCall call) {
        final Context context = getContext();
        ioExecutor.execute(() -> {
            JSObject res = new JSObject();
            long coversBytes = computeDirBytes(getMediaCacheNamespaceDir(context, CACHE_NAMESPACE_COVERS));
            long lyricsBytes = computeDirBytes(getMediaCacheNamespaceDir(context, CACHE_NAMESPACE_LYRICS));
            long palettesBytes = computeDirBytes(getMediaCacheNamespaceDir(context, CACHE_NAMESPACE_PALETTES));
            long indexBytes = computeDirBytes(getMediaCacheNamespaceDir(context, CACHE_NAMESPACE_INDEX));
            res.put("coversBytes", coversBytes);
            res.put("lyricsBytes", lyricsBytes);
            res.put("palettesBytes", palettesBytes);
            res.put("indexBytes", indexBytes);
            res.put("totalBytes", coversBytes + lyricsBytes + palettesBytes + indexBytes);
            call.resolve(res);
        });
    }

    /**
     * Writes 256x256 WebP (for grids/Bravais lattice walls) and 1024x1024 WebP (for the player)
     * into context.getFilesDir()/media_cache/covers/ and persists the extracted vibrant &
     * representative color palettes in context.getFilesDir()/media_cache/palettes/<digest>.json.
     */
    @PluginMethod
    public void getCachedTrackPalette(PluginCall call) {
        final String trackId = call.getString("trackId", "");
        final String albumId = call.getString("albumId", "");
        final String contentUri = call.getString("contentUri", "");
        final String assetId = call.getString("assetId", "");
        final boolean applyToVisualizer = Boolean.TRUE.equals(call.getBoolean("applyToVisualizer", false));
        final Integer transitionParam = call.getInt("transitionMs", 900);
        final int transitionMs = transitionParam != null ? Math.max(0, Math.min(5000, transitionParam)) : 900;
        final Context context = getContext();

        ioExecutor.execute(() -> {
            CoverMipmapAndPaletteResult hit = lookupPaletteAndCoversByKeys(
                context,
                contentUri,
                trackId,
                albumId,
                assetId
            );
            if (hit == null) {
                JSObject miss = new JSObject();
                miss.put("ok", false);
                miss.put("hit", false);
                call.resolve(miss);
                return;
            }
            if (applyToVisualizer) {
                FoliaBackgroundSurfaceView surfaceView = resolveBackgroundSurfaceView();
                if (surfaceView != null && !hit.vibrantColors.isEmpty()) {
                    List<String> combined = new ArrayList<>(hit.vibrantColors);
                    for (String rep : hit.representativeColors) {
                        if (combined.size() >= 6) break;
                        if (!combined.contains(rep)) combined.add(rep);
                    }
                    surfaceView.setVisualizerPalette(combined.toArray(new String[0]), transitionMs);
                }
            }
            JSObject out = hit.toJSObject();
            out.put("hit", true);
            call.resolve(out);
        });
    }

    @PluginMethod
    public void cacheCoverAndExtractPalette(PluginCall call) {
        final String assetIdParam = call.getString("assetId", "");
        final String trackIdParam = call.getString("trackId", "");
        final String albumIdParam = call.getString("albumId", "");
        final String dataBase64 = call.getString("dataBase64", "");
        final String contentUriStr = call.getString("contentUri", "");
        final Context context = getContext();

        ioExecutor.execute(() -> {
            try {
                CoverMipmapAndPaletteResult existingByKey = lookupPaletteAndCoversByKeys(
                    context,
                    contentUriStr,
                    trackIdParam,
                    albumIdParam,
                    assetIdParam
                );
                if (existingByKey != null) {
                    indexPaletteAndCoversForKeys(
                        context,
                        existingByKey,
                        contentUriStr,
                        trackIdParam,
                        albumIdParam
                    );
                    call.resolve(existingByKey.toJSObject());
                    return;
                }

                byte[] rawBytes = null;
                if (dataBase64 != null && !dataBase64.isEmpty()) {
                    String clean = dataBase64.replaceFirst("^data:[^;]+;base64,", "");
                    rawBytes = Base64.decode(clean, Base64.DEFAULT);
                } else if (contentUriStr != null && !contentUriStr.isEmpty()) {
                    Uri uri = Uri.parse(contentUriStr);
                    try (InputStream is = context.getContentResolver().openInputStream(uri);
                         ByteArrayOutputStream baos = new ByteArrayOutputStream(65536)) {
                        if (is != null) {
                            byte[] buf = new byte[16384];
                            int r;
                            while ((r = is.read(buf)) != -1) {
                                baos.write(buf, 0, r);
                            }
                            rawBytes = baos.toByteArray();
                        }
                    }
                }

                if (rawBytes == null || rawBytes.length == 0) {
                    JSObject empty = new JSObject();
                    empty.put("ok", false);
                    call.resolve(empty);
                    return;
                }

                String assetId = (assetIdParam != null && assetIdParam.startsWith("sha256:") && assetIdParam.length() == 71)
                    ? assetIdParam.toLowerCase(Locale.ROOT)
                    : sha256AssetId(rawBytes);
                CoverMipmapAndPaletteResult result = ensureCoverMipmapsAndPaletteOnDisk(context, assetId, rawBytes);
                if (result != null) {
                    indexPaletteAndCoversForKeys(
                        context,
                        result,
                        contentUriStr,
                        trackIdParam,
                        albumIdParam
                    );
                    call.resolve(result.toJSObject());
                } else {
                    JSObject empty = new JSObject();
                    empty.put("ok", false);
                    call.resolve(empty);
                }
            } catch (Exception e) {
                JSObject err = new JSObject();
                err.put("ok", false);
                call.resolve(err);
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
                                if (size > 0L) {
                                    FoliaSafStreamHandler.cacheResolvedSize(contentUri.toString(), size);
                                }
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

    /**
     * Pre-stages the currently playing and next queued local SAF audio tracks into
     * context.getCacheDir()/saf_audio_stage/ using a 512 KB buffer so playback reads from a
     * contiguous local file instead of making hundreds of SAF ContentProvider IPC calls.
     */
    @PluginMethod
    public void prestageSafAudioTracks(PluginCall call) {
        final JSArray urisArray = call.getArray("uris");
        final String singleUri = call.getString("contentUri", "");
        final Context context = getContext();
        final List<String> uris = new ArrayList<>();
        if (singleUri != null && !singleUri.trim().isEmpty()) {
            uris.add(singleUri.trim());
        }
        if (urisArray != null) {
            for (int i = 0; i < urisArray.length(); i++) {
                String candidate = urisArray.optString(i, "");
                if (candidate != null && !candidate.trim().isEmpty() && !uris.contains(candidate.trim())) {
                    uris.add(candidate.trim());
                }
            }
        }
        if (uris.isEmpty() || context == null) {
            JSObject empty = new JSObject();
            empty.put("ok", false);
            empty.put("stagedCount", 0);
            call.resolve(empty);
            return;
        }

        playbackExecutor.execute(() -> {
            List<File> stagedFiles = FoliaSafStreamHandler.prestageAudioUris(context, uris);
            JSArray stagedPaths = new JSArray();
            for (File f : stagedFiles) {
                stagedPaths.put(f.getAbsolutePath());
            }
            JSObject res = new JSObject();
            res.put("ok", !stagedFiles.isEmpty());
            res.put("stagedCount", stagedFiles.size());
            res.put("stagedPaths", stagedPaths);
            res.put("cacheDir", FoliaSafStreamHandler.getStagedAudioCacheDir(context).getAbsolutePath());
            call.resolve(res);
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
        final String trackIdParam = call.getString("trackId", "");
        final String albumIdParam = call.getString("albumId", "");
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
                boolean dataSourceSet = false;
                try (android.content.res.AssetFileDescriptor afd = context.getContentResolver().openAssetFileDescriptor(uri, "r")) {
                    if (afd != null && afd.getFileDescriptor() != null) {
                        long startOffset = Math.max(0L, afd.getStartOffset());
                        long declaredLen = afd.getLength();
                        if (declaredLen > 0L) {
                            retriever.setDataSource(afd.getFileDescriptor(), startOffset, declaredLen);
                        } else {
                            retriever.setDataSource(afd.getFileDescriptor());
                        }
                        dataSourceSet = true;
                    }
                } catch (Exception ignored) {
                    // Fall back to context + URI below.
                }
                if (!dataSourceSet) {
                    try {
                        retriever.setDataSource(context, uri);
                        dataSourceSet = true;
                    } catch (Exception ignored) {
                        dataSourceSet = false;
                    }
                }

                FoliaEmbeddedLyricsExtractor.ExtractedLyrics extractedTags = null;
                try {
                    extractedTags = FoliaEmbeddedLyricsExtractor.extract(context, context.getContentResolver(), uri);
                } catch (Exception ignored) {}

                String title = preferCleanTag(
                    dataSourceSet ? retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE) : null,
                    extractedTags != null ? extractedTags.title : null
                );
                String artist = preferCleanTag(
                    dataSourceSet ? retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST) : null,
                    extractedTags != null ? extractedTags.artist : null
                );
                String albumArtist = preferCleanTag(
                    dataSourceSet ? retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUMARTIST) : null,
                    extractedTags != null ? extractedTags.albumArtist : null
                );
                String album = preferCleanTag(
                    dataSourceSet ? retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM) : null,
                    extractedTags != null ? extractedTags.album : null
                );
                String durationStr = dataSourceSet ? retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION) : null;
                String bitrateStr = dataSourceSet ? retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_BITRATE) : null;
                String trackStr = dataSourceSet ? retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_CD_TRACK_NUMBER) : null;
                String discStr = dataSourceSet ? retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DISC_NUMBER) : null;
                String yearStr = dataSourceSet ? retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_YEAR) : null;
                String genreStr = preferCleanTag(
                    dataSourceSet ? retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_GENRE) : null,
                    extractedTags != null ? extractedTags.genre : null
                );
                String mimeStr = dataSourceSet ? retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_MIMETYPE) : null;

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
                if (trackNumber <= 0 && extractedTags != null && extractedTags.trackNumber > 0) {
                    trackNumber = extractedTags.trackNumber;
                }
                if (trackNumber > 0) res.put("trackNumber", trackNumber);

                int discNumber = (int) parseLeadingLong(discStr, 0L);
                if (discNumber > 0) res.put("discNumber", discNumber);

                int year = (int) parseLeadingLong(yearStr, 0L);
                if (year <= 0 && extractedTags != null && extractedTags.year > 0) {
                    year = extractedTags.year;
                }
                if (year > 0) res.put("year", year);

                String resolvedAlbumLookupKey = (albumIdParam != null && !albumIdParam.trim().isEmpty())
                    ? albumIdParam.trim()
                    : ((album != null && !album.trim().isEmpty())
                        ? ("album:" + (albumArtist != null && !albumArtist.trim().isEmpty() ? albumArtist.trim() : (artist != null ? artist.trim() : "")) + "::" + album.trim()).toLowerCase(Locale.ROOT)
                        : "");

                if (includeCover) {
                    // Check persistent SQLite/JSON index in folia_media_cache first so previously scanned
                    // tracks or albums return 256x256 + 1024x1024 WebP paths and RGB palettes with zero CPU bitmap decoding.
                    CoverMipmapAndPaletteResult cachedByLookup = lookupPaletteAndCoversByKeys(
                        context,
                        rawContentUri,
                        trackIdParam,
                        resolvedAlbumLookupKey,
                        null
                    );
                    if (cachedByLookup != null) {
                        res.put("hasEmbeddedCover", true);
                        res.put("coverAssetId", cachedByLookup.assetId);
                        res.put("cover256Path", cachedByLookup.cover256Path);
                        res.put("cover1024Path", cachedByLookup.cover1024Path);
                        JSArray vibrantArr = new JSArray();
                        for (String hex : cachedByLookup.vibrantColors) vibrantArr.put(hex);
                        JSArray repArr = new JSArray();
                        for (String hex : cachedByLookup.representativeColors) repArr.put(hex);
                        res.put("vibrantColors", vibrantArr);
                        res.put("representativeColors", repArr);
                    } else {
                        byte[] rawArt = dataSourceSet ? retriever.getEmbeddedPicture() : null;
                        if (rawArt != null && rawArt.length > 0) {
                            res.put("hasEmbeddedCover", true);
                            EncodedCoverResult coverResult = downscaleCoverIfNeeded(rawArt, maxCoverDimension);
                            if (coverResult != null) {
                                String coverAssetId = sha256AssetId(coverResult.bytes);
                                res.put("coverBase64", Base64.encodeToString(coverResult.bytes, Base64.NO_WRAP));
                                res.put("coverMimeType", coverResult.mimeType);
                                res.put("coverAssetId", coverAssetId);

                                // Extract and persist 256x256 WebP (lists/Bravais grids) + 1024x1024 WebP (player)
                                // and RGB palette colors in folia_media_cache (SQLite + JSON) once on background thread.
                                CoverMipmapAndPaletteResult mipmapResult =
                                    ensureCoverMipmapsAndPaletteOnDisk(context, coverAssetId, rawArt);
                                if (mipmapResult != null) {
                                    indexPaletteAndCoversForKeys(
                                        context,
                                        mipmapResult,
                                        rawContentUri,
                                        trackIdParam,
                                        resolvedAlbumLookupKey
                                    );
                                    res.put("cover256Path", mipmapResult.cover256Path);
                                    res.put("cover1024Path", mipmapResult.cover1024Path);
                                    JSArray vibrantArr = new JSArray();
                                    for (String hex : mipmapResult.vibrantColors) {
                                        vibrantArr.put(hex);
                                    }
                                    JSArray repArr = new JSArray();
                                    for (String hex : mipmapResult.representativeColors) {
                                        repArr.put(hex);
                                    }
                                    res.put("vibrantColors", vibrantArr);
                                    res.put("representativeColors", repArr);
                                }
                            }
                        } else {
                            res.put("hasEmbeddedCover", false);
                        }
                    }
                }

                if (extractedTags != null && extractedTags.lyrics != null && !extractedTags.lyrics.isEmpty()) {
                    res.put("hasEmbeddedLyrics", true);
                    res.put("lyrics", extractedTags.lyrics);
                    if (extractedTags.translationLyrics != null && !extractedTags.translationLyrics.isEmpty()) {
                        res.put("translationLyrics", extractedTags.translationLyrics);
                    }
                } else {
                    res.put("hasEmbeddedLyrics", false);
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
            if (Boolean.TRUE.equals(isPlaying)) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
            } else if (FoliaPlaybackService.isPlaybackActive()) {
                context.startService(serviceIntent);
            }
            call.resolve();
        } catch (Exception e) {
            call.resolve();
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

    @PluginMethod
    public void loadTrack(PluginCall call) {
        Context context = getContext();
        String uri = call.getString("url", call.getString("uri", ""));
        if (uri == null || uri.trim().isEmpty()) {
            call.reject("Missing url/uri for loadTrack");
            return;
        }
        String trackId = call.getString("trackId", "");
        String title = call.getString("title", "Folia");
        String artist = call.getString("artist", "");
        String album = call.getString("album", "");
        String artworkUrl = call.getString("artworkUrl", "");
        boolean autoPlay = Boolean.TRUE.equals(call.getBoolean("autoPlay", true));
        Long startPosParam = call.getLong("startPositionMs", 0L);
        Float volumeParam = call.getFloat("volume", 1.0f);
        Float speedParam = call.getFloat("playbackSpeed", 1.0f);

        long startPositionMs = startPosParam != null ? Math.max(0L, startPosParam) : 0L;
        float volume = volumeParam != null ? Math.max(0f, Math.min(1f, volumeParam)) : 1.0f;
        float playbackSpeed = speedParam != null && speedParam > 0f ? speedParam : 1.0f;

        FoliaPlaybackService.commandLoadTrack(
            context,
            uri.trim(),
            trackId,
            title,
            artist,
            album,
            artworkUrl,
            autoPlay,
            startPositionMs,
            volume,
            playbackSpeed
        );

        JSObject res = new JSObject();
        res.put("ok", true);
        res.put("trackId", trackId != null ? trackId : "");
        res.put("positionMs", startPositionMs);
        res.put("elapsedRealtimeMs", android.os.SystemClock.elapsedRealtime());
        res.put("isPlaying", autoPlay);
        res.put("playbackSpeed", playbackSpeed);
        call.resolve(res);
    }

    @PluginMethod
    public void play(PluginCall call) {
        FoliaPlaybackService.commandPlay(getContext());
        FoliaPlaybackService.PlaybackClockSnapshot snap = FoliaPlaybackService.getPlaybackClockSnapshot();
        JSObject res = new JSObject();
        res.put("ok", true);
        res.put("positionMs", snap.positionMs);
        res.put("durationMs", snap.durationMs);
        res.put("elapsedRealtimeMs", android.os.SystemClock.elapsedRealtime());
        res.put("isPlaying", true);
        res.put("playbackSpeed", snap.playbackSpeed);
        call.resolve(res);
    }

    @PluginMethod
    public void pause(PluginCall call) {
        FoliaPlaybackService.commandPause(getContext());
        FoliaPlaybackService.PlaybackClockSnapshot snap = FoliaPlaybackService.getPlaybackClockSnapshot();
        JSObject res = new JSObject();
        res.put("ok", true);
        res.put("positionMs", snap.positionMs);
        res.put("durationMs", snap.durationMs);
        res.put("elapsedRealtimeMs", android.os.SystemClock.elapsedRealtime());
        res.put("isPlaying", false);
        res.put("playbackSpeed", snap.playbackSpeed);
        call.resolve(res);
    }

    @PluginMethod
    public void seekTo(PluginCall call) {
        Long posParam = call.getLong("positionMs", 0L);
        long positionMs = posParam != null ? Math.max(0L, posParam) : 0L;
        FoliaPlaybackService.commandSeekTo(getContext(), positionMs);
        FoliaPlaybackService.PlaybackClockSnapshot snap = FoliaPlaybackService.getPlaybackClockSnapshot();
        JSObject res = new JSObject();
        res.put("ok", true);
        res.put("positionMs", positionMs);
        res.put("durationMs", snap.durationMs);
        res.put("elapsedRealtimeMs", android.os.SystemClock.elapsedRealtime());
        res.put("isPlaying", snap.isPlaying);
        res.put("playbackSpeed", snap.playbackSpeed);
        call.resolve(res);
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        Float volParam = call.getFloat("volume", 1.0f);
        float volume = volParam != null ? Math.max(0f, Math.min(1f, volParam)) : 1.0f;
        FoliaPlaybackService.commandSetVolume(volume);
        JSObject res = new JSObject();
        res.put("ok", true);
        res.put("volume", volume);
        call.resolve(res);
    }

    @PluginMethod
    public void setPlaybackSpeed(PluginCall call) {
        Float speedParam = call.getFloat("playbackSpeed", call.getFloat("speed", 1.0f));
        float speed = speedParam != null && speedParam > 0f ? Math.max(0.25f, Math.min(4.0f, speedParam)) : 1.0f;
        FoliaPlaybackService.commandSetPlaybackSpeed(speed);
        FoliaPlaybackService.PlaybackClockSnapshot snap = FoliaPlaybackService.getPlaybackClockSnapshot();
        JSObject res = new JSObject();
        res.put("ok", true);
        res.put("positionMs", snap.positionMs);
        res.put("durationMs", snap.durationMs);
        res.put("elapsedRealtimeMs", android.os.SystemClock.elapsedRealtime());
        res.put("isPlaying", snap.isPlaying);
        res.put("playbackSpeed", speed);
        call.resolve(res);
    }

    @PluginMethod
    public void getPlaybackPosition(PluginCall call) {
        FoliaPlaybackService.PlaybackClockSnapshot snap = FoliaPlaybackService.getPlaybackClockSnapshot();
        JSObject res = new JSObject();
        res.put("ok", true);
        res.put("trackId", snap.trackId);
        res.put("positionMs", snap.positionMs);
        res.put("durationMs", snap.durationMs);
        res.put("bufferedPositionMs", snap.bufferedPositionMs);
        res.put("elapsedRealtimeMs", snap.elapsedRealtimeMs);
        res.put("isPlaying", snap.isPlaying);
        res.put("playbackSpeed", snap.playbackSpeed);
        res.put("playbackState", snap.playbackState);
        res.put("ended", snap.ended);
        call.resolve(res);
    }

    @Nullable
    private FoliaBackgroundSurfaceView resolveBackgroundSurfaceView() {
        Activity activity = getActivity();
        if (activity instanceof MainActivity) {
            return ((MainActivity) activity).getBackgroundSurfaceView();
        }
        return null;
    }

    @PluginMethod
    public void getDisplayRefreshRate(PluginCall call) {
        float detectedHz = 60.0f;
        Activity activity = getActivity();
        if (activity instanceof MainActivity) {
            detectedHz = ((MainActivity) activity).queryAndSyncDisplayRefreshRate(false);
        }
        int roundedHz = Math.max(30, Math.min(240, Math.round(detectedHz)));
        JSObject res = new JSObject();
        res.put("refreshRate", roundedHz);
        res.put("rawRefreshRate", detectedHz);
        res.put("vsyncIntervalMs", 1000.0f / Math.max(30.0f, detectedHz));
        call.resolve(res);
    }

    @PluginMethod
    public void setNativeVisualizerState(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", true));
        boolean visible = Boolean.TRUE.equals(call.getBoolean("visible", true));
        Integer fpsParam = call.getInt("fps", 0);
        Integer dividerParam = call.getInt("vsyncDivider", 0);
        Float dimParam = call.getFloat("dim", 0.28f);
        int fps = fpsParam != null ? Math.max(0, Math.min(240, fpsParam)) : 0;
        int vsyncDivider = dividerParam != null ? Math.max(0, Math.min(2, dividerParam)) : 0;
        float dim = dimParam != null ? Math.max(0.0f, Math.min(0.92f, dimParam)) : 0.28f;

        FoliaBackgroundSurfaceView surfaceView = resolveBackgroundSurfaceView();
        float refreshRateHz = 60.0f;
        Activity activity = getActivity();
        if (activity instanceof MainActivity) {
            refreshRateHz = ((MainActivity) activity).getDisplayRefreshRate();
        }
        if (surfaceView != null) {
            surfaceView.onDisplayRefreshRateChanged(refreshRateHz);
            surfaceView.setVisualizerState(enabled, visible, fps, dim, vsyncDivider);
        }

        int effectiveDivider = surfaceView != null
            ? surfaceView.getEffectiveVsyncDivider()
            : (vsyncDivider == 1 ? 1 : 2);
        int effectiveFps = (enabled && visible)
            ? Math.max(15, Math.round(refreshRateHz / (float) effectiveDivider))
            : 0;

        JSObject res = new JSObject();
        res.put("ok", surfaceView != null);
        res.put("enabled", enabled);
        res.put("visible", visible);
        res.put("fps", fps > 0 ? fps : effectiveFps);
        res.put("vsyncDivider", effectiveDivider);
        res.put("refreshRate", Math.round(refreshRateHz));
        res.put("dim", dim);
        call.resolve(res);
    }

    @PluginMethod
    public void setNativeVisualizerPalette(PluginCall call) {
        JSArray colorsArr = call.getArray("colors");
        Integer transitionParam = call.getInt("transitionMs", 900);
        int transitionMs = transitionParam != null ? Math.max(0, Math.min(5000, transitionParam)) : 900;

        List<String> colorList = new ArrayList<>();
        if (colorsArr != null) {
            for (int i = 0; i < colorsArr.length(); i++) {
                String c = colorsArr.optString(i, null);
                if (c != null && !c.trim().isEmpty()) {
                    colorList.add(c.trim());
                }
            }
        }
        String[] hexColors = colorList.toArray(new String[0]);

        FoliaBackgroundSurfaceView surfaceView = resolveBackgroundSurfaceView();
        if (surfaceView != null && hexColors.length > 0) {
            surfaceView.setVisualizerPalette(hexColors, transitionMs);
        }

        JSObject res = new JSObject();
        res.put("ok", surfaceView != null && hexColors.length > 0);
        res.put("colorCount", hexColors.length);
        res.put("transitionMs", transitionMs);
        call.resolve(res);
    }

    @PluginMethod
    public void setNativeVisualizerEnergy(PluginCall call) {
        Float bassParam = call.getFloat("bass", 0.0f);
        Float midParam = call.getFloat("mid", 0.0f);
        Float highParam = call.getFloat("high", 0.0f);
        boolean isPlaying = Boolean.TRUE.equals(call.getBoolean("isPlaying", false));

        float bass = bassParam != null ? bassParam : 0.0f;
        float mid = midParam != null ? midParam : 0.0f;
        float high = highParam != null ? highParam : 0.0f;

        FoliaBackgroundSurfaceView surfaceView = resolveBackgroundSurfaceView();
        if (surfaceView != null) {
            surfaceView.setVisualizerEnergy(bass, mid, high, isPlaying);
        }

        JSObject res = new JSObject();
        res.put("ok", surfaceView != null);
        call.resolve(res);
    }

    @Nullable
    private static String preferCleanTag(@Nullable String primary, @Nullable String fallback) {
        String p = primary != null ? primary.trim() : "";
        String f = fallback != null ? fallback.trim() : "";
        if (p.isEmpty()) return f.isEmpty() ? null : f;
        if (f.isEmpty()) return p;
        // If MediaMetadataRetriever produced Latin-1 mojibake (0x80..0xFF chars) while
        // FoliaEmbeddedLyricsExtractor decoded UTF-8 or Arabic CP1256, prefer the clean tag.
        if (looksLikeLatin1Mojibake(p) && !looksLikeLatin1Mojibake(f)) {
            return f;
        }
        return p;
    }

    private static boolean looksLikeLatin1Mojibake(String s) {
        int latin1High = 0;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c >= 0x0080 && c <= 0x00FF) {
                latin1High++;
            }
        }
        return latin1High >= 2;
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
    private static CoverMipmapAndPaletteResult readExistingCoverMipmapsAndPalette(Context context, String digest) {
        if (context == null || digest == null || digest.length() != 64) return null;
        File coversDir = getMediaCacheNamespaceDir(context, CACHE_NAMESPACE_COVERS);
        File palettesDir = getMediaCacheNamespaceDir(context, CACHE_NAMESPACE_PALETTES);
        File cover256 = new File(coversDir, digest + "_256.webp");
        File cover1024 = new File(coversDir, digest + "_1024.webp");
        File paletteFile = new File(palettesDir, digest + ".json");
        if (!cover256.exists() || !cover1024.exists() || !paletteFile.exists()) {
            return null;
        }
        try {
            String jsonStr = readUtf8File(paletteFile);
            if (jsonStr == null || jsonStr.isEmpty()) return null;
            JSONObject obj = new JSONObject(jsonStr);
            List<String> vibrant = jsonArrayToStringList(obj.optJSONArray("vibrantColors"));
            List<String> representative = jsonArrayToStringList(obj.optJSONArray("representativeColors"));
            if (vibrant.isEmpty() && representative.isEmpty()) return null;
            return new CoverMipmapAndPaletteResult(
                "sha256:" + digest,
                cover256.getAbsolutePath(),
                cover1024.getAbsolutePath(),
                vibrant,
                representative
            );
        } catch (Exception ignored) {
            return null;
        }
    }

    @Nullable
    private static CoverMipmapAndPaletteResult ensureCoverMipmapsAndPaletteOnDisk(
        Context context,
        String assetId,
        byte[] rawArtBytes
    ) {
        if (context == null || rawArtBytes == null || rawArtBytes.length == 0) return null;
        String digest = extractHexDigest(assetId);
        if (digest == null) {
            String computed = sha256AssetId(rawArtBytes);
            digest = extractHexDigest(computed);
            assetId = computed;
        }
        if (digest == null) return null;

        CoverMipmapAndPaletteResult existing = readExistingCoverMipmapsAndPalette(context, digest);
        if (existing != null) {
            return existing;
        }

        File coversDir = getMediaCacheNamespaceDir(context, CACHE_NAMESPACE_COVERS);
        File palettesDir = getMediaCacheNamespaceDir(context, CACHE_NAMESPACE_PALETTES);
        File cover256File = new File(coversDir, digest + "_256.webp");
        File cover1024File = new File(coversDir, digest + "_1024.webp");
        File paletteFile = new File(palettesDir, digest + ".json");

        Bitmap decoded = null;
        try {
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(rawArtBytes, 0, rawArtBytes.length, bounds);
            int width = bounds.outWidth;
            int height = bounds.outHeight;
            if (width <= 0 || height <= 0) {
                return null;
            }

            int sampleSize = 1;
            int maxSide = Math.max(width, height);
            while ((maxSide / (sampleSize * 2)) >= 1024) {
                sampleSize *= 2;
            }

            BitmapFactory.Options decodeOpts = new BitmapFactory.Options();
            decodeOpts.inSampleSize = sampleSize;
            decodeOpts.inPreferredConfig = Bitmap.Config.ARGB_8888;
            decoded = BitmapFactory.decodeByteArray(rawArtBytes, 0, rawArtBytes.length, decodeOpts);
            if (decoded == null) {
                return null;
            }

            if (!cover1024File.exists() || cover1024File.length() <= 0L) {
                byte[] webp1024 = encodeScaledWebp(decoded, 1024, 86);
                if (webp1024 != null && webp1024.length > 0) {
                    writeFileAtomically(cover1024File, webp1024);
                }
            }

            if (!cover256File.exists() || cover256File.length() <= 0L) {
                byte[] webp256 = encodeScaledWebp(decoded, 256, 84);
                if (webp256 != null && webp256.length > 0) {
                    writeFileAtomically(cover256File, webp256);
                }
            }

            List<String> vibrantColors;
            List<String> representativeColors;
            Bitmap sample50 = Bitmap.createScaledBitmap(decoded, 50, 50, true);
            try {
                int[] pixels = new int[50 * 50];
                sample50.getPixels(pixels, 0, 50, 0, 0, 50, 50);
                vibrantColors = extractVibrantHexColors(pixels, 6);
                representativeColors = extractRepresentativeHexColors(pixels, 6);
            } finally {
                if (sample50 != decoded) {
                    sample50.recycle();
                }
            }

            JSONObject paletteJson = new JSONObject();
            paletteJson.put("assetId", "sha256:" + digest);
            paletteJson.put("updatedAt", System.currentTimeMillis());
            JSONArray vibrantArr = new JSONArray();
            for (String c : vibrantColors) vibrantArr.put(c);
            JSONArray repArr = new JSONArray();
            for (String c : representativeColors) repArr.put(c);
            paletteJson.put("vibrantColors", vibrantArr);
            paletteJson.put("representativeColors", repArr);

            if ( paletteFile.exists() ) {
                // Keep any existing dualTheme stored in the palette file while updating colors
                try {
                    String prevText = readUtf8File(paletteFile);
                    if (prevText != null && !prevText.isEmpty()) {
                        JSONObject prevObj = new JSONObject(prevText);
                        if (prevObj.has("dualTheme")) {
                            paletteJson.put("dualTheme", prevObj.get("dualTheme"));
                        }
                    }
                } catch (Exception ignored) {}
            }
            writeFileAtomically(paletteFile, paletteJson.toString().getBytes(StandardCharsets.UTF_8));

            return new CoverMipmapAndPaletteResult(
                "sha256:" + digest,
                cover256File.getAbsolutePath(),
                cover1024File.getAbsolutePath(),
                vibrantColors,
                representativeColors
            );
        } catch (Exception ignored) {
            return null;
        } finally {
            if (decoded != null && !decoded.isRecycled()) {
                decoded.recycle();
            }
        }
    }

    @Nullable
    @SuppressWarnings("deprecation")
    private static byte[] encodeScaledWebp(Bitmap source, int targetDimension, int quality) {
        Bitmap scaled = null;
        try {
            int w = source.getWidth();
            int h = source.getHeight();
            int targetW = targetDimension;
            int targetH = targetDimension;
            if (w != h && w > 0 && h > 0) {
                float scale = (float) targetDimension / (float) Math.max(w, h);
                targetW = Math.max(1, Math.round(w * scale));
                targetH = Math.max(1, Math.round(h * scale));
            }
            scaled = (w == targetW && h == targetH)
                ? source
                : Bitmap.createScaledBitmap(source, targetW, targetH, true);
            ByteArrayOutputStream out = new ByteArrayOutputStream(32768);
            Bitmap.CompressFormat format = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                ? Bitmap.CompressFormat.WEBP_LOSSY
                : Bitmap.CompressFormat.WEBP;
            scaled.compress(format, quality, out);
            return out.toByteArray();
        } catch (Exception ignored) {
            return null;
        } finally {
            if (scaled != null && scaled != source && !scaled.isRecycled()) {
                scaled.recycle();
            }
        }
    }

    private static List<String> extractVibrantHexColors(int[] pixels, int count) {
        List<int[]> candidates = new ArrayList<>();
        List<int[]> fallback = new ArrayList<>();
        for (int i = 0; i < pixels.length; i += 2) {
            int argb = pixels[i];
            int a = (argb >>> 24) & 0xff;
            if (a < 128) continue;
            int r = (argb >>> 16) & 0xff;
            int g = (argb >>> 8) & 0xff;
            int b = argb & 0xff;
            int max = Math.max(r, Math.max(g, b));
            int min = Math.min(r, Math.min(g, b));
            double l = (max + min) / 2.0;
            double denom = 255.0 - Math.abs(max + min - 255.0);
            double sat = (max == min || denom <= 0.0) ? 0.0 : (max - min) / denom;
            int satScore = (int) Math.round(((max - min) / 255.0) * 1000.0);
            if (sat > 0.2 && l > 30.0 && l < 220.0) {
                candidates.add(new int[] { r, g, b, satScore });
            } else if (fallback.size() < 100) {
                fallback.add(new int[] { r, g, b, satScore });
            }
        }
        if (candidates.isEmpty()) {
            candidates.addAll(fallback);
        }
        Collections.sort(candidates, (a, b) -> Integer.compare(b[3], a[3]));

        List<int[]> distinct = new ArrayList<>();
        for (int[] c : candidates) {
            if (distinct.size() >= count) break;
            boolean isDistinct = true;
            for (int[] dc : distinct) {
                double dist = Math.sqrt(
                    Math.pow(c[0] - dc[0], 2)
                    + Math.pow(c[1] - dc[1], 2)
                    + Math.pow(c[2] - dc[2], 2)
                );
                if (dist <= 20.0) {
                    isDistinct = false;
                    break;
                }
            }
            if (isDistinct || distinct.isEmpty()) {
                distinct.add(c);
            }
        }

        List<String> hexList = new ArrayList<>(distinct.size());
        for (int[] c : distinct) {
            hexList.add(String.format(Locale.ROOT, "#%02x%02x%02x", c[0], c[1], c[2]));
        }
        return hexList;
    }

    private static List<String> extractRepresentativeHexColors(int[] pixels, int count) {
        // Group into hue/luminance buckets to mirror extractRepresentativeColorsFromPixels in colorPalette.ts
        final int buckets = 12;
        int[] bucketCounts = new int[buckets];
        long[] sumR = new long[buckets];
        long[] sumG = new long[buckets];
        long[] sumB = new long[buckets];
        float[] hsv = new float[3];

        for (int i = 0; i < pixels.length; i += 2) {
            int argb = pixels[i];
            int a = (argb >>> 24) & 0xff;
            if (a < 128) continue;
            int r = (argb >>> 16) & 0xff;
            int g = (argb >>> 8) & 0xff;
            int b = argb & 0xff;
            Color.RGBToHSV(r, g, b, hsv);
            int bucket = hsv[1] < 0.12f
                ? (hsv[2] < 0.5f ? 0 : 1)
                : (2 + (Math.min(buckets - 3, (int) (hsv[0] / (360f / (buckets - 2))))));
            bucketCounts[bucket]++;
            sumR[bucket] += r;
            sumG[bucket] += g;
            sumB[bucket] += b;
        }

        List<int[]> ranked = new ArrayList<>();
        for (int idx = 0; idx < buckets; idx++) {
            if (bucketCounts[idx] <= 0) continue;
            int r = (int) Math.round((double) sumR[idx] / bucketCounts[idx]);
            int g = (int) Math.round((double) sumG[idx] / bucketCounts[idx]);
            int b = (int) Math.round((double) sumB[idx] / bucketCounts[idx]);
            ranked.add(new int[] { r, g, b, bucketCounts[idx] });
        }
        Collections.sort(ranked, (a, b) -> Integer.compare(b[3], a[3]));

        List<String> result = new ArrayList<>();
        for (int[] entry : ranked) {
            if (result.size() >= count) break;
            result.add(String.format(Locale.ROOT, "#%02x%02x%02x", entry[0], entry[1], entry[2]));
        }
        return result;
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

    @Nullable
    private static String extractHexDigest(@Nullable String value) {
        if (value == null) return null;
        String trimmed = value.trim().toLowerCase(Locale.ROOT);
        if (trimmed.startsWith("sha256:")) {
            trimmed = trimmed.substring("sha256:".length());
        }
        if (trimmed.length() != 64) return null;
        for (int i = 0; i < 64; i++) {
            char c = trimmed.charAt(i);
            boolean isHex = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f');
            if (!isHex) return null;
        }
        return trimmed;
    }

    private static String toSafeDiskCacheFileName(String rawKey) {
        String trimmed = rawKey != null ? rawKey.trim() : "";
        String hexDigest = extractHexDigest(trimmed);
        if (hexDigest != null) {
            return hexDigest;
        }
        if (trimmed.length() <= 96 && trimmed.matches("^[a-zA-Z0-9._-]+$")) {
            return trimmed;
        }
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(trimmed.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(64);
            for (byte b : digest) {
                sb.append(String.format(Locale.ROOT, "%02x", b & 0xff));
            }
            return sb.toString();
        } catch (Exception ignored) {
            return Integer.toHexString(trimmed.hashCode());
        }
    }

    @Nullable
    private static String readUtf8File(File file) {
        try (FileInputStream fis = new FileInputStream(file);
             ByteArrayOutputStream baos = new ByteArrayOutputStream((int) Math.min(file.length(), 262144L))) {
            byte[] buf = new byte[16384];
            int r;
            while ((r = fis.read(buf)) != -1) {
                baos.write(buf, 0, r);
            }
            return new String(baos.toByteArray(), StandardCharsets.UTF_8);
        } catch (Exception ignored) {
            return null;
        }
    }

    private static void writeFileAtomically(File target, byte[] bytes) throws Exception {
        File parent = target.getParentFile();
        if (parent != null && !parent.exists()) {
            //noinspection ResultOfMethodCallIgnored
            parent.mkdirs();
        }
        File temp = new File(parent, target.getName() + ".tmp." + Thread.currentThread().getId());
        try (FileOutputStream fos = new FileOutputStream(temp)) {
            fos.write(bytes);
            fos.getFD().sync();
        }
        if (!temp.renameTo(target)) {
            try (FileOutputStream fos = new FileOutputStream(target)) {
                fos.write(bytes);
                fos.getFD().sync();
            }
            //noinspection ResultOfMethodCallIgnored
            temp.delete();
        }
    }

    private static long computeDirBytes(File dir) {
        if (dir == null || !dir.exists()) return 0L;
        File[] files = dir.listFiles();
        if (files == null) return 0L;
        long total = 0L;
        for (File f : files) {
            if (f.isFile()) {
                total += f.length();
            }
        }
        return total;
    }

    private static List<String> jsonArrayToStringList(@Nullable JSONArray arr) {
        if (arr == null) return Collections.emptyList();
        List<String> list = new ArrayList<>(arr.length());
        for (int i = 0; i < arr.length(); i++) {
            String val = arr.optString(i, "");
            if (val != null && !val.isEmpty()) {
                list.add(val);
            }
        }
        return list;
    }

    @Nullable
    private static CoverMipmapAndPaletteResult lookupPaletteAndCoversByKeys(
        @Nullable Context context,
        @Nullable String contentUri,
        @Nullable String trackId,
        @Nullable String albumId,
        @Nullable String assetId
    ) {
        if (context == null) return null;
        if (assetId != null && !assetId.isEmpty()) {
            String digest = extractHexDigest(assetId);
            if (digest != null) {
                CoverMipmapAndPaletteResult direct = readExistingCoverMipmapsAndPalette(context, digest);
                if (direct != null) return direct;
            }
        }
        PaletteIndexSqliteHelper dbHelper = getPaletteDbHelper(context);
        if (dbHelper == null) return null;
        String[] candidates = new String[] {
            trackId != null && !trackId.trim().isEmpty() ? "track:" + trackId.trim() : null,
            contentUri != null && !contentUri.trim().isEmpty() ? "uri:" + contentUri.trim() : null,
            albumId != null && !albumId.trim().isEmpty() ? "album:" + albumId.trim() : null,
            assetId != null && !assetId.trim().isEmpty() ? "asset:" + assetId.trim() : null
        };
        for (String key : candidates) {
            if (key == null) continue;
            CoverMipmapAndPaletteResult hit = dbHelper.queryByLookupKey(key);
            if (hit != null) {
                return hit;
            }
        }
        return null;
    }

    private static void indexPaletteAndCoversForKeys(
        @Nullable Context context,
        @Nullable CoverMipmapAndPaletteResult result,
        @Nullable String contentUri,
        @Nullable String trackId,
        @Nullable String albumId
    ) {
        if (context == null || result == null) return;
        PaletteIndexSqliteHelper dbHelper = getPaletteDbHelper(context);
        if (dbHelper == null) return;
        if (result.assetId != null && !result.assetId.isEmpty()) {
            dbHelper.upsertLookupKey("asset:" + result.assetId, result);
        }
        if (trackId != null && !trackId.trim().isEmpty()) {
            dbHelper.upsertLookupKey("track:" + trackId.trim(), result);
        }
        if (contentUri != null && !contentUri.trim().isEmpty()) {
            dbHelper.upsertLookupKey("uri:" + contentUri.trim(), result);
        }
        if (albumId != null && !albumId.trim().isEmpty()) {
            dbHelper.upsertLookupKey("album:" + albumId.trim(), result);
        }
    }

    private static final class PaletteIndexSqliteHelper extends SQLiteOpenHelper {
        private static final int DB_VERSION = 1;
        private static final String TABLE_NAME = "palette_index";

        PaletteIndexSqliteHelper(Context context, String dbPath) {
            super(context, dbPath, null, DB_VERSION);
        }

        @Override
        public void onCreate(SQLiteDatabase db) {
            db.execSQL(
                "CREATE TABLE IF NOT EXISTS " + TABLE_NAME + " ("
                    + "lookup_key TEXT PRIMARY KEY,"
                    + "asset_id TEXT NOT NULL,"
                    + "cover_256_path TEXT NOT NULL,"
                    + "cover_1024_path TEXT NOT NULL,"
                    + "vibrant_json TEXT NOT NULL,"
                    + "representative_json TEXT NOT NULL,"
                    + "updated_at INTEGER NOT NULL"
                    + ")"
            );
        }

        @Override
        public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
            onCreate(db);
        }

        synchronized void upsertLookupKey(String lookupKey, CoverMipmapAndPaletteResult record) {
            if (lookupKey == null || lookupKey.isEmpty() || record == null) return;
            try {
                SQLiteDatabase db = getWritableDatabase();
                ContentValues cv = new ContentValues();
                cv.put("lookup_key", lookupKey);
                cv.put("asset_id", record.assetId);
                cv.put("cover_256_path", record.cover256Path);
                cv.put("cover_1024_path", record.cover1024Path);
                cv.put("vibrant_json", new JSONArray(record.vibrantColors).toString());
                cv.put("representative_json", new JSONArray(record.representativeColors).toString());
                cv.put("updated_at", System.currentTimeMillis());
                db.insertWithOnConflict(TABLE_NAME, null, cv, SQLiteDatabase.CONFLICT_REPLACE);
            } catch (Exception ignored) {
                // Ignore SQLite write exception
            }
        }

        @Nullable
        synchronized CoverMipmapAndPaletteResult queryByLookupKey(String lookupKey) {
            if (lookupKey == null || lookupKey.isEmpty()) return null;
            try {
                SQLiteDatabase db = getReadableDatabase();
                try (Cursor c = db.query(
                    TABLE_NAME,
                    new String[] { "asset_id", "cover_256_path", "cover_1024_path", "vibrant_json", "representative_json" },
                    "lookup_key = ?",
                    new String[] { lookupKey },
                    null,
                    null,
                    null,
                    "1"
                )) {
                    if (c != null && c.moveToFirst()) {
                        String assetId = c.getString(0);
                        String cover256 = c.getString(1);
                        String cover1024 = c.getString(2);
                        String vibrantStr = c.getString(3);
                        String repStr = c.getString(4);
                        if (cover256 != null && cover1024 != null
                            && new File(cover256).exists()
                            && new File(cover1024).exists()) {
                            List<String> vibrant = jsonArrayToStringList(new JSONArray(vibrantStr));
                            List<String> rep = jsonArrayToStringList(new JSONArray(repStr));
                            if (!vibrant.isEmpty() || !rep.isEmpty()) {
                                return new CoverMipmapAndPaletteResult(assetId, cover256, cover1024, vibrant, rep);
                            }
                        }
                    }
                }
            } catch (Exception ignored) {
                // Fall through
            }
            return null;
        }
    }

    private static final class CoverMipmapAndPaletteResult {
        final String assetId;
        final String cover256Path;
        final String cover1024Path;
        final List<String> vibrantColors;
        final List<String> representativeColors;

        CoverMipmapAndPaletteResult(
            String assetId,
            String cover256Path,
            String cover1024Path,
            List<String> vibrantColors,
            List<String> representativeColors
        ) {
            this.assetId = assetId;
            this.cover256Path = cover256Path;
            this.cover1024Path = cover1024Path;
            this.vibrantColors = vibrantColors;
            this.representativeColors = representativeColors;
        }

        JSObject toJSObject() {
            JSObject obj = new JSObject();
            obj.put("ok", true);
            obj.put("assetId", assetId);
            obj.put("cover256Path", cover256Path);
            obj.put("cover1024Path", cover1024Path);
            JSArray vibrantArr = new JSArray();
            for (String c : vibrantColors) vibrantArr.put(c);
            JSArray repArr = new JSArray();
            for (String c : representativeColors) repArr.put(c);
            obj.put("vibrantColors", vibrantArr);
            obj.put("representativeColors", repArr);
            return obj;
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
            || lower.endsWith(".alac")
            || lower.endsWith(".wav")
            || lower.endsWith(".aif")
            || lower.endsWith(".aiff")
            || lower.endsWith(".caf")
            || lower.endsWith(".ogg")
            || lower.endsWith(".opus")
            || lower.endsWith(".aac")
            || lower.endsWith(".wma")
            || lower.endsWith(".wv")
            || lower.endsWith(".ape")
            || lower.endsWith(".tta")
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
