package top.izuna.foliamajor;

import android.content.Context;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.opengl.GLES20;
import android.opengl.GLSurfaceView;
import android.os.SystemClock;
import android.util.AttributeSet;
import android.view.Choreographer;
import android.view.SurfaceHolder;
import android.view.View;
import androidx.annotation.Nullable;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

/**
 * Native OpenGL ES 2.0/3.0 background surface view placed behind the transparent Capacitor WebView.
 *
 * Architecture & VSync-Aware Refresh Rate Adaptations:
 * 1. Hardware Upscaling (Zero-Cost Blur): Locks the internal SurfaceHolder buffer to 180x400
 *    (~72,000 pixels per frame instead of 2.6M at 1080x2400). Android's hardware bilinear surface
 *    composer (SurfaceFlinger / HWC) upscales the low-res buffer to full screen with zero GPU
 *    multi-pass Gaussian blur cost, producing an ultra-smooth diffused gradient.
 * 2. VSync-Driven Frame Pacing (RENDERMODE_WHEN_DIRTY + Choreographer.FrameCallback):
 *    Never runs an uncapped or hardcoded 120Hz loop. Rendering is strictly driven by hardware VSync
 *    pulses via Choreographer.FrameCallback with a configurable 1:1 or 1:2 VSync divider (e.g.,
 *    30fps when display is 60Hz, 45fps at 90Hz, 60fps at 120Hz, or 1:1 during palette transitions),
 *    and drops to 0fps (stopping Choreographer callbacks and calling onPause()) when playback is
 *    paused and static, or when the screen is off.
 * 3. Frame-Rate-Independent Shader DeltaTime (dt): Scales shader time and exponential damping by
 *    the actual elapsed VSync frame delta (dtSec) so the flowing color mesh moves at the exact same
 *    visual speed across 60Hz, 90Hz, and 120Hz displays.
 */
public class FoliaBackgroundSurfaceView extends GLSurfaceView implements Choreographer.FrameCallback {
    public static final int INTERNAL_BUFFER_WIDTH = 180;
    public static final int INTERNAL_BUFFER_HEIGHT = 400;
    public static final int PALETTE_COLOR_COUNT = 6;

    private final MeshRenderer renderer;
    private volatile boolean visualizerEnabled = true;
    private volatile boolean visualizerVisible = true;
    private volatile boolean isAudioPlaying = false;
    private volatile boolean hostActivityResumed = false;
    private volatile boolean hostWindowFocused = true;
    private volatile float displayRefreshRateHz = 60.0f;
    private volatile int configuredVsyncDivider = 2;
    private volatile int requestedTargetFps = 0;
    private boolean glThreadResumed = false;
    private boolean choreographerScheduled = false;
    private long vsyncTickCount = 0L;

    public FoliaBackgroundSurfaceView(Context context) {
        super(context);
        this.renderer = new MeshRenderer(this);
        initSurface();
    }

    public FoliaBackgroundSurfaceView(Context context, AttributeSet attrs) {
        super(context, attrs);
        this.renderer = new MeshRenderer(this);
        initSurface();
    }

    private void initSurface() {
        setEGLContextClientVersion(2);
        // 8-bit RGBA, no depth/stencil buffer needed for a full-screen 2D fragment shader quad.
        setEGLConfigChooser(8, 8, 8, 8, 0, 0);
        SurfaceHolder holder = getHolder();
        holder.setFormat(PixelFormat.RGBA_8888);
        // Hardware Upscaling Optimization: compute only 180x400 (~72,000 px) in the fragment shader
        // and let Android's hardware display scaler bilinearly upscale to full-screen resolution.
        holder.setFixedSize(INTERNAL_BUFFER_WIDTH, INTERNAL_BUFFER_HEIGHT);
        setPreserveEGLContextOnPause(true);
        setRenderer(renderer);
        // Always use RENDERMODE_WHEN_DIRTY driven by Choreographer VSync callbacks.
        setRenderMode(GLSurfaceView.RENDERMODE_WHEN_DIRTY);
    }

    @Override
    public void surfaceCreated(SurfaceHolder holder) {
        holder.setFixedSize(INTERNAL_BUFFER_WIDTH, INTERNAL_BUFFER_HEIGHT);
        super.surfaceCreated(holder);
        requestRender();
    }

