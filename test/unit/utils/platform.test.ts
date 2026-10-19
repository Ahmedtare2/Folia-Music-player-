import { afterEach, describe, expect, it } from 'vitest';
import {
    getCapacitorPlatform,
    isAndroidNativeApp,
    isAndroidUserAgent,
    isCapacitorNativePlatform,
    isElectronPlatform,
    shouldDisableWebPwaServiceWorker,
} from '../../../src/utils/platform';

// test/unit/utils/platform.test.ts
// Verifies Capacitor Android, Electron desktop, and browser runtime detection in src/utils/platform.ts.

describe('platform detection utilities', () => {
    const originalCapacitor = (globalThis as { Capacitor?: unknown }).Capacitor;
    const originalWindow = (globalThis as { window?: unknown }).window;
    const originalNavigator = (globalThis as { navigator?: unknown }).navigator;

    afterEach(() => {
        if (originalCapacitor === undefined) {
            delete (globalThis as { Capacitor?: unknown }).Capacitor;
        } else {
            (globalThis as { Capacitor?: unknown }).Capacitor = originalCapacitor;
        }
        if (originalWindow === undefined) {
            delete (globalThis as { window?: unknown }).window;
        } else {
            (globalThis as { window?: unknown }).window = originalWindow;
        }
        if (originalNavigator === undefined) {
            delete (globalThis as { navigator?: unknown }).navigator;
        } else {
            Object.defineProperty(globalThis, 'navigator', {
                configurable: true,
                value: originalNavigator,
            });
        }
    });

    it('defaults to web platform when neither Capacitor nor Electron globals are present', () => {
        delete (globalThis as { Capacitor?: unknown }).Capacitor;
        (globalThis as { window?: unknown }).window = {};

        expect(getCapacitorPlatform()).toBe('web');
        expect(isCapacitorNativePlatform()).toBe(false);
        expect(isAndroidNativeApp()).toBe(false);
        expect(isElectronPlatform()).toBe(false);
        expect(shouldDisableWebPwaServiceWorker()).toBe(false);
    });

    it('detects Capacitor Android native shell and disables web PWA service worker registration', () => {
        (globalThis as { Capacitor?: unknown }).Capacitor = {
            getPlatform: () => 'android',
            isNativePlatform: () => true,
        };
        (globalThis as { window?: unknown }).window = {};

        expect(getCapacitorPlatform()).toBe('android');
        expect(isCapacitorNativePlatform()).toBe(true);
        expect(isAndroidNativeApp()).toBe(true);
        expect(shouldDisableWebPwaServiceWorker()).toBe(true);
    });

    it('detects Electron desktop runtime and disables web PWA service worker registration', () => {
        delete (globalThis as { Capacitor?: unknown }).Capacitor;
        (globalThis as { window?: unknown }).window = {
            electron: { isElectron: true },
        };

        expect(isElectronPlatform()).toBe(true);
        expect(isAndroidNativeApp()).toBe(false);
        expect(shouldDisableWebPwaServiceWorker()).toBe(true);
    });

    it('detects Android user agent string', () => {
        Object.defineProperty(globalThis, 'navigator', {
            configurable: true,
            value: {
                userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/134.0.0.0 Mobile Safari/537.36',
            },
        });
        expect(isAndroidUserAgent()).toBe(true);
    });
});
