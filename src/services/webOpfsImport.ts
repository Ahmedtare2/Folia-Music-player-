// src/services/webOpfsImport.ts
// Browsers without a folder picker (iPhone and iPad Safari) cannot hand the app a live folder. There the user picks audio
// files in the system file picker and the app copies them into its own private storage (the origin private file system),
// then treats that private folder like any imported folder. The copies live inside the app and survive a reload.

const IMPORT_ROOT = 'folia-imports';
const AUDIO_ACCEPT = 'audio/*,.mp3,.flac,.m4a,.wav,.ogg,.opus,.aac,.aif,.aiff,.caf,.lrc,.ttml,.srt,.jpg,.jpeg,.png';

const opfsPaths = new WeakMap<object, string>();

export const isOpfsCopyImportSupported = (): boolean => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    if (!window.isSecureContext) return false;
    if ('showDirectoryPicker' in window) return false;
    return typeof navigator.storage?.getDirectory === 'function';
};

export interface SerializedOpfsDirectoryHandle { __foliaOpfsHandle: true; kind: 'directory'; name: string }

export const isSerializedOpfsHandle = (value: unknown): value is SerializedOpfsDirectoryHandle =>
    !!value && typeof value === 'object' && (value as { __foliaOpfsHandle?: boolean }).__foliaOpfsHandle === true;

export const getOpfsRootName = (handle: unknown): string | null =>
    handle && typeof handle === 'object' ? opfsPaths.get(handle) ?? null : null;

export const openOpfsImportRoot = async (name: string, create = false): Promise<FileSystemDirectoryHandle> => {
    const root = await navigator.storage.getDirectory();
    const imports = await root.getDirectoryHandle(IMPORT_ROOT, { create: true });
    const dir = await imports.getDirectoryHandle(name, { create });
    opfsPaths.set(dir, name);
    return dir;
};

export const removeOpfsImportRoot = async (name: string): Promise<void> => {
    try {
        const root = await navigator.storage.getDirectory();
        const imports = await root.getDirectoryHandle(IMPORT_ROOT);
        await imports.removeEntry(name, { recursive: true });
    } catch { /* already gone */ }
};

const abortError = () => {
    const error = new Error('The user aborted a request.');
    error.name = 'AbortError';
    return error;
};

/** Must be called straight from a tap: the file picker only opens from a user gesture. */
const pickFiles = (): Promise<File[]> => new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = AUDIO_ACCEPT;
    input.style.display = 'none';
    document.body.appendChild(input);
    let settled = false;
    const done = (files: File[] | null) => {
        if (settled) return;
        settled = true;
        input.remove();
        if (files && files.length) resolve(files); else reject(abortError());
    };
    input.addEventListener('change', () => done(Array.from(input.files ?? [])));
    input.addEventListener('cancel', () => done(null));
    input.click();
});

const safeName = (name: string) => name.replace(/[\\/:*?"<>|]/g, '_');

/** Lets the user pick audio files, copies them into a fresh private folder and returns that folder's handle. */
export const pickAndCopyToOpfs = async (): Promise<FileSystemDirectoryHandle> => {
    try {
        return await pickAndCopyToOpfsInner();
    } catch (error) {
        if ((error as Error)?.name !== 'AbortError') {
            // On a phone there is no console: say what failed and which browser features exist.
            const feature = (v: unknown) => (v ? 'yes' : 'no');
            try {
                window.alert(`Import failed: ${(error as Error)?.message ?? String(error)}\n(build web-import-v19; private storage: ${feature(typeof navigator.storage?.getDirectory === 'function')}; secure: ${feature(window.isSecureContext)})`);
            } catch { /* no alert */ }
        }
        throw error;
    }
};

const pickAndCopyToOpfsInner = async (): Promise<FileSystemDirectoryHandle> => {
    const files = await pickFiles();
    if (typeof navigator.storage?.getDirectory !== 'function') {
        throw new Error('This browser has no private app storage (iOS 15.2 or newer is needed, and not in a Private tab).');
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const root = await navigator.storage.getDirectory();
    const imports = await root.getDirectoryHandle(IMPORT_ROOT, { create: true });
    let name = `iPhone Music ${stamp}`;
    for (let n = 2; ; n += 1) {
        try { await imports.getDirectoryHandle(name); name = `iPhone Music ${stamp} (${n})`; } catch { break; }
    }
    const dir = await imports.getDirectoryHandle(name, { create: true });
    for (const file of files) {
        const handle = await dir.getFileHandle(safeName(file.name), { create: true });
        const writable = await (handle as FileSystemFileHandle & { createWritable?: () => Promise<FileSystemWritableFileStream> }).createWritable?.();
        if (writable) {
            await writable.write(file);
            await writable.close();
        } else {
            // Safari: no createWritable on the main thread; use a worker-free sync handle through a dedicated writer.
            const worker = new Worker(URL.createObjectURL(new Blob([
                'self.onmessage=async e=>{try{const h=await e.data.handle.createSyncAccessHandle();const b=new Uint8Array(await e.data.file.arrayBuffer());h.truncate(0);h.write(b,{at:0});h.flush();h.close();self.postMessage(1)}catch(err){self.postMessage(String(err))}}',
            ], { type: 'text/javascript' })));
            await new Promise<void>((ok, fail) => {
                worker.onmessage = ev => { worker.terminate(); if (ev.data === 1) ok(); else fail(new Error(String(ev.data))); };
                worker.postMessage({ handle, file });
            });
        }
    }
    opfsPaths.set(dir, name);
    return dir;
};
