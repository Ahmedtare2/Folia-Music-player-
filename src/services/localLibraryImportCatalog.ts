import type { LocalSong } from '../types';
import type { LocalLibraryAssignment } from '../types/localLibrary';
import {
  getAlbumImportContextKey,
  getImportedAlbumName,
  getImportedArtistNames,
  normalizeLocalLibraryName,
} from '../utils/localLibraryNames';
import { appDatabase } from './appDatabase';
import { resolveEntityNames } from './localLibraryCatalogInternals';
import { sanitizeLocalSongForStorage } from './repositories/localSongRepository';
import { isBlob } from '../utils/blobGuards';
import {
  deleteUnreferencedLocalCoverAssets,
  prepareLocalSongsCoverAssets,
} from './localCoverAssetService';

// src/services/localLibraryImportCatalog.ts
// Handles import/rescan assignment and the idempotent legacy bootstrap transaction.

let initializedDatabaseRef: unknown = null;
let initializationInFlight: Promise<void> | null = null;

export const resetLocalLibraryInitializationCache = (): void => {
  initializedDatabaseRef = null;
  initializationInFlight = null;
};

const hasSameImportedEntityNames = (left: LocalSong, right: LocalSong): boolean => {
  const leftAlbum = normalizeLocalLibraryName(getImportedAlbumName(left) || '');
  const rightAlbum = normalizeLocalLibraryName(getImportedAlbumName(right) || '');
  if (leftAlbum !== rightAlbum) return false;
  const leftArtists = getImportedArtistNames(left).map(normalizeLocalLibraryName);
  const rightArtists = getImportedArtistNames(right).map(normalizeLocalLibraryName);
  if (leftArtists.length !== rightArtists.length) return false;
  return leftArtists.every((artist, idx) => artist === rightArtists[idx]);
};

const assignImportedSongsInTransaction = async (
  songs: LocalSong[],
  preserveNonImportAssignments: boolean,
): Promise<string[]> => {
  if (songs.length === 0) return [];

  // Fast path for single-song or small-batch metadata/cover updates where entity assignments
  // already exist and imported artist/album names have not changed: avoids reading all 3 tables.
  if (songs.length <= 5 && preserveNonImportAssignments) {
    const songIds = songs.map(song => song.id);
    const [existingSongs, existingAssignments] = await Promise.all([
      appDatabase.local_music.bulkGet(songIds),
      appDatabase.local_library_assignments.bulkGet(songIds),
    ]);
    const canFastUpdate = songs.every((song, idx) => {
      const existingSong = existingSongs[idx];
      const existingAssignment = existingAssignments[idx];
      return Boolean(
        existingSong
        && existingAssignment
        && hasSameImportedEntityNames(existingSong, song)
      );
    });
    if (canFastUpdate) {
      const replacedCoverAssetIds = songs.flatMap((song, idx) => {
        const previousAssetId = existingSongs[idx]?.localCoverAssetId;
        return previousAssetId && previousAssetId !== song.localCoverAssetId ? [previousAssetId] : [];
      });
      const songsForStorage = songs.map((song, idx) => {
        const persisted = sanitizeLocalSongForStorage(song);
        const existing = existingSongs[idx] as (LocalSong & { embeddedCover?: unknown }) | undefined;
        return isBlob(existing?.embeddedCover) && (!song.localCoverAssetId || song.localCoverNeedsAssetMigration)
          ? { ...persisted, embeddedCover: existing.embeddedCover }
          : persisted;
      });
      await appDatabase.local_music.bulkPut(songsForStorage);
      return replacedCoverAssetIds;
    }
  }

  const [entities, assignments, allSongs] = await Promise.all([
    appDatabase.local_library_entities.toArray(),
    appDatabase.local_library_assignments.toArray(),
    appDatabase.local_music.toArray(),
  ]);
  const existingSongById = new Map(allSongs.map(song => [song.id, song]));
  const replacedCoverAssetIds = songs.flatMap(song => {
    const previousAssetId = existingSongById.get(song.id)?.localCoverAssetId;
    return previousAssetId && previousAssetId !== song.localCoverAssetId ? [previousAssetId] : [];
  });
  const assignmentBySongId = new Map(assignments.map(assignment => [assignment.songId, assignment]));
  const songById = new Map([...allSongs, ...songs].map(song => [song.id, song]));
  const albumContext = new Map<string, string>();

  assignments.forEach(assignment => {
    if (!assignment.albumEntityId) return;
    const song = songById.get(assignment.songId);
    const albumName = song && getImportedAlbumName(song);
    if (song && albumName) albumContext.set(getAlbumImportContextKey(song, albumName), assignment.albumEntityId);
  });

  const nextAssignments: LocalLibraryAssignment[] = [];
  songs.forEach(song => {
    const current = assignmentBySongId.get(song.id);
    const preserveArtist = Boolean(preserveNonImportAssignments && current && current.artistOrigin !== 'import');
    const preserveAlbum = Boolean(preserveNonImportAssignments && current && current.albumOrigin !== 'import');
    const albumName = getImportedAlbumName(song);
    let albumId = preserveAlbum ? current?.albumEntityId : undefined;
    if (!preserveAlbum && albumName) {
      const contextKey = getAlbumImportContextKey(song, albumName);
      const normalizedArtistNames = new Set(getImportedArtistNames(song).map(normalizeLocalLibraryName));
      const artistOverlapAlbumIds = assignments.flatMap(assignment => {
        if (!assignment.albumEntityId) return [];
        const overlaps = assignment.artistEntityIds.some(entityId => {
          const entity = entities.find(item => item.id === entityId);
          return entity?.normalizedAliases.some(alias => normalizedArtistNames.has(alias));
        });
        return overlaps ? [assignment.albumEntityId] : [];
      });
      const uniqueOverlapAlbumIds = Array.from(new Set(artistOverlapAlbumIds));
      const preferredId = albumContext.get(contextKey)
        || current?.albumEntityId
        || (uniqueOverlapAlbumIds.length === 1 ? uniqueOverlapAlbumIds[0] : undefined);
      albumId = resolveEntityNames(entities, 'album', [albumName], preferredId ? [preferredId] : [])[0];
      if (albumId) albumContext.set(contextKey, albumId);
    }
    const albumArtistContext = albumId
      ? [...assignments, ...nextAssignments]
          .filter(assignment => assignment.albumEntityId === albumId)
          .flatMap(assignment => assignment.artistEntityIds)
      : [];
    const artistIds = preserveArtist
      ? current?.artistEntityIds || []
      : resolveEntityNames(
          entities,
          'artist',
          getImportedArtistNames(song),
          current?.artistEntityIds.length ? current.artistEntityIds : albumArtistContext,
        );
    nextAssignments.push({
      songId: song.id,
      artistEntityIds: artistIds,
      artistOrigin: preserveArtist ? current?.artistOrigin || 'import' : 'import',
      albumEntityId: albumId,
      albumOrigin: preserveAlbum ? current?.albumOrigin || 'import' : 'import',
      updatedAt: Date.now(),
    });
  });

  const songsForStorage = songs.map(song => {
    const persisted = sanitizeLocalSongForStorage(song);
    const existing = existingSongById.get(song.id) as (LocalSong & { embeddedCover?: unknown }) | undefined;
    return isBlob(existing?.embeddedCover) && (!song.localCoverAssetId || song.localCoverNeedsAssetMigration)
      ? { ...persisted, embeddedCover: existing.embeddedCover }
      : persisted;
  });

  await Promise.all([
    appDatabase.local_music.bulkPut(songsForStorage),
    appDatabase.local_library_entities.bulkPut(entities),
    appDatabase.local_library_assignments.bulkPut(nextAssignments),
  ]);
  return replacedCoverAssetIds;
};