    /**
     * Updates the live display refresh rate detected by MainActivity's DisplayManager.DisplayListener
     * (e.g., 60Hz in Battery Saver / standard mode, 90Hz, or 120Hz on LTPO/AMOLED displays).
     */
    public void onDisplayRefreshRateChanged(float refreshRateHz) {
        float sanitized = sanitizeRefreshRate(refreshRateHz);
        this.displayRefreshRateHz = sanitized;
        post(this::updateRenderPacingState);
    }

    public float getDisplayRefreshRateHz() {
        return displayRefreshRateHz;
    }

    public int getEffectiveVsyncDivider() {
        return resolveEffectiveVsyncDivider();
    }

    /**
     * Updates the native visualizer state (enabled, visible, optional target FPS or VSync divider, and dimming).
     */
    public void setVisualizerState(boolean enabled, boolean visible, int fps, float dim) {
        setVisualizerState(enabled, visible, fps, dim, 0);
    }

    public void setVisualizerState(boolean enabled, boolean visible, int fps, float dim, int vsyncDivider) {
        this.visualizerEnabled = enabled;
        this.visualizerVisible = visible;
        this.requestedTargetFps = Math.max(0, Math.min(240, fps));
        if (vsyncDivider == 1 || vsyncDivider == 2) {
            this.configuredVsyncDivider = vsyncDivider;
        } else if (fps > 0) {
            float currentHz = this.displayRefreshRateHz;
            this.configuredVsyncDivider = (fps >= Math.round(currentHz * 0.85f)) ? 1 : 2;
        } else {
            this.configuredVsyncDivider = 2;
        }
        renderer.setTargetDim(dim);
        post(() -> {
            int desiredVisibility = (enabled && visible) ? View.VISIBLE : View.INVISIBLE;
            if (getVisibility() != desiredVisibility) {
                setVisibility(desiredVisibility);
            }
            updateRenderPacingState();
            if (glThreadResumed && enabled && visible) {
                requestRender();
            }
        });
    }

    /**
     * Updates the 4-6 RGB palette colors and smoothly interpolates from the current colors
     * over transitionMs milliseconds.
     */
    public void setVisualizerPalette(@Nullable String[] hexColors, int transitionMs) {
        renderer.setPaletteColors(hexColors, transitionMs);
        post(() -> {
            updateRenderPacingState();
            if (glThreadResumed && visualizerEnabled && visualizerVisible) {
                requestRender();
            }
        });
    }

    /**
     * Feeds normalized audio energy bands (0..1) and play/pause state into the shader uniforms.
     */
    public void setVisualizerEnergy(float bass, float mid, float high, boolean isPlaying) {
        boolean playingChanged = (this.isAudioPlaying != isPlaying);
        this.isAudioPlaying = isPlaying;
        renderer.setAudioEnergy(bass, mid, high, isPlaying);
        if (playingChanged) {
            post(this::updateRenderPacingState);
        }
    }

    /**
     * Called by MainActivity.onResume() when the Activity enters the foreground.
     */
    public void onHostResume() {
        hostActivityResumed = true;
        updateRenderPacingState();
    }

    /**
     * Called by MainActivity.onPause() / onStop() / screen-off so GPU usage drops to 0% immediately.
     */
    public void onHostPause() {
        hostActivityResumed = false;
        updateRenderPacingState();
    }

    /**
     * Called by MainActivity.onWindowFocusChanged() to pause VSync rendering when lockscreen overlays the window.
     */
    public void onHostWindowFocusChanged(boolean hasFocus) {
        hostWindowFocused = hasFocus;
        updateRenderPacingState();
    }

    void notifyTransitionFinished() {
        post(this::updateRenderPacingState);
    }

    boolean isAudioActivelyPlaying() {
        return isAudioPlaying;
    }

