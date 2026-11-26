import { getLocalLibraryAvailability } from '../services/localLibraryAvailability';

// src/utils/webBuildTag.ts
// On a browser without a folder picker (iPhone and iPad Safari) a small tag in the corner shows which build is running and
// whether folder import is available. Tapping it clears the web app's cached copy and reloads, because a home-screen web app
// can keep serving an old build. It does nothing on desktop, Electron and the Android app.

export const WEB_BUILD_TAG = 'web-v20';

export const installWebBuildTag = (): void => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (window.electron || 'showDirectoryPicker' in window) return;
    if (/folia-android|capacitor/i.test(navigator.userAgent) || (window as unknown as { Capacitor?: unknown }).Capacitor) return;
    const show = () => {
        const availability = getLocalLibraryAvailability();
        const el = document.createElement('div');
        el.id = 'folia-web-build-tag';
        const storage = typeof navigator.storage?.getDirectory === 'function' ? 'yes' : 'no';
        el.textContent = `${WEB_BUILD_TAG} | folder: ${availability.supported ? 'on' : `off (${availability.reason ?? '?'})`} | storage: ${storage} | tap to refresh`;
        el.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:2147483647;font:10px/1.2 system-ui,sans-serif;color:#fff;background:rgba(0,0,0,.55);padding:3px 6px;border-radius:6px;opacity:.7;';
        el.addEventListener('click', async () => {
            try {
                const regs = await navigator.serviceWorker?.getRegistrations?.();
                await Promise.all((regs ?? []).map(reg => reg.unregister()));
                const keys = await caches?.keys?.();
                await Promise.all((keys ?? []).map(key => caches.delete(key)));
            } catch { /* reload anyway */ }
            window.location.reload();
        });
        document.body.appendChild(el);
    };
    if (document.body) show(); else window.addEventListener('DOMContentLoaded', show, { once: true });
};
