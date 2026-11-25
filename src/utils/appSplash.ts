// src/utils/appSplash.ts
// 控制 index.html 内联的首屏加载遮罩：React 挂载后淡出，动画结束再从 DOM 摘掉。
// The splash is kept on screen for a minimum time (measured from the start of the page load), so a fast start still shows the
// whole opening animation instead of a flash. The F animation loops every 2400 ms; the minimum is one full turn plus its fade-in.

const SPLASH_ELEMENT_ID = 'app-splash';
// 与 index.html 中 #app-splash 的 transition 时长保持一致。
const FADE_OUT_MS = 320;
/** The shortest time the splash stays up, from navigation start. */
export const SPLASH_MIN_VISIBLE_MS = 2800;
/** With reduced motion the animation is not played, so the splash only has to be a short, calm beat. */
export const SPLASH_MIN_VISIBLE_REDUCED_MS = 700;

/** How much longer the splash must stay up, given the time since the page started loading. Never negative. */
export const splashRemainingMs = (elapsedMs: number, reducedMotion: boolean): number => {
    const minimum = reducedMotion ? SPLASH_MIN_VISIBLE_REDUCED_MS : SPLASH_MIN_VISIBLE_MS;
    if (!Number.isFinite(elapsedMs)) return 0;
    return Math.max(0, minimum - Math.max(0, elapsedMs));
};

let hideScheduled = false;

const fadeAndRemove = (splash: HTMLElement) => {
    splash.classList.add('is-hiding');
    window.setTimeout(() => splash.remove(), FADE_OUT_MS);
};

// 淡出并移除首屏加载遮罩；遮罩不存在（OBS 源已提前移除、或已经调用过）时是空操作。
export const hideAppSplash = (): void => {
    const splash = document.getElementById(SPLASH_ELEMENT_ID);
    if (!splash || hideScheduled) {
        return;
    }
    hideScheduled = true;
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const wait = splashRemainingMs(typeof performance !== 'undefined' ? performance.now() : Number.POSITIVE_INFINITY, reduced);
    if (wait <= 0) {
        fadeAndRemove(splash);
        return;
    }
    window.setTimeout(() => {
        const current = document.getElementById(SPLASH_ELEMENT_ID);
        if (current) fadeAndRemove(current);
    }, wait);
};