    private int resolveEffectiveVsyncDivider() {
        // When a cross-song palette or dimming transition is actively interpolating, allow 1:1
        // or 60fps VSync pacing for smooth color blending; otherwise use the 1:2 (or 1:1) divider
        // (e.g., 30fps at 60Hz, 45fps at 90Hz, 60fps at 120Hz) since the ambient mesh moves slowly.
        float hz = Math.max(30.0f, this.displayRefreshRateHz);
        if (renderer.isTransitionActive()) {
            return hz > 90.0f ? 2 : 1;
        }
        if (requestedTargetFps > 0) {
            int computed = Math.round(hz / (float) requestedTargetFps);
            return computed <= 1 ? 1 : 2;
        }
        return configuredVsyncDivider <= 1 ? 1 : 2;
    }

    private boolean shouldScheduleChoreographer() {
        return hostActivityResumed
            && hostWindowFocused
            && visualizerEnabled
            && visualizerVisible
            && (isAudioPlaying || requestedTargetFps > 0 || renderer.isTransitionActive());
    }

    private synchronized void stopChoreographerCallbacks() {
        if (choreographerScheduled) {
            Choreographer.getInstance().removeFrameCallback(this);
            choreographerScheduled = false;
        }
    }

    private synchronized void startChoreographerCallbacksIfNeeded() {
        if (!choreographerScheduled && shouldScheduleChoreographer()) {
            choreographerScheduled = true;
            Choreographer.getInstance().postFrameCallback(this);
        }
    }

    private synchronized void updateRenderPacingState() {
        boolean shouldKeepGlContextActive = hostActivityResumed && visualizerEnabled && visualizerVisible;
        if (!shouldKeepGlContextActive) {
            stopChoreographerCallbacks();
            if (glThreadResumed) {
                super.onPause();
                glThreadResumed = false;
            }
            return;
        }

        if (!glThreadResumed) {
            super.onResume();
            setRenderMode(GLSurfaceView.RENDERMODE_WHEN_DIRTY);
            glThreadResumed = true;
            renderer.resetFrameClock();
            requestRender();
        }

        if (shouldScheduleChoreographer()) {
            startChoreographerCallbacksIfNeeded();
        } else {
            // Static / paused state: stop Choreographer callbacks (0fps) and render a single dirty frame.
            stopChoreographerCallbacks();
            requestRender();
        }
    }

    @Override
    public void doFrame(long frameTimeNanos) {
        synchronized (this) {
            choreographerScheduled = false;
            if (! glThreadResumed || !shouldScheduleChoreographer()) {
                return;
            }
            int divider = resolveEffectiveVsyncDivider();
            vsyncTickCount++;
            if (divider <= 1 || (vsyncTickCount % divider) == 0L) {
                renderer.recordVsyncFrameTime(frameTimeNanos);
                requestRender();
            }
            choreographerScheduled = true;
            Choreographer.getInstance().postFrameCallback(this);
        }
    }

    private static float sanitizeRefreshRate(float hz) {
        if (Float.isNaN(hz) || Float.isInfinite(hz) || hz < 30.0f) {
            return 60.0f;
        }
        return Math.min(240.0f, hz);
    }

    /**
     * OpenGL ES 2.0/3.0 Renderer implementing the Apple Music / Folia flowing multi-orb +
     * Perlin/Simplex domain-warped color mesh shader with VSync-normalized deltaTime.
     */
    private static final class MeshRenderer implements GLSurfaceView.Renderer {
        private static final String VERTEX_SHADER_SOURCE =
            "attribute vec2 aPosition;\n" +
            "varying vec2 vUv;\n" +
            "void main() {\n" +
            "    vUv = aPosition * 0.5 + 0.5;\n" +
            "    gl_Position = vec4(aPosition, 0.0, 1.0);\n" +
            "}\n";

