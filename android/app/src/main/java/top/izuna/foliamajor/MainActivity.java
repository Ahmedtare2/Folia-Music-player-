package top.izuna.foliamajor;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.hardware.display.DisplayManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Display;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.annotation.Nullable;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    private static volatile boolean mainActivityForegroundVisible = true;
    private volatile boolean hideStatusBarRequested = false;
    private volatile boolean hideNavigationBarRequested = false;

    public static boolean isMainActivityForegroundVisible() {
        return mainActivityForegroundVisible;
    }
    private volatile float currentDisplayRefreshRate = 60.0f;
    @Nullable
    private FoliaBackgroundSurfaceView backgroundSurfaceView = null;
    @Nullable
    private BroadcastReceiver screenStateReceiver = null;
    @Nullable
    private DisplayManager displayManager = null;
    @Nullable
    private DisplayManager.DisplayListener displayListener = null;

    @Nullable
    public FoliaBackgroundSurfaceView getBackgroundSurfaceView() {
        return this.backgroundSurfaceView;
    }

    public float getDisplayRefreshRate() {
        return this.currentDisplayRefreshRate;
    }

    /**
     * Reads the active display refresh rate (60Hz, 90Hz, 120Hz, etc.) via Display / WindowManager /
     * DisplayManager and notifies FoliaBackgroundSurfaceView, FoliaNativeBridgePlugin, and the WebView.
     */
    @SuppressWarnings("deprecation")
    public float queryAndSyncDisplayRefreshRate(boolean forceBroadcast) {
        float detectedHz = 60.0f;
        try {
            Display display = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                try {
                    display = getDisplay();
                } catch (Exception ignored) {
                    display = null;
                }
            }
            if (display == null && this.displayManager != null) {
                display = this.displayManager.getDisplay(Display.DEFAULT_DISPLAY);
            }
            if (display == null) {
                WindowManager wm = getWindowManager();
                if (wm != null) {
                    display = wm.getDefaultDisplay();
                }
            }
            if (display != null) {
                float raw = display.getRefreshRate();
                if (!Float.isNaN(raw) && !Float.isInfinite(raw) && raw >= 30.0f && raw <= 240.0f) {
                    detectedHz = raw;
                }
            }
        } catch (Exception ignored) {
            detectedHz = 60.0f;
        }

        boolean changed = Math.abs(detectedHz - this.currentDisplayRefreshRate) >= 0.5f;
        this.currentDisplayRefreshRate = detectedHz;

        if (this.backgroundSurfaceView != null) {
            this.backgroundSurfaceView.onDisplayRefreshRateChanged(detectedHz);
        }

        if (changed || forceBroadcast) {
            dispatchDisplayRefreshRateToWebView(detectedHz);
            FoliaNativeBridgePlugin.dispatchDisplayRefreshRateChanged(detectedHz);
        }

        return detectedHz;
    }

    private void dispatchDisplayRefreshRateToWebView(final float refreshRateHz) {
        if (this.bridge == null || this.bridge.getWebView() == null) {
            return;
        }
        final int roundedHz = Math.max(30, Math.min(240, Math.round(refreshRateHz)));
        final float vsyncIntervalMs = 1000.0f / Math.max(30.0f, refreshRateHz);
        final WebView webView = this.bridge.getWebView();
        final String script = String.format(
            Locale.ROOT,
            "(function(){try{window.__FOLIA_DISPLAY_REFRESH_RATE__=%d;"
                + "window.__FOLIA_DISPLAY_RAW_REFRESH_RATE__=%.2f;"
                + "window.dispatchEvent(new CustomEvent('folia:display-refresh-rate',{detail:{"
                + "refreshRate:%d,rawRefreshRate:%.2f,vsyncIntervalMs:%.3f"
                + "}}));}catch(e){}})();",
            roundedHz,
            refreshRateHz,
            roundedHz,
            refreshRateHz,
            vsyncIntervalMs
        );
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    private void dispatchWindowEvent(String eventName, String detailJson) {
        if (this.bridge == null || this.bridge.getWebView() == null) {
            return;
        }
        final WebView webView = this.bridge.getWebView();
        final String script = "window.dispatchEvent(new CustomEvent('"
            + eventName
            + "', { detail: "
            + detailJson
            + " }));";
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    private void dispatchNativeVisibility(final boolean visible) {
        mainActivityForegroundVisible = visible;
        FoliaPlaybackService.onMainActivityVisibilityChanged(visible);
        if (this.bridge == null || this.bridge.getWebView() == null) {
            return;
        }
        final WebView webView = this.bridge.getWebView();
        final String script = String.format(
            Locale.ROOT,
            "(function(){try{window.__FOLIA_NATIVE_VISIBLE__=%b;"
                + "window.dispatchEvent(new CustomEvent('folia:native-visibility',{detail:{visible:%b}}));"
                + "}catch(e){}})();",
            visible,
            visible
        );
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    /**
     * Applies native Android system bar visibility using AndroidX WindowCompat & WindowInsetsControllerCompat.
     * Always configures BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE so hidden system bars can be temporarily
     * revealed with a standard Android edge swipe gesture without permanently trapping navigation.
     */
    public void applySystemBarsConfig(final boolean hideStatusBar, final boolean hideNavigationBar) {
        this.hideStatusBarRequested = hideStatusBar;
        this.hideNavigationBarRequested = hideNavigationBar;
        runOnUiThread(() -> {
            Window window = getWindow();
            if (window == null) {
                return;
            }
            View decorView = window.getDecorView();
            if (decorView == null) {
                return;
            }
            WindowCompat.setDecorFitsSystemWindows(window, false);
            WindowInsetsControllerCompat insetsController = WindowCompat.getInsetsController(window, decorView);
            if (insetsController == null) {
                return;
            }
            insetsController.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            );
            insetsController.setAppearanceLightStatusBars(false);
            insetsController.setAppearanceLightNavigationBars(false);

            if (hideStatusBar) {
                insetsController.hide(WindowInsetsCompat.Type.statusBars());
            } else {
                insetsController.show(WindowInsetsCompat.Type.statusBars());
            }

            if (hideNavigationBar) {
                insetsController.hide(WindowInsetsCompat.Type.navigationBars());
            } else {
                insetsController.show(WindowInsetsCompat.Type.navigationBars());
            }

            ViewCompat.requestApplyInsets(decorView);
            dispatchWindowEvent(
                "folia:system-bars-state",
                String.format(
                    Locale.ROOT,
                    "{\"hideStatusBar\":%b,\"hideNavigationBar\":%b,\"behavior\":\"SHOW_TRANSIENT_BARS_BY_SWIPE\"}",
                    hideStatusBar,
                    hideNavigationBar
                )
            );
        });
    }

    public boolean isStatusBarHiddenRequested() {
        return this.hideStatusBarRequested;
    }

    public boolean isNavigationBarHiddenRequested() {
        return this.hideNavigationBarRequested;
    }

    private void syncInsetsToWebView(WindowInsetsCompat windowInsets) {
        if (windowInsets == null || this.bridge == null || this.bridge.getWebView() == null) {
            return;
        }
        float density = Math.max(1.0f, getResources().getDisplayMetrics().density);
        Insets systemBars = windowInsets.getInsets(
            WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
        );
        Insets cutoutOnly = windowInsets.getInsets(WindowInsetsCompat.Type.displayCutout());
        boolean statusBarVisible = windowInsets.isVisible(WindowInsetsCompat.Type.statusBars());
        boolean navBarVisible = windowInsets.isVisible(WindowInsetsCompat.Type.navigationBars());

        int topDp = Math.round(systemBars.top / density);
        int bottomDp = Math.round(systemBars.bottom / density);
        int leftDp = Math.round(systemBars.left / density);
        int rightDp = Math.round(systemBars.right / density);

        int cutoutTopDp = Math.round(cutoutOnly.top / density);
        int cutoutBottomDp = Math.round(cutoutOnly.bottom / density);
        int cutoutLeftDp = Math.round(cutoutOnly.left / density);
        int cutoutRightDp = Math.round(cutoutOnly.right / density);

        final WebView webView = this.bridge.getWebView();
        final String js = String.format(
            Locale.ROOT,
            "(function(){try{var r=document.documentElement;if(r){"
                + "r.style.setProperty('--folia-native-inset-top','%dpx');"
                + "r.style.setProperty('--folia-native-inset-bottom','%dpx');"
                + "r.style.setProperty('--folia-native-inset-left','%dpx');"
                + "r.style.setProperty('--folia-native-inset-right','%dpx');"
                + "r.style.setProperty('--folia-native-cutout-top','%dpx');"
                + "r.style.setProperty('--folia-native-cutout-bottom','%dpx');"
                + "r.style.setProperty('--folia-native-cutout-left','%dpx');"
                + "r.style.setProperty('--folia-native-cutout-right','%dpx');"
                + "}"
                + "window.dispatchEvent(new CustomEvent('folia:system-insets',{detail:{"
                + "top:%d,bottom:%d,left:%d,right:%d,"
                + "cutoutTop:%d,cutoutBottom:%d,cutoutLeft:%d,cutoutRight:%d,"
                + "statusBarVisible:%b,navigationBarVisible:%b"
                + "}}));}catch(e){}})();",
            topDp, bottomDp, leftDp, rightDp,
            cutoutTopDp, cutoutBottomDp, cutoutLeftDp, cutoutRightDp,
            topDp, bottomDp, leftDp, rightDp,
            cutoutTopDp, cutoutBottomDp, cutoutLeftDp, cutoutRightDp,
            statusBarVisible, navBarVisible
        );
        webView.post(() -> webView.evaluateJavascript(js, null));
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FoliaNativeBridgePlugin.class);
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        if (window != null) {
            WindowCompat.setDecorFitsSystemWindows(window, false);
            window.setStatusBarColor(Color.TRANSPARENT);
            window.setNavigationBarColor(Color.TRANSPARENT);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                WindowManager.LayoutParams lp = window.getAttributes();
                lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
                window.setAttributes(lp);
            }
            View decorView = window.getDecorView();
            WindowInsetsControllerCompat insetsController = WindowCompat.getInsetsController(window, decorView);
            if (insetsController != null) {
                insetsController.setSystemBarsBehavior(
                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                );
                insetsController.setAppearanceLightStatusBars(false);
                insetsController.setAppearanceLightNavigationBars(false);
            }
            if (decorView != null) {
                decorView.setBackgroundColor(Color.parseColor("#09090B"));
                ViewCompat.setOnApplyWindowInsetsListener(decorView, (view, windowInsets) -> {
                    syncInsetsToWebView(windowInsets);
                    return WindowInsetsCompat.CONSUMED;
                });
            }
        }

        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            // Layer FoliaBackgroundSurfaceView behind the transparent hardware-accelerated WebView
            // so the native 180x400 OpenGL ES mesh visualizer shines through while the WebView is
            // dedicated strictly to VSync-paced GPU-composited lyrics and UI.
            webView.setBackgroundColor(Color.TRANSPARENT);
            webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

            this.backgroundSurfaceView = new FoliaBackgroundSurfaceView(this);
            if (webView.getParent() instanceof ViewGroup) {
                ViewGroup rootContainer = (ViewGroup) webView.getParent();
                rootContainer.setBackgroundColor(Color.parseColor("#09090B"));
                rootContainer.addView(
                    this.backgroundSurfaceView,
                    0,
                    new ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                );
            }

            WebSettings settings = webView.getSettings();
            settings.setMediaPlaybackRequiresUserGesture(false);

            this.bridge.setWebViewClient(new BridgeWebViewClient(this.bridge) {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    if (FoliaSafStreamHandler.isSafStreamRequest(request)) {
                        return FoliaSafStreamHandler.handleRequest(MainActivity.this, request);
                    }
                    if (FoliaSafStreamHandler.isLocalCoverRequest(request)) {
                        WebResourceResponse coverResp = FoliaSafStreamHandler.handleCoverRequest(MainActivity.this, request);
                        if (coverResp != null) {
                            return coverResp;
                        }
                    }
                    return super.shouldInterceptRequest(view, request);
                }
            });
        }

        // Register DisplayManager.DisplayListener to track live screen refresh rate changes
        // (60Hz / 90Hz / 120Hz, MIUI/HyperOS dynamic refresh rate, or Battery Saver mode).
        this.displayManager = (DisplayManager) getSystemService(Context.DISPLAY_SERVICE);
        if (this.displayManager != null) {
            this.displayListener = new DisplayManager.DisplayListener() {
                @Override
                public void onDisplayAdded(int displayId) {
                    queryAndSyncDisplayRefreshRate(false);
                }

                @Override
                public void onDisplayRemoved(int displayId) {
                    queryAndSyncDisplayRefreshRate(false);
                }

                @Override
                public void onDisplayChanged(int displayId) {
                    queryAndSyncDisplayRefreshRate(false);
                }
            };
            this.displayManager.registerDisplayListener(
                this.displayListener,
                new Handler(Looper.getMainLooper())
            );
        }
        queryAndSyncDisplayRefreshRate(true);

        this.screenStateReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null || intent.getAction() == null) return;
                String action = intent.getAction();
                if (Intent.ACTION_SCREEN_OFF.equals(action)) {
                    if (MainActivity.this.backgroundSurfaceView != null) {
                        MainActivity.this.backgroundSurfaceView.onHostPause();
                    }
                    dispatchNativeVisibility(false);
                } else if (Intent.ACTION_SCREEN_ON.equals(action)) {
                    queryAndSyncDisplayRefreshRate(false);
                    if (MainActivity.this.backgroundSurfaceView != null) {
                        MainActivity.this.backgroundSurfaceView.onHostResume();
                    }
                    dispatchNativeVisibility(true);
                }
            }
        };
        IntentFilter screenFilter = new IntentFilter();
        screenFilter.addAction(Intent.ACTION_SCREEN_OFF);
        screenFilter.addAction(Intent.ACTION_SCREEN_ON);
        registerReceiver(this.screenStateReceiver, screenFilter);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (MainActivity.this.bridge != null && MainActivity.this.bridge.getWebView() != null) {
                    WebView webView = MainActivity.this.bridge.getWebView();
                    webView.evaluateJavascript(
                        "(function() { try { if (typeof window.__FOLIA_HANDLE_HARDWARE_BACK__ === 'function') { return Boolean(window.__FOLIA_HANDLE_HARDWARE_BACK__()); } } catch (e) {} return false; })()",
                        result -> {
                            if ("true".equals(result)) {
                                return;
                            }
                            if (webView.canGoBack()) {
                                webView.goBack();
                            } else {
                                moveTaskToBack(true);
                            }
                        }
                    );
                } else {
                    moveTaskToBack(true);
                }
            }
        });
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (this.backgroundSurfaceView != null) {
            this.backgroundSurfaceView.onHostWindowFocusChanged(hasFocus);
        }
        if (hasFocus) {
            queryAndSyncDisplayRefreshRate(false);
            if (this.hideStatusBarRequested || this.hideNavigationBarRequested) {
                applySystemBarsConfig(this.hideStatusBarRequested, this.hideNavigationBarRequested);
            }
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        queryAndSyncDisplayRefreshRate(true);
        if (this.backgroundSurfaceView != null) {
            this.backgroundSurfaceView.onHostResume();
        }
        applySystemBarsConfig(this.hideStatusBarRequested, this.hideNavigationBarRequested);
        dispatchNativeVisibility(true);
    }

    @Override
    public void onPause() {
        if (this.backgroundSurfaceView != null) {
            this.backgroundSurfaceView.onHostPause();
        }
        dispatchNativeVisibility(false);
        super.onPause();
        // Keep the single Web Audio + HTMLAudioElement playback clock running when the screen locks
        // or the user switches apps while FoliaPlaybackService is actively playing a track, while
        // window.__FOLIA_NATIVE_VISIBLE__ = false and backgroundSurfaceView.onHostPause() strictly
        // freeze all native OpenGL and WebView visualizers at 0% GPU.
        if (!FoliaPlaybackService.isNativeExoModeActive() && FoliaPlaybackService.isPlaybackActive() && this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            webView.onResume();
            webView.resumeTimers();
        }
    }

    @Override
    public void onStop() {
        if (this.backgroundSurfaceView != null) {
            this.backgroundSurfaceView.onHostPause();
        }
        dispatchNativeVisibility(false);
        super.onStop();
        if (!FoliaPlaybackService.isNativeExoModeActive() && FoliaPlaybackService.isPlaybackActive() && this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            webView.onResume();
            webView.resumeTimers();
        }
    }

    @Override
    public void onDestroy() {
        if (this.displayManager != null && this.displayListener != null) {
            try {
                this.displayManager.unregisterDisplayListener(this.displayListener);
            } catch (Exception ignored) {
                // Ignore if already unregistered
            }
            this.displayListener = null;
        }
        if (this.screenStateReceiver != null) {
            try {
                unregisterReceiver(this.screenStateReceiver);
            } catch (Exception ignored) {
                // Ignore if already unregistered
            }
            this.screenStateReceiver = null;
        }
        super.onDestroy();
    }
}
