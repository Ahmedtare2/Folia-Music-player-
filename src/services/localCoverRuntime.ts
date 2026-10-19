import { isLocalCoverWebRuntimeSupported, isValidLocalCoverAssetId, readLocalCoverBinaryBlob } from './localCoverBinaryStore';
import { migrateLegacyLocalCoverAssetsInBackground } from './localCoverAssetService';
import { isLocalCoverAssetUrl } from './localCoverAssetUrl';
import { isCapacitorNativePlatform } from '../utils/platform';

// src/services/localCoverRuntime.ts
// Re-requests local covers that failed before the Web resource route served them, then starts resumable legacy migration.
// In Capacitor native shells where the web PWA service worker is disabled to protect native plugin injection, resolves
// /__folia_cover/ images directly from OPFS into cached object URLs.

const WEB_COVER_PATH_PREFIX = '/__folia_cover/';
const capacitorCoverBlobUrls = new Map<string, string>();
let capacitorCoverFallbackInstalled = false;

const extractAssetIdFromCoverUrl = (url: string | null | undefined): string | null => {
  if (!url || !url.startsWith(WEB_COVER_PATH_PREFIX)) return null;
  const pathPart = url.slice(WEB_COVER_PATH_PREFIX.length).split('?')[0] || '';
  try {
    const decoded = decodeURIComponent(pathPart);
    return isValidLocalCoverAssetId(decoded) ? decoded : null;
  } catch {
    return null;
  }
};

const hydrateCapacitorCoverImage = async (image: HTMLImageElement): Promise<void> => {
  const source = image.getAttribute('src');
  const assetId = extractAssetIdFromCoverUrl(source);
  if (!assetId) return;

  const cachedUrl = capacitorCoverBlobUrls.get(assetId);
  if (cachedUrl) {
    if (image.getAttribute('src') !== cachedUrl) {
      image.setAttribute('data-folia-cover-src', source!);
      image.src = cachedUrl;
    }
    return;
  }

  const blob = await readLocalCoverBinaryBlob(assetId);
  if (!blob || typeof URL.createObjectURL !== 'function') return;
  let objectUrl = capacitorCoverBlobUrls.get(assetId);
  if (!objectUrl) {
    objectUrl = URL.createObjectURL(blob);
    capacitorCoverBlobUrls.set(assetId, objectUrl);
  }
  if (image.isConnected && image.getAttribute('src') === source) {
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
    void migrateLegacyLocalCoverAssetsInBackground().then(retryBrokenLocalCoverImages);
    return;
  }

  if (isLocalCoverWebRuntimeSupported() && 'serviceWorker' in navigator) {
    // /__folia_cover/ is answered by the PWA worker (vite.config.ts imports public/folia-cover-sw.js
    // into it), which vite-plugin-pwa registers. Startup does not wait for it: on a first visit it only
    // activates after the whole precache is downloaded. A returning page is already controlled; one
    // that is not (first visit, or a worker from before the route was imported) gets the covers that
    // failed meanwhile requested again when the new worker claims it.
    navigator.serviceWorker.addEventListener('controllerchange', retryBrokenLocalCoverImages);
  }

  // Retry only covers that failed before their legacy payload reached external storage.
  void migrateLegacyLocalCoverAssetsInBackground().then(retryBrokenLocalCoverImages);
};