export const assignImportedSongs = async (
  songs: LocalSong[],
  options: { preserveNonImportAssignments?: boolean } = {},
): Promise<void> => {
  const songsWithValidatedCovers = await prepareLocalSongsCoverAssets(songs);
  let replacedCoverAssetIds: string[];
  try {
    replacedCoverAssetIds = await appDatabase.transaction(
      'rw',
      [
        appDatabase.local_music,
        appDatabase.local_library_entities,
        appDatabase.local_library_assignments,
        appDatabase.local_cover_assets,
      ],
      () => assignImportedSongsInTransaction(songsWithValidatedCovers, options.preserveNonImportAssignments ?? true),
    );
  } catch (error) {
    await deleteUnreferencedLocalCoverAssets(songsWithValidatedCovers.flatMap(song => (
      song.localCoverAssetId ? [song.localCoverAssetId] : []
    )));
    throw error;
  }
  await deleteUnreferencedLocalCoverAssets(replacedCoverAssetIds);
};

// Repairs only genuinely missing assignments; memoized per database instance after initial check
// unless songs exist without assignments.
export const ensureLocalLibraryInitialized = async (): Promise<void> => {
  if (initializedDatabaseRef === appDatabase) {
    const [songCount, assignmentCount] = await Promise.all([
      appDatabase.local_music.count(),
      appDatabase.local_library_assignments.count(),
    ]);
    if (songCount <= assignmentCount) {
      return;
    }
  }
  if (initializationInFlight) {
    return await initializationInFlight;
  }
  const run = (async () => {
    const [songs, assignments] = await Promise.all([
      appDatabase.local_music.toArray(),
      appDatabase.local_library_assignments.toArray(),
    ]);
    const assignedIds = new Set(assignments.map(assignment => assignment.songId));
    const missing = songs.filter(song => !assignedIds.has(song.id));
    if (missing.length > 0) {
      await assignImportedSongs(missing, { preserveNonImportAssignments: false });
    }
    initializedDatabaseRef = appDatabase;
  })();
  initializationInFlight = run;
  try {
    await run;
  } finally {
    if (initializationInFlight === run) {
      initializationInFlight = null;
    }
  }
};