        // Smooth domain-warped Perlin/Simplex value noise + 6-orb Apple Music / Folia color mesh shader.
        private static final String FRAGMENT_SHADER_SOURCE =
            "precision mediump float;\n" +
            "varying vec2 vUv;\n" +
            "uniform float uTime;\n" +
            "uniform vec2 uResolution;\n" +
            "uniform float uBass;\n" +
            "uniform float uMid;\n" +
            "uniform float uHigh;\n" +
            "uniform float uEnergy;\n" +
            "uniform float uDim;\n" +
            "uniform vec3 uColor0;\n" +
            "uniform vec3 uColor1;\n" +
            "uniform vec3 uColor2;\n" +
            "uniform vec3 uColor3;\n" +
            "uniform vec3 uColor4;\n" +
            "uniform vec3 uColor5;\n" +
            "\n" +
            "// Smooth 2D value/gradient noise for organic Perlin-like domain warping\n" +
            "float hash21(vec2 p) {\n" +
            "    p = fract(p * vec2(123.34, 456.21));\n" +
            "    p += dot(p, p + 45.32);\n" +
            "    return fract(p.x * p.y);\n" +
            "}\n" +
            "\n" +
            "float noise2D(vec2 p) {\n" +
            "    vec2 i = floor(p);\n" +
            "    vec2 f = fract(p);\n" +
            "    vec2 u = f * f * (3.0 - 2.0 * f);\n" +
            "    float a = hash21(i);\n" +
            "    float b = hash21(i + vec2(1.0, 0.0));\n" +
            "    float c = hash21(i + vec2(0.0, 1.0));\n" +
            "    float d = hash21(i + vec2(1.0, 1.0));\n" +
            "    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);\n" +
            "}\n" +
            "\n" +
            "float fbm(vec2 p) {\n" +
            "    float v = 0.0;\n" +
            "    float a = 0.55;\n" +
            "    mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);\n" +
            "    for (int i = 0; i < 3; i++) {\n" +
            "        v += a * noise2D(p);\n" +
            "        p = rot * p * 1.92 + vec2(1.7, 9.2);\n" +
            "        a *= 0.5;\n" +
            "    }\n" +
            "    return v;\n" +
            "}\n" +
            "\n" +
            "void main() {\n" +
            "    vec2 uv = vUv;\n" +
            "    vec2 p = uv - 0.5;\n" +
            "\n" +
            "    float t = uTime;\n" +
            "    float bassPulse = 1.0 + uBass * 0.34;\n" +
            "    float midSwirl = uMid * 0.28;\n" +
            "\n" +
            "    // Perlin/FBM domain warp for liquid silk flow\n" +
            "    vec2 warp = vec2(\n" +
            "        fbm(p * 2.35 + vec2(t * 0.22, -t * 0.18)),\n" +
            "        fbm(p * 2.35 + vec2(-t * 0.19, t * 0.25) + vec2(5.2, 1.3))\n" +
            "    ) - 0.5;\n" +
            "    vec2 wp = p + warp * (0.36 + uEnergy * 0.22);\n" +
            "\n" +
            "    // 6 wide-orbiting color anchors spread across all quadrants so colors stay distinct\n" +
            "    vec2 c0 = vec2(-0.26 + sin(t * 0.43) * 0.22, -0.24 + cos(t * 0.35) * 0.22);\n" +
            "    vec2 c1 = vec2( 0.26 + cos(t * 0.39 + 1.4) * 0.22, -0.20 + sin(t * 0.47 + 0.8) * 0.22);\n" +
            "    vec2 c2 = vec2(-0.24 + sin(t * 0.31 + 2.8) * 0.22,  0.24 + cos(t * 0.51 + 2.1) * 0.22);\n" +
            "    vec2 c3 = vec2( 0.24 + cos(t * 0.49 + 4.1) * 0.22,  0.26 + sin(t * 0.33 + 3.5) * 0.22);\n" +
            "    vec2 c4 = vec2( sin(t * 0.37 + 5.0 + midSwirl) * 0.32, -0.32 + cos(t * 0.43 + 4.4) * 0.18);\n" +
            "    vec2 c5 = vec2( cos(t * 0.29 + 0.5) * 0.30,  0.32 + sin(t * 0.41 + 5.6) * 0.18);\n" +
            "\n" +
            "    float falloff = 8.4 / bassPulse;\n" +
            "    float w0 = pow(exp(-dot(wp - c0, wp - c0) * falloff), 1.65) * (1.35 + uBass * 0.50);\n" +
            "    float w1 = pow(exp(-dot(wp - c1, wp - c1) * (falloff * 1.05)), 1.65) * (1.20 + uMid * 0.40);\n" +
            "    float w2 = pow(exp(-dot(wp - c2, wp - c2) * (falloff * 0.95)), 1.65) * (1.10 + uHigh * 0.40);\n" +
            "    float w3 = pow(exp(-dot(wp - c3, wp - c3) * (falloff * 1.10)), 1.65) * 0.95;\n" +
            "    float w4 = pow(exp(-dot(wp - c4, wp - c4) * (falloff * 1.15)), 1.65) * (0.95 + uEnergy * 0.35);\n" +
            "    float w5 = pow(exp(-dot(wp - c5, wp - c5) * (falloff * 1.12)), 1.65) * 0.90;\n" +
            "\n" +
            "    vec3 baseDeep = mix(uColor3, uColor0, 0.28) * 0.14;\n" +
            "    float totalWeight = w0 + w1 + w2 + w3 + w4 + w5 + 0.55;\n" +
            "    vec3 meshColor = (\n" +
            "        uColor0 * w0 +\n" +
            "        uColor1 * w1 +\n" +
            "        uColor2 * w2 +\n" +
            "        uColor3 * w3 +\n" +
            "        uColor4 * w4 +\n" +
            "        uColor5 * w5 +\n" +
            "        baseDeep * 0.55\n" +
            "    ) / totalWeight;\n" +
            "\n" +
            "    // Subtle high-frequency shimmer from treble & FBM crest\n" +
            "    float crest = smoothstep(0.18, 0.82, warp.x + warp.y + 0.5);\n" +
            "    meshColor = mix(meshColor, max(uColor1, uColor2) * 1.12, crest * (0.14 + uHigh * 0.16));\n" +
            "\n" +
            "    // Natural vertical & radial vignette for high-contrast lyrics legibility\n" +
            "    float radialDist = length(p * vec2(0.85, 0.72));\n" +
            "    float vignette = smoothstep(1.18, 0.18, radialDist);\n" +
            "    meshColor *= mix(0.62, 1.06, vignette);\n" +
            "\n" +
            "    // Apply dynamic dimming uniform (uDim: 0 = full brightness, 1 = completely black)\n" +
            "    float keepBrightness = clamp(1.0 - uDim, 0.05, 1.0);\n" +
            "    vec3 finalColor = clamp(meshColor * keepBrightness, 0.0, 1.0);\n" +
            "    gl_FragColor = vec4(finalColor, 1.0);\n" +
            "}\n";

