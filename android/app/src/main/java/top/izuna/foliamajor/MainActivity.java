package top.izuna.foliamajor;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    private volatile boolean hideStatusBarRequested = false;
    private volatile boolean hideNavigationBarRequested = false;

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
            window.setStatusBarColor(Color.parseColor("#09090B"));
            window.setNavigationBarColor(Color.parseColor("#09090B"));
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
                ViewCompat.setOnApplyWindowInsetsListener(decorView, (view, windowInsets) -> {
                    syncInsetsToWebView(windowInsets);
                    return WindowInsetsCompat.CONSUMED;
                });
            }
        }

        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            webView.setBackgroundColor(0xFF09090B);
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
        if (hasFocus && (this.hideStatusBarRequested || this.hideNavigationBarRequested)) {
            applySystemBarsConfig(this.hideStatusBarRequested, this.hideNavigationBarRequested);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        applySystemBarsConfig(this.hideStatusBarRequested, this.hideNavigationBarRequested);
        dispatchNativeVisibility(true);
    }

    @Override
    public void onPause() {
        dispatchNativeVisibility(false);
        super.onPause();
        // Keep the single Web Audio + HTMLAudioElement playback clock running when the screen locks
        // or the user switches apps while FoliaPlaybackService is actively playing a track, while
        // window.__FOLIA_NATIVE_VISIBLE__ = false strictly freezes all WebGL/Canvas/rAF visualizers.
        if (FoliaPlaybackService.isPlaybackActive() && this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            webView.onResume();
            webView.resumeTimers();
        }
    }

    @Override
    public void onStop() {
        dispatchNativeVisibility(false);
        super.onStop();
        if (FoliaPlaybackService.isPlaybackActive() && this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            webView.onResume();
            webView.resumeTimers();
        }
    }
}
