import { isLocalCoverWebRuntimeSupported, isValidLocalCoverAssetId, readLocalCoverBinaryBlob } from './localCoverBinaryStore';
import { migrateLegacyLocalCoverAssetsInBackground } from './localCoverAssetService';
import { isLocalCoverAssetUrl } from './localCoverAssetUrl';
import { isCapacitorNativePlatform } from '../utils/platform';

// src/services/localCoverRuntime.ts
// Re-requests local covers that failed before the Web resource route served them, then starts resumable legacy migration.
// In Capacitor native shells where the web PWA service worker is disabled to protect native plugin injection, resolves
// /__folia_cover/ images directly from OPFS into cached object URLs.

const WEB_COVER_PATH_PREFIX = '/__folia_cover/';
const FOLIA_COVER_PROTOCOL_PREFIX = 'folia-cover://asset/';
const capacitorCoverBlobUrls = new Map<string, string>();
const sharedObjectUrlSet = new Set<string>();
const inflightCoverResolutions = new Map<string, Promise<string | null>>();
let capacitorCoverFallbackInstalled = false;

const SHA256_ASSET_ID_PATTERN = /^sha256:[a-f0-9]{64}$/i;

export const extractAssetIdFromCoverUrl = (url: string | null | undefined): string | null => {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (SHA256_ASSET_ID_PATTERN.test(trimmed)) {
    return trimmed;
  }
  let pathPart = '';
  const webPrefixIdx = trimmed.indexOf(WEB_COVER_PATH_PREFIX);
  if (webPrefixIdx !== -1) {
    pathPart = trimmed.slice(webPrefixIdx + WEB_COVER_PATH_PREFIX.length).split('?')[0] || '';
  } else if (trimmed.startsWith(FOLIA_COVER_PROTOCOL_PREFIX)) {
    pathPart = trimmed.slice(FOLIA_COVER_PROTOCOL_PREFIX.length).split('?')[0] || '';
  } else {
    return null;
  }
  try {
    const decoded = decodeURIComponent(pathPart);
    const valid = typeof isValidLocalCoverAssetId === 'function'
      ? isValidLocalCoverAssetId(decoded)
      : SHA256_ASSET_ID_PATTERN.test(decoded);
    return valid ? decoded : null;
  } catch {
    return null;
  }
};

/**
 * Synchronously returns an already-resolved `blob:` object URL for a `/__folia_cover/*` URL or asset ID,
 * or `null` if it has not been resolved into memory yet.
 */
export const getCachedLocalCoverObjectUrl = (urlOrAssetId: string | null | undefined): string | null => {
  const assetId = extractAssetIdFromCoverUrl(urlOrAssetId);
  if (!assetId) return null;
  return capacitorCoverBlobUrls.get(assetId) ?? null;
};

/**
 * Returns true when `url` is a shared `blob:` object URL managed by `localCoverRuntime` and must not
 * be revoked by individual component/player cleanup hooks.
 */
export const isSharedLocalCoverObjectUrl = (url: string | null | undefined): boolean => (
  typeof url === 'string' && sharedObjectUrlSet.has(url)
);

/**
 * Resolves a `/__folia_cover/sha256:...` URL directly from OPFS into a reusable `blob:` object URL
 * when running without a service worker (e.g. Android Capacitor).
 */
export const resolveLocalCoverObjectUrl = async (url: string | null | undefined): Promise<string | null> => {
  const assetId = extractAssetIdFromCoverUrl(url);
  if (!assetId) return null;

  const cachedUrl = capacitorCoverBlobUrls.get(assetId);
  if (cachedUrl) {
    return cachedUrl;
  }

  const pending = inflightCoverResolutions.get(assetId);
  if (pending) {
    return pending;
  }

  const request = (async () => {
    try {
      const blob = await readLocalCoverBinaryBlob(assetId);
      if (!blob || blob.size <= 0 || typeof URL.createObjectURL !== 'function') return null;
      let objectUrl = capacitorCoverBlobUrls.get(assetId);
      if (!objectUrl) {
        objectUrl = URL.createObjectURL(blob);
        capacitorCoverBlobUrls.set(assetId, objectUrl);
        sharedObjectUrlSet.add(objectUrl);
      }
      return objectUrl;
    } catch {
      return null;
    } finally {
      inflightCoverResolutions.delete(assetId);
    }
  })();

  inflightCoverResolutions.set(assetId, request);
  return request;
};

