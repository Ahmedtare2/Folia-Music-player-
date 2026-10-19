// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeLocalCoverRuntime } from '../../../src/services/localCoverRuntime';
import { isLocalCoverWebRuntimeSupported, readLocalCoverBinaryBlob } from '../../../src/services/localCoverBinaryStore';
import { migrateLegacyLocalCoverAssetsInBackground } from '../../../src/services/localCoverAssetService';

// test/unit/services/localCoverRuntime.test.ts
// Verifies local-cover startup never waits on a service worker and re-requests covers once one takes control,
// and resolves covers directly from OPFS in Capacitor Android where the web PWA worker is disabled.

vi.mock('../../../src/services/localCoverBinaryStore', async importOriginal => ({
  ...await importOriginal<typeof import('../../../src/services/localCoverBinaryStore')>(),
  isLocalCoverWebRuntimeSupported: vi.fn(() => true),
  readLocalCoverBinaryBlob: vi.fn(async () => null),
}));

vi.mock('../../../src/services/localCoverAssetService', () => ({
  migrateLegacyLocalCoverAssetsInBackground: vi.fn(() => new Promise<void>(() => undefined)),
}));

const COVER_URL = `/__folia_cover/sha256%3A${'a'.repeat(64)}?size=512`;

const addImage = (src: string, naturalWidth = 0): HTMLImageElement => {
  const image = document.createElement('img');
  image.setAttribute('src', src);
  // jsdom never decodes images; a positive width stands in for a cover that loaded.
  Object.defineProperty(image, 'naturalWidth', { configurable: true, value: naturalWidth });
  document.body.appendChild(image);
  return image;
};

const flushMicrotasks = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('local cover runtime', () => {
  let serviceWorker: EventTarget & {
    register: ReturnType<typeof vi.fn>;
    getRegistrations: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    delete (globalThis as { Capacitor?: unknown }).Capacitor;
    serviceWorker = Object.assign(new EventTarget(), {
      register: vi.fn(),
      getRegistrations: vi.fn(async () => []),
    });
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: serviceWorker });
    vi.mocked(isLocalCoverWebRuntimeSupported).mockReturnValue(true);
    vi.mocked(readLocalCoverBinaryBlob).mockResolvedValue(null);
  });

  afterEach(() => {
    delete (globalThis as { Capacitor?: unknown }).Capacitor;
    document.body.innerHTML = '';
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('registers no worker of its own and returns without waiting for one', () => {
    expect(initializeLocalCoverRuntime()).toBeUndefined();
    expect(serviceWorker.register).not.toHaveBeenCalled();
  });

  it('re-requests covers that failed once a worker takes control of the page', async () => {
    const broken = addImage(COVER_URL);
    const loaded = addImage(COVER_URL, 512);
    const remote = addImage('https://example.com/cover.jpg');
    initializeLocalCoverRuntime();

    serviceWorker.dispatchEvent(new Event('controllerchange'));
    expect(broken.hasAttribute('src')).toBe(false);
    await flushMicrotasks();

    expect(broken.getAttribute('src')).toBe(COVER_URL);
    expect(loaded.getAttribute('src')).toBe(COVER_URL);
    expect(remote.getAttribute('src')).toBe('https://example.com/cover.jpg');
  });

  it('does not watch the worker where covers use the Electron protocol', () => {
    vi.mocked(isLocalCoverWebRuntimeSupported).mockReturnValue(false);
    const broken = addImage(COVER_URL);
    initializeLocalCoverRuntime();

    serviceWorker.dispatchEvent(new Event('controllerchange'));
    expect(broken.getAttribute('src')).toBe(COVER_URL);
  });

  it('re-requests covers that failed before the legacy migration finished', async () => {
    vi.mocked(migrateLegacyLocalCoverAssetsInBackground).mockResolvedValueOnce(undefined);
    const broken = addImage(COVER_URL);
    const previousSources: Array<string | null> = [];
    new MutationObserver(records => records.forEach(record => previousSources.push(record.oldValue)))
      .observe(broken, { attributeFilter: ['src'], attributeOldValue: true });

    initializeLocalCoverRuntime();
    await flushMicrotasks();

    // Removed, then set back: the browser only re-requests an image whose src actually changes.
    expect(previousSources).toEqual([COVER_URL, null]);
    expect(broken.getAttribute('src')).toBe(COVER_URL);
  });

  it('unregisters stale service workers and hydrates cover images from OPFS in Capacitor Android', async () => {
    const unregister = vi.fn(async () => true);
    serviceWorker.getRegistrations.mockResolvedValueOnce([{ unregister }]);
    (globalThis as { Capacitor?: unknown }).Capacitor = {
      getPlatform: () => 'android',
      isNativePlatform: () => true,
    };
    const fakeBlob = new Blob(['cover-bytes'], { type: 'image/webp' });
    vi.mocked(readLocalCoverBinaryBlob).mockResolvedValueOnce(fakeBlob);
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:https://localhost/folia-cover-1');

    const broken = addImage(COVER_URL);
    initializeLocalCoverRuntime();
    await flushMicrotasks();

    expect(unregister).toHaveBeenCalledTimes(1);
    expect(readLocalCoverBinaryBlob).toHaveBeenCalledWith(`sha256:${'a'.repeat(64)}`);
    expect(broken.getAttribute('src')).toBe('blob:https://localhost/folia-cover-1');

    createObjectUrlSpy.mockRestore();
  });
});