        private static final float[] FULLSCREEN_QUAD_COORDS = new float[] {
            -1.0f, -1.0f,
             1.0f, -1.0f,
            -1.0f,  1.0f,
             1.0f,  1.0f
        };

        private final FoliaBackgroundSurfaceView parentView;
        private final FloatBuffer vertexBuffer;
        private final Object stateLock = new Object();

        // 6 RGB palette slots: current interpolated, transition start, and transition target.
        private final float[][] currentColors = new float[PALETTE_COLOR_COUNT][3];
        private final float[][] fromColors = new float[PALETTE_COLOR_COUNT][3];
        private final float[][] targetColors = new float[PALETTE_COLOR_COUNT][3];

        private long transitionStartNs = 0L;
        private long transitionDurationNs = 0L;
        private boolean paletteTransitionActive = false;

        private float currentDim = 0.28f;
        private float targetDim = 0.28f;
        private float smoothBass = 0.08f;
        private float smoothMid = 0.06f;
        private float smoothHigh = 0.04f;
        private float smoothEnergy = 0.06f;
        private float targetBass = 0.08f;
        private float targetMid = 0.06f;
        private float targetHigh = 0.04f;
        private float targetEnergy = 0.06f;

        private float accumulatedShaderTime = 0.0f;
        private long lastFrameNs = 0L;
        private volatile long latestVsyncFrameTimeNs = 0L;

        private int programId = 0;
        private int aPositionLoc = -1;
        private int uTimeLoc = -1;
        private int uResolutionLoc = -1;
        private int uBassLoc = -1;
        private int uMidLoc = -1;
        private int uHighLoc = -1;
        private int uEnergyLoc = -1;
        private int uDimLoc = -1;
        private final int[] uColorLocs = new int[PALETTE_COLOR_COUNT];
        private int surfaceWidth = INTERNAL_BUFFER_WIDTH;
        private int surfaceHeight = INTERNAL_BUFFER_HEIGHT;

