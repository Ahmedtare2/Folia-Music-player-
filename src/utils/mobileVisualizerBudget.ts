import type { LumiereRenderQuality } from '../types';
import { isAndroidNativeApp, isAndroidUserAgent, isCapacitorNativePlatform, isElectronPlatform, isMobilePhoneViewport } from './platform';

// src/utils/mobileVisualizerBudget.ts
// GPU, DPR, texture-resolution, and background lifecycle budgets for mobile/Android visualizers.
// Preserves the full Folia visualizer catalog while keeping off-screen Canvas 2D and WebGL/Pixi
// allocations bounded on high-DPI phone displays (where raw devicePixelRatio is often 2.75..3.5).

export const MOBILE_MAX_CANVAS_DPR = 1.5;
export const DESKTOP_MAX_CANVAS_DPR = 2.0;
export const MOBILE_MAX_PIXI_RESOLUTION = 1.25;
export const MOBILE_MAX_TEXTURE_AXIS_PX = 1536;

/** Whether the active runtime is a mobile/Android device with mobile GPU/thermal constraints. */
export const isMobileGpuConstrained = (options?: {
    viewportWidth?: number;
    viewportHeight?: number;
}): boolean => {
    if (isElectronPlatform()) return false;
    if (isCapacitorNativePlatform() || isAndroidNativeApp() || isAndroidUserAgent()) {
        return true;
    }
    return isMobilePhoneViewport(options?.viewportWidth, options?.viewportHeight);
};

/**
 * Caps `window.devicePixelRatio` for full-viewport 2D/WebGL canvases so 1440p phones (DPR 3.0–3.5)
 * do not allocate 9x–12x pixel buffers while preserving crisp typography at 1.5x on OLED panels.
 */
export const resolveMobileCanvasDpr = (
    rawDpr?: number,
    isMobile: boolean = isMobileGpuConstrained(),
    maxMobileDpr: number = MOBILE_MAX_CANVAS_DPR,
    maxDesktopDpr: number = DESKTOP_MAX_CANVAS_DPR,
): number => {
    const safeRaw = typeof rawDpr === 'number' && Number.isFinite(rawDpr) && rawDpr > 0
        ? rawDpr
        : (typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio) && window.devicePixelRatio > 0
            ? window.devicePixelRatio
            : 1);
    const cap = isMobile ? maxMobileDpr : maxDesktopDpr;
    return Math.min(cap, Math.max(1, safeRaw));
};

/**
 * Caps Pixi renderer/filter resolution on mobile devices so full-screen filter targets do not
 * spill into 2048x2048 or 4096x4096 power-of-two TexturePool buckets on tall phone viewports.
 */
export const resolveMobilePixiResolution = (
    cssWidth: number,
    cssHeight: number,
    requestedResolution: number,
    isMobile: boolean = isMobileGpuConstrained({ viewportWidth: cssWidth, viewportHeight: cssHeight }),
): number => {
    const safeRequested = Number.isFinite(requestedResolution) && requestedResolution > 0
        ? requestedResolution
        : 1;
    if (!isMobile) {
        return safeRequested;
    }

    const cappedByConstant = Math.min(safeRequested, MOBILE_MAX_PIXI_RESOLUTION);
    const maxDimension = Math.max(cssWidth || 0, cssHeight || 0);
    if (maxDimension <= 0 || !Number.isFinite(maxDimension)) {
        return cappedByConstant;
    }

    const axisCap = MOBILE_MAX_TEXTURE_AXIS_PX / maxDimension;
    return Math.max(0.75, Math.min(cappedByConstant, axisCap));
};

/**
 * Resolves the effective Lumiere quality profile on mobile devices.
 * Maps 'full' -> 'balanced' on mobile GPUs so full-screen fog FBM octaves and bloom targets stay smooth,
 * while honoring 'low' if explicitly chosen by the user.
 */
export const resolveMobileLumiereQuality = (
    requestedQuality: LumiereRenderQuality,
    isMobile: boolean = isMobileGpuConstrained(),
): LumiereRenderQuality => {
    if (!isMobile) return requestedQuality;
    return requestedQuality === 'full' ? 'balanced' : requestedQuality;
};

/**
 * Determines whether heavy visualizer rendering loops should be paused/suspended to save battery and GPU.
 * Suspends when:
 * 1. The Android Activity is in the background or the screen is locked (`!isActivityVisible`),
 * 2. The browser document is hidden (`!isDocumentVisible`), or
 * 3. The mobile shell is active and the user is browsing the library or viewing Cover-only mode
 *    where the full-screen visualizer is not on screen (`isMobileShellActive && !isMobileVisualizerVisible`).
 */
export const shouldSuspendVisualizerForVisibility = ({
    isActivityVisible,
    isDocumentVisible,
    isMobileShellActive,
    isMobileVisualizerVisible,
}: {
    isActivityVisible: boolean;
    isDocumentVisible: boolean;
    isMobileShellActive: boolean;
    isMobileVisualizerVisible: boolean;
}): boolean => {
    if (!isActivityVisible || !isDocumentVisible) {
        return true;
    }
    if (isMobileShellActive && !isMobileVisualizerVisible) {
        return true;
    }
    return false;
};
