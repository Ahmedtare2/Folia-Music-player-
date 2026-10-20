// src/services/onlineMusic/runtimeApiConfig.ts
// Manages runtime-configurable online provider API base URLs (persisted in localStorage)
// and provides honest capability/availability diagnostics and offline-to-online transition monitoring.

export type ConfigurableOnlineProviderId = 'netease' | 'qq' | 'kugou';

export const RUNTIME_API_BASE_STORAGE_KEYS: Record<ConfigurableOnlineProviderId, string> = {
    netease: 'folia_netease_api_base',
    qq: 'folia_qq_api_base',
    kugou: 'folia_kugou_api_base',
};

export const RUNTIME_API_CHANGED_EVENT = 'folia:runtime-api-config-changed';

const sanitizeBaseUrl = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim().replace(/\/+$/, '');
    if (!trimmed) return '';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
        return trimmed;
    }
    return `https://${trimmed}`;
};

export const getStoredRuntimeApiBase = (providerId: ConfigurableOnlineProviderId): string => {
    try {
        if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
            return '';
        }
        return sanitizeBaseUrl(localStorage.getItem(RUNTIME_API_BASE_STORAGE_KEYS[providerId]));
    } catch {
        return '';
    }
};

export const setStoredRuntimeApiBase = (providerId: ConfigurableOnlineProviderId, url: string): string => {
    const clean = sanitizeBaseUrl(url);
    try {
        if (typeof localStorage !== 'undefined') {
            if (clean) {
                localStorage.setItem(RUNTIME_API_BASE_STORAGE_KEYS[providerId], clean);
            } else {
                localStorage.removeItem(RUNTIME_API_BASE_STORAGE_KEYS[providerId]);
            }
        }
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new CustomEvent(RUNTIME_API_CHANGED_EVENT, { detail: { providerId, url: clean } }));
        }
    } catch {
        // Ignore storage errors
    }
    return clean;
};

export const getEnvApiBase = (providerId: ConfigurableOnlineProviderId): string => {
    const envKey = providerId === 'netease'
        ? 'VITE_NETEASE_API_BASE'
        : providerId === 'qq'
            ? 'VITE_QQ_API_BASE'
            : 'VITE_KUGOU_API_BASE';

    const viteEnv = typeof import.meta !== 'undefined' ? (import.meta as unknown as { env?: Record<string, unknown> }).env : undefined;
    if (viteEnv && viteEnv.MODE !== 'test' && typeof viteEnv[envKey] === 'string' && viteEnv[envKey]) {
        return sanitizeBaseUrl(viteEnv[envKey]);
    }
    if (typeof process !== 'undefined' && process.env && typeof process.env[envKey] === 'string' && process.env[envKey]) {
        return sanitizeBaseUrl(process.env[envKey]);
    }
    return '';
};

export const resolveProviderWebApiBase = (providerId: ConfigurableOnlineProviderId): string => {
    return getStoredRuntimeApiBase(providerId) || getEnvApiBase(providerId);
};

export const isElectronBridgeAvailable = (): boolean => (
    typeof window !== 'undefined' && Boolean((window as Window & { electron?: unknown }).electron)
);

export type OnlineServiceAvailabilityKind =
    | 'ready'
    | 'offline'
    | 'needs_api_base'
    | 'needs_desktop_bridge'
    | 'needs_navidrome_config';

export interface OnlineServiceDiagnostic {
    id: string;
    label: string;
    availability: OnlineServiceAvailabilityKind;
    endpointUrl: string | null;
    canConfigureEndpoint: boolean;
    summary: string;
    detail: string;
}

export const getIsDeviceOnline = (): boolean => {
    if (typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean') {
        return true;
    }
    return navigator.onLine;
};

export const subscribeDeviceOnlineStatus = (listener: (online: boolean) => void): (() => void) => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
        return () => {};
    }
    const onOnline = () => listener(true);
    const onOffline = () => listener(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
    };
};

