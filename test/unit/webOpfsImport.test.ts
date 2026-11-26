import { afterEach, describe, expect, it, vi } from 'vitest';
import { isOpfsCopyImportSupported, isSerializedOpfsHandle, getOpfsRootName } from '../../src/services/webOpfsImport';

describe('web OPFS copy import (iPhone Safari)', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('is used only when there is no folder picker but private storage exists', () => {
        vi.stubGlobal('window', { isSecureContext: true });
        vi.stubGlobal('navigator', { storage: { getDirectory: () => Promise.resolve({}) } });
        expect(isOpfsCopyImportSupported()).toBe(true);
        vi.stubGlobal('window', { isSecureContext: true, showDirectoryPicker: () => undefined });
        expect(isOpfsCopyImportSupported()).toBe(false);
        vi.stubGlobal('window', { isSecureContext: false });
        expect(isOpfsCopyImportSupported()).toBe(false);
    });

    it('recognises the stored form of a private-storage folder and ignores other objects', () => {
        expect(isSerializedOpfsHandle({ __foliaOpfsHandle: true, kind: 'directory', name: 'x' })).toBe(true);
        expect(isSerializedOpfsHandle({ kind: 'directory' })).toBe(false);
        expect(getOpfsRootName({})).toBeNull();
    });
});
