import { isAndroidNativeApp } from '../utils/platform';
import { hasFoliaAndroidBridge } from './android/foliaAndroidBridge';

// src/services/localLibraryAvailability.ts
// Centralizes the secure-context requirement for browser local-library access and enables Android SAF storage.

export interface LocalLibraryAvailability {
  supported: boolean;
  reason: 'insecure-http' | 'file-system-api-unavailable' | null;
}

export const getLocalLibraryAvailability = (): LocalLibraryAvailability => {
  if (typeof window === 'undefined') return { supported: false, reason: 'file-system-api-unavailable' };
  if (window.electron) return { supported: true, reason: null };
  if (isAndroidNativeApp() || hasFoliaAndroidBridge()) {
    return { supported: true, reason: null };
  }
  const currentLocation = window.location;
  if (!currentLocation) return { supported: false, reason: 'file-system-api-unavailable' };
  const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(currentLocation.hostname);
  if (!(currentLocation.protocol === 'https:' || isLocalhost) || !window.isSecureContext) {
    return { supported: false, reason: 'insecure-http' };
  }
  // No folder picker (iPhone Safari): the import button picks files and copies them into the app's private storage.
  if (!('showDirectoryPicker' in window)) return { supported: true, reason: null };
  if (!('showDirectoryPicker' in window) || typeof navigator.storage?.getDirectory !== 'function') {
    return { supported: false, reason: 'file-system-api-unavailable' };
  }
  return { supported: true, reason: null };
};
