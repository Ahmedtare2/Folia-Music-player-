import type { LocalSong } from '../../types';
import { isBlob } from '../../utils/blobGuards';
import { migrateLocalSongsRenderHints, migrateMatchedLyricsCarrierRenderHints } from '../../utils/lyrics/storageMigration';
import { appDatabase } from '../appDatabase';
import {
  readPersistedLibraryIndex,
  removePersistedLibraryIndexSongs,
  updatePersistedLibraryIndexSongs,
  writeOfflineSavedLyricsForSong,
  writePersistedLibraryIndex,
} from '../persistentDiskCacheService';

// src/services/repositories/localSongRepository.ts
// Stores sanitized local-song records while retaining read-time lyric migrations,
// protecting online-matched lyrics from being overwritten by stale background hydration
// or cover-extraction saves, and mirroring the library metadata index to persistent disk cache.

export const sanitizeLocalSongForStorage = (song: LocalSong): LocalSong => {
  const normalizedSong = migrateMatchedLyricsCarrierRenderHints(song).value ?? song;
  const { fileHandle, embeddedCover: _legacyCover, ...persistedSong } = normalizedSong as LocalSong & {
    embeddedCover?: unknown;
  };
  return persistedSong;
};

const mergePreservedMatchedLyrics = (incoming: LocalSong, existing?: LocalSong): LocalSong => {
  if (!existing || incoming.markedPureMusic) return incoming;
  if (incoming.matchedLyrics !== undefined) return incoming;
  if (!existing.matchedLyrics && !existing.matchedIsPureMusic && !existing.onlineMetadata) {
    return incoming;
  }
  return {
    ...incoming,
    matchedLyrics: existing.matchedLyrics,
    matchedLyricsSongId: incoming.matchedLyricsSongId ?? existing.matchedLyricsSongId,
    matchedLyricsSource: incoming.matchedLyricsSource ?? existing.matchedLyricsSource,
    matchedLyricsProviderPlatform: incoming.matchedLyricsProviderPlatform ?? existing.matchedLyricsProviderPlatform,
    matchedIsPureMusic: incoming.matchedIsPureMusic ?? existing.matchedIsPureMusic,
    matchedLyricsFetchedAt: incoming.matchedLyricsFetchedAt ?? existing.matchedLyricsFetchedAt,
    matchedLyricsQuerySignature: incoming.matchedLyricsQuerySignature ?? existing.matchedLyricsQuerySignature,
    onlineMetadata: incoming.onlineMetadata ?? existing.onlineMetadata,
    useOnlineCover: incoming.useOnlineCover ?? existing.useOnlineCover,
    lyricsSource: incoming.lyricsSource ?? existing.lyricsSource,
    hasManualLyricSelection: incoming.hasManualLyricSelection || existing.hasManualLyricSelection,
  };
};

const normalizeLocalSongFromStorage = (song: LocalSong): { value: LocalSong; changed: boolean } => {
  const legacySong = song as LocalSong & { embeddedCover?: unknown };
  if (legacySong.embeddedCover === undefined) return { value: song, changed: false };
  const { embeddedCover, ...normalizedSong } = legacySong;
  // A valid legacy Blob remains in IndexedDB until the background migrator commits external storage.
  return { value: normalizedSong, changed: !isBlob(embeddedCover) };
};

export const putLocalSong = async (song: LocalSong): Promise<void> => {
  const existing = await appDatabase.local_music.get(song.id).catch(() => undefined);
  const merged = mergePreservedMatchedLyrics(song, existing);
  if (merged.matchedLyrics && !song.matchedLyrics) {
    song.matchedLyrics = merged.matchedLyrics;
    song.matchedLyricsSongId = merged.matchedLyricsSongId;
    song.matchedLyricsSource = merged.matchedLyricsSource;
    song.matchedLyricsProviderPlatform = merged.matchedLyricsProviderPlatform;
    song.matchedIsPureMusic = merged.matchedIsPureMusic;
  }
  const sanitized = sanitizeLocalSongForStorage(merged);
  await appDatabase.local_music.put(sanitized);
  if (sanitized.matchedLyrics) {
    void writeOfflineSavedLyricsForSong(sanitized.id, sanitized.fileSignature, sanitized.matchedLyrics);
  }
  void updatePersistedLibraryIndexSongs([sanitized]);
};