        MeshRenderer(FoliaBackgroundSurfaceView parentView) {
            this.parentView = parentView;
            ByteBuffer bb = ByteBuffer.allocateDirect(FULLSCREEN_QUAD_COORDS.length * 4);
            bb.order(ByteOrder.nativeOrder());
            this.vertexBuffer = bb.asFloatBuffer();
            this.vertexBuffer.put(FULLSCREEN_QUAD_COORDS);
            this.vertexBuffer.position(0);

            // Default cohesive Folia indigo/violet/magenta/teal palette
            float[][] defaults = new float[][] {
                { 0.36f, 0.22f, 0.78f }, // Deep Indigo
                { 0.58f, 0.24f, 0.86f }, // Vibrant Violet
                { 0.16f, 0.48f, 0.82f }, // Ocean Blue
                { 0.12f, 0.10f, 0.28f }, // Midnight Base
                { 0.76f, 0.26f, 0.62f }, // Warm Magenta
                { 0.18f, 0.64f, 0.68f }  // Cyan Glow
            };
            for (int i = 0; i < PALETTE_COLOR_COUNT; i++) {
                System.arraycopy(defaults[i], 0, currentColors[i], 0, 3);
                System.arraycopy(defaults[i], 0, fromColors[i], 0, 3);
                System.arraycopy(defaults[i], 0, targetColors[i], 0, 3);
            }
        }

        void recordVsyncFrameTime(long vsyncFrameTimeNs) {
            this.latestVsyncFrameTimeNs = vsyncFrameTimeNs;
        }

        void resetFrameClock() {
            synchronized (stateLock) {
                this.lastFrameNs = 0L;
                this.latestVsyncFrameTimeNs = 0L;
            }
        }

        void setTargetDim(float dim) {
            synchronized (stateLock) {
                float clamped = Math.max(0.0f, Math.min(0.92f, dim));
                if (Math.abs(clamped - this.targetDim) > 0.005f) {
                    this.targetDim = clamped;
                }
            }
        }

        void setPaletteColors(@Nullable String[] hexColors, int transitionMs) {
            if (hexColors == null || hexColors.length == 0) return;
            float[][] parsed = new float[PALETTE_COLOR_COUNT][3];
            int validCount = 0;
            for (String raw : hexColors) {
                if (raw == null || raw.trim().isEmpty()) continue;
                float[] rgb = parseColorToNormalizedRgb(raw.trim());
                if (rgb != null) {
                    parsed[validCount] = rgb;
                    validCount++;
                    if (validCount >= PALETTE_COLOR_COUNT) break;
                }
            }
            if (validCount == 0) return;
            for (int i = validCount; i < PALETTE_COLOR_COUNT; i++) {
                float[] src = parsed[i % validCount];
                float scale = (i % 2 == 0) ? 0.78f : 1.12f;
                parsed[i][0] = Math.min(1.0f, src[0] * scale);
                parsed[i][1] = Math.min(1.0f, src[1] * scale);
                parsed[i][2] = Math.min(1.0f, src[2] * scale);
            }

            synchronized (stateLock) {
                for (int i = 0; i < PALETTE_COLOR_COUNT; i++) {
                    System.arraycopy(currentColors[i], 0, fromColors[i], 0, 3);
                    System.arraycopy(parsed[i], 0, targetColors[i], 0, 3);
                }
                int clampedMs = Math.max(0, Math.min(5000, transitionMs));
                if (clampedMs <= 16) {
                    for (int i = 0; i < PALETTE_COLOR_COUNT; i++) {
                        System.arraycopy(targetColors[i], 0, currentColors[i], 0, 3);
                    }
                    paletteTransitionActive = false;
                } else {
                    transitionStartNs = SystemClock.elapsedRealtimeNanos();
                    transitionDurationNs = clampedMs * 1_000_000L;
                    paletteTransitionActive = true;
                }
            }
        }