/**
 * Resolves any cover URL (`/__folia_cover/*`, `folia-cover://asset/*`, `blob:*`, `https:*`) into a
 * directly renderable URL for `<img>`, `new Image()`, or CSS `background-image`.
 */
export const resolvePlayableCoverUrl = async (url: string | null | undefined): Promise<string | null> => {
  if (!url) return null;
  if (extractAssetIdFromCoverUrl(url)) {
    const objectUrl = await resolveLocalCoverObjectUrl(url);
    return objectUrl || url;
  }
  return url;
};

const hydrateCapacitorCoverImage = async (image: HTMLImageElement): Promise<void> => {
  const source = image.getAttribute('src');
  const objectUrl = await resolveLocalCoverObjectUrl(source);
  if (!objectUrl) return;
  if (image.isConnected && image.getAttribute('src') === source && image.getAttribute('src') !== objectUrl) {
    image.setAttribute('data-folia-cover-src', source!);
    image.src = objectUrl;
  }
};

const installCapacitorLocalCoverFallback = (): void => {
  if (capacitorCoverFallbackInstalled || typeof document === 'undefined') return;
  capacitorCoverFallbackInstalled = true;

  // Unregister any stale web service workers so they never intercept Capacitor bridge injection.
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof navigator.serviceWorker?.getRegistrations === 'function') {
    void navigator.serviceWorker.getRegistrations()
      .then(registrations => Promise.all(registrations.map(registration => registration.unregister())))
      .catch(() => undefined);
  }

  document.addEventListener('error', event => {
    if (!isCapacitorNativePlatform()) return;
    const target = event.target;
    if (target instanceof HTMLImageElement && isLocalCoverAssetUrl(target.getAttribute('src'))) {
      void hydrateCapacitorCoverImage(target);
    }
  }, true);

  document.querySelectorAll<HTMLImageElement>('img').forEach(image => {
    if (isLocalCoverAssetUrl(image.getAttribute('src'))) {
      void hydrateCapacitorCoverImage(image);
    }
  });
};

// Re-assigns the src of every rendered local cover that has not decoded, so the browser requests it again.
const retryBrokenLocalCoverImages = (): void => {
  if (isCapacitorNativePlatform()) {
    document.querySelectorAll<HTMLImageElement>('img').forEach(image => {
      if (isLocalCoverAssetUrl(image.getAttribute('src'))) {
        void hydrateCapacitorCoverImage(image);
      }
    });
    return;
  }
  document.querySelectorAll<HTMLImageElement>('img').forEach(image => {
    const source = image.getAttribute('src');
    if (!isLocalCoverAssetUrl(source) || image.naturalWidth > 0) return;
    image.removeAttribute('src');
    queueMicrotask(() => {
      if (image.isConnected) image.src = source;
    });
  });
};

export const initializeLocalCoverRuntime = (): void => {
  if (isCapacitorNativePlatform()) {
    installCapacitorLocalCoverFallback();
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof navigator.serviceWorker?.getRegistrations === 'function') {
      void navigator.serviceWorker.getRegistrations()
        .then(registrations => Promise.all(registrations.map(registration => registration.unregister())))
        .catch(() => undefined);
    }
    document.querySelectorAll<HTMLImageElement>('img').forEach(image => {
      if (isLocalCoverAssetUrl(image.getAttribute('src'))) {
        void hydrateCapacitorCoverImage(image);
      }
    });
    void migrateLegacyLocalCoverAssetsInBackground().then(retryBrokenLocalCoverImages);
    return;
  }

  if (isLocalCoverWebRuntimeSupported() && 'serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', retryBrokenLocalCoverImages);
  }

  // Retry only covers that failed before their legacy payload reached external storage.
  void migrateLegacyLocalCoverAssetsInBackground().then(retryBrokenLocalCoverImages);
};