export const putLocalSongs = async (songs: LocalSong[]): Promise<void> => {
  if (songs.length > 0) {
    const ids = songs.map(s => s.id);
    const existingList = await appDatabase.local_music.bulkGet(ids).catch(() => []);
    const existingById = new Map<string, LocalSong>();
    for (const item of existingList) {
      if (item) existingById.set(item.id, item);
    }
    const sanitized = songs.map((song) => {
      const merged = mergePreservedMatchedLyrics(song, existingById.get(song.id));
      if (merged.matchedLyrics && !song.matchedLyrics) {
        song.matchedLyrics = merged.matchedLyrics;
        song.matchedLyricsSongId = merged.matchedLyricsSongId;
        song.matchedLyricsSource = merged.matchedLyricsSource;
        song.matchedLyricsProviderPlatform = merged.matchedLyricsProviderPlatform;
        song.matchedIsPureMusic = merged.matchedIsPureMusic;
      }
      return sanitizeLocalSongForStorage(merged);
    });
    await appDatabase.local_music.bulkPut(sanitized);
    for (const s of sanitized) {
      if (s.matchedLyrics) {
        void writeOfflineSavedLyricsForSong(s.id, s.fileSignature, s.matchedLyrics);
      }
    }
    void updatePersistedLibraryIndexSongs(sanitized);
  }
};

// Applies the read-time cover sanitization and lyric render-hint migration, writing changed records back in the background.
const migrateStoredLocalSongs = (storedSongs: LocalSong[]): LocalSong[] => {
  const normalized = storedSongs.map(normalizeLocalSongFromStorage);
  const sanitizedSongs = normalized.filter(item => item.changed).map(item => item.value);
  if (sanitizedSongs.length > 0) {
    void putLocalSongs(sanitizedSongs).catch(error => {
      console.warn('[DB] Failed to write back sanitized local song covers', error);
    });
  }

  const migration = migrateLocalSongsRenderHints(normalized.map(item => item.value));
  if (migration.changedSongs.length > 0) {
    void putLocalSongs(migration.changedSongs).catch(error => {
      console.warn('[DB] Failed to write back migrated local song lyrics', error);
    });
  }
  return migration.value;
};

export const readLocalSongs = async (): Promise<LocalSong[]> => {
  const stored = await appDatabase.local_music.toArray();
  if (stored.length > 0) {
    const migrated = migrateStoredLocalSongs(stored);
    void writePersistedLibraryIndex({ songs: migrated.map(sanitizeLocalSongForStorage) });
    return migrated;
  }

  const diskIndex = await readPersistedLibraryIndex();
  if (diskIndex && diskIndex.songs.length > 0) {
    const restored = migrateStoredLocalSongs(diskIndex.songs);
    void appDatabase.local_music.bulkPut(restored.map(sanitizeLocalSongForStorage)).catch(() => undefined);
    return restored;
  }

  return [];
};

// 按主键读一条记录，读时迁移与 readLocalSongs 一致；播放和匹配路径只关心一首歌时用它，不读整张表。
export const readLocalSong = async (id: string): Promise<LocalSong | undefined> => {
  const storedSong = await appDatabase.local_music.get(id);
  if (storedSong) {
    return migrateStoredLocalSongs([storedSong])[0];
  }
  const diskIndex = await readPersistedLibraryIndex();
  const fromDisk = diskIndex?.songs.find(s => s.id === id);
  return fromDisk ? migrateStoredLocalSongs([fromDisk])[0] : undefined;
};

export const removeLocalSong = async (id: string): Promise<void> => {
  await appDatabase.local_music.delete(id);
  void removePersistedLibraryIndexSongs([id]);
};

export const removeLocalSongs = async (ids: string[]): Promise<void> => {
  if (ids.length > 0) {
    await appDatabase.local_music.bulkDelete(ids);
    void removePersistedLibraryIndexSongs(ids);
  }
};