        void setAudioEnergy(float bass, float mid, float high, boolean isPlaying) {
            synchronized (stateLock) {
                if (isPlaying) {
                    this.targetBass = clamp01(bass);
                    this.targetMid = clamp01(mid);
                    this.targetHigh = clamp01(high);
                    this.targetEnergy = clamp01(bass * 0.50f + mid * 0.32f + high * 0.18f);
                } else {
                    this.targetBass = 0.04f;
                    this.targetMid = 0.03f;
                    this.targetHigh = 0.02f;
                    this.targetEnergy = 0.03f;
                }
            }
        }

        boolean isTransitionActive() {
            synchronized (stateLock) {
                return paletteTransitionActive || Math.abs(currentDim - targetDim) > 0.01f;
            }
        }

        @Override
        public void onSurfaceCreated(GL10 gl, EGLConfig config) {
            GLES20.glDisable(GLES20.GL_DEPTH_TEST);
            GLES20.glDisable(GLES20.GL_CULL_FACE);
            GLES20.glDisable(GLES20.GL_BLEND);
            GLES20.glClearColor(0.035f, 0.035f, 0.045f, 1.0f);

            int vertexShader = compileShader(GLES20.GL_VERTEX_SHADER, VERTEX_SHADER_SOURCE);
            int fragmentShader = compileShader(GLES20.GL_FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
            programId = GLES20.glCreateProgram();
            GLES20.glAttachShader(programId, vertexShader);
            GLES20.glAttachShader(programId, fragmentShader);
            GLES20.glLinkProgram(programId);

            aPositionLoc = GLES20.glGetAttribLocation(programId, "aPosition");
            uTimeLoc = GLES20.glGetUniformLocation(programId, "uTime");
            uResolutionLoc = GLES20.glGetUniformLocation(programId, "uResolution");
            uBassLoc = GLES20.glGetUniformLocation(programId, "uBass");
            uMidLoc = GLES20.glGetUniformLocation(programId, "uMid");
            uHighLoc = GLES20.glGetUniformLocation(programId, "uHigh");
            uEnergyLoc = GLES20.glGetUniformLocation(programId, "uEnergy");
            uDimLoc = GLES20.glGetUniformLocation(programId, "uDim");
            for (int i = 0; i < PALETTE_COLOR_COUNT; i++) {
                uColorLocs[i] = GLES20.glGetUniformLocation(programId, "uColor" + i);
            }
            lastFrameNs = 0L;
        }

        @Override
        public void onSurfaceChanged(GL10 gl, int width, int height) {
            surfaceWidth = Math.max(1, width);
            surfaceHeight = Math.max(1, height);
            GLES20.glViewport(0, 0, surfaceWidth, surfaceHeight);
        }

        @Override
        public void onDrawFrame(GL10 gl) {
            long monotonicNowNs = SystemClock.elapsedRealtimeNanos();
            long vsyncNs = this.latestVsyncFrameTimeNs;
            long clockNs = vsyncNs > 0L ? vsyncNs : monotonicNowNs;
            float nominalDtSec = 1.0f / Math.max(30.0f, parentView.getDisplayRefreshRateHz());
            float dtSec = (lastFrameNs > 0L && clockNs > lastFrameNs)
                ? Math.min(0.12f, Math.max(0.001f, (clockNs - lastFrameNs) / 1_000_000_000.0f))
                : nominalDtSec;
            lastFrameNs = clockNs;

            boolean transitionJustCompleted = false;

            synchronized (stateLock) {
                // Frame-rate-independent exponential damping (1 - exp(-lambda * dt)) so audio bands
                // and dimming respond identically at 30fps, 45fps, 60fps, 90fps, or 120fps.
                float audioSmoothing = 1.0f - (float) Math.exp(-10.0 * dtSec);
                float dimSmoothing = 1.0f - (float) Math.exp(-8.0 * dtSec);
                smoothBass += (targetBass - smoothBass) * audioSmoothing;
                smoothMid += (targetMid - smoothMid) * audioSmoothing;
                smoothHigh += (targetHigh - smoothHigh) * audioSmoothing;
                smoothEnergy += (targetEnergy - smoothEnergy) * audioSmoothing;
                currentDim += (targetDim - currentDim) * dimSmoothing;

                // Advance shader time scaled by actual elapsed dtSec so visual speed is identical
                // whether the display is running at 60Hz, 90Hz, or 120Hz.
                float baseSpeed = parentView.isAudioActivelyPlaying() ? (0.55f + smoothEnergy * 0.85f) : 0.12f;
                accumulatedShaderTime += dtSec * baseSpeed;

                if (paletteTransitionActive) {
                    long elapsedNs = monotonicNowNs - transitionStartNs;
                    float rawProgress = transitionDurationNs > 0L
                        ? Math.min(1.0f, Math.max(0.0f, (float) elapsedNs / (float) transitionDurationNs))
                        : 1.0f;
                    // Cubic smoothstep interpolation between previous song's palette and new song's palette
                    float eased = rawProgress * rawProgress * (3.0f - 2.0f * rawProgress);
                    for (int i = 0; i < PALETTE_COLOR_COUNT; i++) {
                        currentColors[i][0] = fromColors[i][0] + (targetColors[i][0] - fromColors[i][0]) * eased;
                        currentColors[i][1] = fromColors[i][1] + (targetColors[i][1] - fromColors[i][1]) * eased;
                        currentColors[i][2] = fromColors[i][2] + (targetColors[i][2] - fromColors[i][2]) * eased;
                    }
                    if (rawProgress >= 1.0f) {
                        paletteTransitionActive = false;
                        transitionJustCompleted = true;
                    }
                }
            }

            if (programId != 0) {
                GLES20.glUseProgram(programId);
                GLES20.glUniform1f(uTimeLoc, accumulatedShaderTime);
                GLES20.glUniform2f(uResolutionLoc, (float) surfaceWidth, (float) surfaceHeight);
                GLES20.glUniform1f(uBassLoc, smoothBass);
                GLES20.glUniform1f(uMidLoc, smoothMid);
                GLES20.glUniform1f(uHighLoc, smoothHigh);
                GLES20.glUniform1f(uEnergyLoc, smoothEnergy);
                GLES20.glUniform1f(uDimLoc, currentDim);

                synchronized (stateLock) {
                    for (int i = 0; i < PALETTE_COLOR_COUNT; i++) {
                        GLES20.glUniform3f(
                            uColorLocs[i],
                            currentColors[i][0],
                            currentColors[i][1],
                            currentColors[i][2]
                        );
                    }
                }

                vertexBuffer.position(0);
                GLES20.glEnableVertexAttribArray(aPositionLoc);
                GLES20.glVertexAttribPointer(aPositionLoc, 2, GLES20.GL_FLOAT, false, 0, vertexBuffer);
                GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4);
                GLES20.glDisableVertexAttribArray(aPositionLoc);
            }

            if (transitionJustCompleted && !parentView.isAudioActivelyPlaying()) {
                parentView.notifyTransitionFinished();
            }
        }

