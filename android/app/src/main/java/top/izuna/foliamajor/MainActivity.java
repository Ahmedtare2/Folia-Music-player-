package top.izuna.foliamajor;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
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
            WindowInsetsControllerCompat insetsController = WindowCompat.getInsetsController(window, window.getDecorView());
            if (insetsController != null) {
                insetsController.setAppearanceLightStatusBars(false);
                insetsController.setAppearanceLightNavigationBars(false);
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
    public void onResume() {
        super.onResume();
        dispatchWindowEvent("folia:native-visibility", "{\"visible\":true}");
    }

    @Override
    public void onPause() {
        dispatchWindowEvent("folia:native-visibility", "{\"visible\":false}");
        super.onPause();
        // Keep the single Web Audio + HTMLAudioElement playback clock running when the screen locks
        // or the user switches apps while FoliaPlaybackService is actively playing a track.
        if (FoliaPlaybackService.isPlaybackActive() && this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            webView.onResume();
            webView.resumeTimers();
        }
    }

    @Override
    public void onStop() {
        dispatchWindowEvent("folia:native-visibility", "{\"visible\":false}");
        super.onStop();
        if (FoliaPlaybackService.isPlaybackActive() && this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            webView.onResume();
            webView.resumeTimers();
        }
    }
}
