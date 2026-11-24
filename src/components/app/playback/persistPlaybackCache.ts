import { removeFromCache, saveToCache } from '../../../services/db';
import type { SongResult, UnifiedSong } from '../../../types';
import { isStagePlaybackSong, normalizePlaybackSongSource } from '../../../utils/appPlaybackGuards';

// src/components/app/playback/persistPlaybackCache.ts

const sanitizePlaybackSong = (song: SongResult): SongResult => {
    const unified = normalizePlaybackSongSource(song) as UnifiedSong & { localData?: { id?: string } };
    const localSongId = unified.localRef?.songId || unified.localData?.id;
    if (!localSongId) return unified;
    const { localData: _legacyLocalData, ...snapshot } = unified;
    return { ...snapshot, isLocal: true, localRef: { songId: localSongId } } as UnifiedSong;
};

// Saving the whole queue copies every song (a library of hundreds) on the UI thread, and used to run on every
// track change. The song is saved at once; the queue save waits for a quiet moment, keeps only the newest queue,
// and is flushed when the app goes to the background so a kill right after a skip loses nothing.
const QUEUE_SAVE_DELAY_MS = 2500;
let pendingQueueSave: { queue: SongResult[]; timer: ReturnType<typeof setTimeout> | null } | null = null;
let flushListenersInstalled = false;

const flushQueueSave = async () => {
    const pending = pendingQueueSave;
    if (!pending) return;
    pendingQueueSave = null;
    if (pending.timer) clearTimeout(pending.timer);
    const sanitizedQueue = pending.queue
        .filter(queuedSong => !isStagePlaybackSong(queuedSong))
        .map(sanitizePlaybackSong);
    await saveToCache('last_queue', sanitizedQueue);
};

const installFlushListeners = () => {
    if (flushListenersInstalled || typeof document === 'undefined') return;
    flushListenersInstalled = true;
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') void flushQueueSave();
    });
    window.addEventListener('pagehide', () => { void flushQueueSave(); });
};

const cancelPendingQueueSave = () => {
    if (pendingQueueSave?.timer) clearTimeout(pendingQueueSave.timer);
    pendingQueueSave = null;
};

// Persists local playback as a lightweight songId reference while excluding Stage snapshots.
export const persistPlaybackCache = async (song: SongResult | null, queue: SongResult[]) => {
    if (!song || isStagePlaybackSong(song)) {
        return;
    }

    // This save is the newest word on the queue: a deferred one still waiting would only write older data later.
    cancelPendingQueueSave();
    const sanitizedSong = sanitizePlaybackSong(song);
    const sanitizedQueue = queue
        .filter(queuedSong => !isStagePlaybackSong(queuedSong))
        .map(sanitizePlaybackSong);
    await Promise.all([
        saveToCache('last_song', sanitizedSong),
        saveToCache('last_queue', sanitizedQueue),
    ]);
};

// The save made when a track starts: the song now, the queue later (see above).
export const persistPlaybackCacheSoon = async (song: SongResult | null, queue: SongResult[]) => {
    if (!song || isStagePlaybackSong(song)) {
        return;
    }

    installFlushListeners();
    if (pendingQueueSave?.timer) clearTimeout(pendingQueueSave.timer);
    pendingQueueSave = {
        queue,
        timer: setTimeout(() => { void flushQueueSave(); }, QUEUE_SAVE_DELAY_MS),
    };
    await saveToCache('last_song', sanitizePlaybackSong(song));
};

// Forgets the saved song and queue, so the next launch restores nothing: the player was emptied.
export const forgetPlaybackCache = async () => {
    if (pendingQueueSave?.timer) clearTimeout(pendingQueueSave.timer);
    pendingQueueSave = null;
    await Promise.all([
        removeFromCache('last_song'),
        removeFromCache('last_queue'),
    ]);
};