        private static int compileShader(int type, String source) {
            int shader = GLES20.glCreateShader(type);
            GLES20.glShaderSource(shader, source);
            GLES20.glCompileShader(shader);
            return shader;
        }

        private static float clamp01(float val) {
            if (Float.isNaN(val)) return 0.0f;
            return Math.max(0.0f, Math.min(1.0f, val));
        }

        @Nullable
        private static float[] parseColorToNormalizedRgb(String colorStr) {
            try {
                if (colorStr.startsWith("#")) {
                    int parsed = Color.parseColor(colorStr);
                    return new float[] {
                        Color.red(parsed) / 255.0f,
                        Color.green(parsed) / 255.0f,
                        Color.blue(parsed) / 255.0f
                    };
                }
                if (colorStr.startsWith("rgb")) {
                    int open = colorStr.indexOf('(');
                    int close = colorStr.indexOf(')');
                    if (open >= 0 && close > open) {
                        String[] parts = colorStr.substring(open + 1, close).split("[,\\s/]+");
                        if (parts.length >= 3) {
                            float r = Float.parseFloat(parts[0].trim()) / 255.0f;
                            float g = Float.parseFloat(parts[1].trim()) / 255.0f;
                            float b = Float.parseFloat(parts[2].trim()) / 255.0f;
                            return new float[] { clamp01(r), clamp01(g), clamp01(b) };
                        }
                    }
                }
            } catch (Exception ignored) {
                // Fall through
            }
            return null;
        }
    }
}