export const getOnlineProviderDiagnostic = (providerId: string): OnlineServiceDiagnostic => {
    const online = getIsDeviceOnline();
    const isElectron = isElectronBridgeAvailable();

    if (providerId === 'amll-db') {
        return {
            id: 'amll-db',
            label: 'AMLL TTML Lyrics DB',
            availability: online ? 'ready' : 'offline',
            endpointUrl: 'https://api.amll.dev',
            canConfigureEndpoint: false,
            summary: online ? 'Direct CORS TTML lyrics search & download ready' : 'Device is offline',
            detail: online
                ? 'Connects directly to https://api.amll.dev for word/syllable-timed TTML lyrics without requiring a custom proxy.'
                : 'Reconnect to the internet to search AMLL TTML lyrics. Locally stored and cached lyrics remain available offline.',
        };
    }

    if (providerId === 'netease' || providerId === 'qq' || providerId === 'kugou') {
        const label = providerId === 'netease'
            ? 'NetEase Cloud Music (网易云音乐)'
            : providerId === 'qq'
                ? 'QQ Music (QQ音乐)'
                : 'KuGou Music (酷狗音乐)';
        const base = isElectron ? 'http://127.0.0.1 (Embedded Electron Worker)' : resolveProviderWebApiBase(providerId);
        if (!online) {
            return {
                id: providerId,
                label,
                availability: 'offline',
                endpointUrl: base || null,
                canConfigureEndpoint: !isElectron,
                summary: 'Offline — network connection required',
                detail: 'Online search, playlists, and streaming for this provider require an active internet connection.',
            };
        }
        if (!base) {
            const envName = providerId === 'netease'
                ? 'VITE_NETEASE_API_BASE'
                : providerId === 'qq'
                    ? 'VITE_QQ_API_BASE'
                    : 'VITE_KUGOU_API_BASE';
            return {
                id: providerId,
                label,
                availability: 'needs_api_base',
                endpointUrl: null,
                canConfigureEndpoint: true,
                summary: 'API backend URL required on Android / Web',
                detail: `${label} requires a deployed API gateway URL (${envName} or configured in Backends below) to proxy requests and sign parameters.`,
            };
        }
        return {
            id: providerId,
            label,
            availability: 'ready',
            endpointUrl: base,
            canConfigureEndpoint: !isElectron,
            summary: `Configured (${base})`,
            detail: `Using API endpoint ${base} for search, playlists, discovery, and account sessions.`,
        };
    }

    if (providerId === 'bodian' || providerId === 'ytm' || providerId === 'spotify') {
        const label = providerId === 'bodian'
            ? 'BoDian Music (波点音乐)'
            : providerId === 'ytm'
                ? 'YouTube Music'
                : 'Spotify';
        if (isElectron) {
            return {
                id: providerId,
                label,
                availability: online ? 'ready' : 'offline',
                endpointUrl: 'electron://ipc-bridge',
                canConfigureEndpoint: false,
                summary: online ? 'Desktop IPC bridge active' : 'Offline',
                detail: 'Connected via Electron main-process native bridge.',
            };
        }
        const reason = providerId === 'spotify'
            ? 'Spotify playback in Folia relies on the native Node module @lox-audioserver/node-librespot and Electron main-process IPC (electron/spotify/spotifyApiBridge.cjs), which cannot run inside an Android WebView.'
            : providerId === 'ytm'
                ? 'YouTube Music in Folia relies on the Electron main-process InnerTube + BotGuard poToken sandbox bridge (electron/ytm/ytmApiBridge.cjs), which is desktop-only.'
                : 'BoDian Music in Folia relies on the Electron main-process IPC bridge (electron/bodian/bodianApiBridge.cjs) and is desktop-only.';
        return {
            id: providerId,
            label,
            availability: 'needs_desktop_bridge',
            endpointUrl: null,
            canConfigureEndpoint: false,
            summary: 'Desktop Electron runtime required',
            detail: reason,
        };
    }

    return {
        id: providerId,
        label: providerId,
        availability: online ? 'ready' : 'offline',
        endpointUrl: null,
        canConfigureEndpoint: false,
        summary: online ? 'Available' : 'Offline',
        detail: '',
    };
};
