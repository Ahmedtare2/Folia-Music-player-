import type { LocalLibraryGroup, LocalPlaylist, LocalSong, SongResult } from '../../types';
import type { LocalLibraryDisplayCatalog } from '../../services/playbackAdapters';
import { getLocalCoverAssetUrl } from '../../services/localCoverAssetUrl';
import { buildLocalHomeGroups } from '../../library/core/home/localHomeModel';

// src/components/mobile/mobileNavigationModel.ts
// Pure state, collection grouping, filtering/sorting, visualizer visibility, and hardware-Back
// navigation model for the Phase 4 mobile-first Android music player shell.

export type MobilePrimaryTab = 'songs' | 'albums' | 'folders' | 'settings';
export type MobileAlbumsSubTab = 'albums' | 'artists';
export type MobileFoldersSubTab = 'folders' | 'playlists';
export type MobileSongSortOrder = 'title' | 'artist' | 'album' | 'recent';
export type MobilePlayerSheetState = 'collapsed' | 'expanded';
export type MobilePlayerDisplayMode = 'cover' | 'lyrics' | 'stage';
export type MobileSubDrawer = 'none' | 'lyrics-tools' | 'queue';

export interface MobileCollectionDetail {
    kind: 'album' | 'artist' | 'folder' | 'playlist';
    id: string;
    title: string;
    subtitle?: string;
    coverUrl?: string;
    songs: LocalSong[];
}

export interface MobileNavigationState {
    activeTab: MobilePrimaryTab;
    albumsSubTab: MobileAlbumsSubTab;
    foldersSubTab: MobileFoldersSubTab;
    collectionDetail: MobileCollectionDetail | null;
    playerSheet: MobilePlayerSheetState;
    playerDisplayMode: MobilePlayerDisplayMode;
    subDrawer: MobileSubDrawer;
}

export interface ExternalModalState {
    isLyricMatchOpen?: boolean;
    isSettingsModalOpen?: boolean;
    isCommandPaletteOpen?: boolean;
    closeLyricMatch?: () => void;
    closeSettingsModal?: () => void;
    closeCommandPalette?: () => void;
}

export const INITIAL_MOBILE_NAVIGATION_STATE: MobileNavigationState = {
    activeTab: 'songs',
    albumsSubTab: 'albums',
    foldersSubTab: 'folders',
    collectionDetail: null,
    playerSheet: 'collapsed',
    playerDisplayMode: 'cover',
    subDrawer: 'none',
};

/**
 * Pure step function for Android hardware Back and gesture Back navigation.
 * Returns `{ handled: true, nextState }` when the back action was consumed inside the app,
 * or `{ handled: false, nextState: state }` when already at the root screen so the native
 * host can move the task to the background (`moveTaskToBack(true)`).
 */
export const stepMobileBackNavigation = (
    state: MobileNavigationState,
    modals: ExternalModalState = {},
): { handled: boolean; nextState: MobileNavigationState; sideEffect?: () => void } => {
    if (modals.isCommandPaletteOpen && modals.closeCommandPalette) {
        return {
            handled: true,
            nextState: state,
            sideEffect: modals.closeCommandPalette,
        };
    }

    if (modals.isLyricMatchOpen && modals.closeLyricMatch) {
        return {
            handled: true,
            nextState: state,
            sideEffect: modals.closeLyricMatch,
        };
    }

    if (modals.isSettingsModalOpen && modals.closeSettingsModal) {
        return {
            handled: true,
            nextState: state,
            sideEffect: modals.closeSettingsModal,
        };
    }

    if (state.subDrawer !== 'none') {
        return {
            handled: true,
            nextState: {
                ...state,
                subDrawer: 'none',
            },
        };
    }

    if (state.playerSheet === 'expanded') {
        if (state.playerDisplayMode === 'lyrics' || state.playerDisplayMode === 'stage') {
            return {
                handled: true,
                nextState: {
                    ...state,
                    playerDisplayMode: 'cover',
                },
            };
        }
        return {
            handled: true,
            nextState: {
                ...state,
                playerSheet: 'collapsed',
            },
        };
    }

    if (state.collectionDetail !== null) {
        return {
            handled: true,
            nextState: {
                ...state,
                collectionDetail: null,
            },
        };
    }

    if (state.activeTab !== 'songs') {
        return {
            handled: true,
            nextState: {
                ...state,
                activeTab: 'songs',
            },
        };
    }

    return {
        handled: false,
        nextState: state,
    };
};

/**
 * Determines whether the background `VisualizerRenderer` should actively render when the mobile
 * shell is active. When the user is browsing the library or viewing the static Album-Cover tab,
 * suspending the heavy WebGL/Pixi canvas saves GPU and battery while keeping audio playback live.
 */
export const isMobileVisualizerVisible = (state: Pick<MobileNavigationState, 'playerSheet' | 'playerDisplayMode'>): boolean => (
    state.playerSheet === 'expanded' && (state.playerDisplayMode === 'lyrics' || state.playerDisplayMode === 'stage')
);

export const resolveLocalSongCoverThumb = (song: LocalSong, size = 512): string | undefined => {
    const localUrl = getLocalCoverAssetUrl(song.localCoverAssetId, size) || undefined;
    if (song.useOnlineCover) {
        return song.onlineMetadata?.coverUrl || localUrl;
    }
    return localUrl || song.onlineMetadata?.coverUrl;
};

export const resolveLocalSongArtistText = (song: LocalSong, unknownArtistLabel = 'Unknown Artist'): string => {
    const names = song.titleOrigin === 'import'
        ? song.importedMetadata.artistNames
        : (song.onlineMetadata?.artists?.map(a => a.name) || song.importedMetadata.artistNames);
    const joined = (names || []).filter(Boolean).join(', ').trim();
    return joined || unknownArtistLabel;
};

export const resolveLocalSongAlbumText = (song: LocalSong, unknownAlbumLabel = 'Unknown Album'): string => {
    const album = song.titleOrigin === 'import'
        ? song.importedMetadata.albumName
        : (song.onlineMetadata?.album?.name || song.importedMetadata.albumName);
    return (album || '').trim() || unknownAlbumLabel;
};

export const filterAndSortLocalSongs = (
    songs: readonly LocalSong[],
    query: string,
    sortOrder: MobileSongSortOrder,
): LocalSong[] => {
    const trimmed = query.trim().toLowerCase();
    const filtered = trimmed
        ? songs.filter(song => {
            const title = (song.title || '').toLowerCase();
            const artist = resolveLocalSongArtistText(song, '').toLowerCase();
            const album = resolveLocalSongAlbumText(song, '').toLowerCase();
            const folder = (song.folderName || '').toLowerCase();
            return title.includes(trimmed)
                || artist.includes(trimmed)
                || album.includes(trimmed)
                || folder.includes(trimmed);
        })
        : [...songs];

    return filtered.sort((a, b) => {
        if (sortOrder === 'recent') {
            return (b.addedAt || 0) - (a.addedAt || 0);
        }
        if (sortOrder === 'artist') {
            const cmp = resolveLocalSongArtistText(a).localeCompare(resolveLocalSongArtistText(b));
            return cmp !== 0 ? cmp : (a.title || '').localeCompare(b.title || '');
        }
        if (sortOrder === 'album') {
            const cmp = resolveLocalSongAlbumText(a).localeCompare(resolveLocalSongAlbumText(b));
            return cmp !== 0 ? cmp : (a.trackNumber || 0) - (b.trackNumber || 0);
        }
        return (a.title || '').localeCompare(b.title || '');
    });
};

export const buildMobileLibraryCollections = (
    localSongs: LocalSong[],
    localPlaylists: LocalPlaylist[],
    catalog: LocalLibraryDisplayCatalog | undefined,
    t: (key: string, fallback?: string) => string,
) => {
    const groups = buildLocalHomeGroups(
        localSongs,
        localPlaylists,
        ((key: string) => t(key, key)) as any,
        catalog,
        (assetId, size = 512) => getLocalCoverAssetUrl(assetId, size),
    );

    const toDetail = (
        kind: MobileCollectionDetail['kind'],
        group: LocalLibraryGroup,
    ): MobileCollectionDetail => ({
        kind,
        id: group.id,
        title: group.name,
        subtitle: group.description,
        coverUrl: typeof group.coverUrl === 'string' ? group.coverUrl : undefined,
        songs: group.songs,
    });

    return {
        albums: groups.albums.map(g => toDetail('album', g)),
        artists: groups.artists.map(g => toDetail('artist', g)),
        folders: groups.folders.map(g => toDetail('folder', g)),
        playlists: groups.playlists.map(g => toDetail('playlist', g)),
    };
};

export const isLocalSongCurrentlyPlaying = (
    localSong: LocalSong,
    currentSong: SongResult | null | undefined,
): boolean => {
    if (!currentSong) return false;
    const localRefId = (currentSong as SongResult & { localRef?: { songId?: string } }).localRef?.songId;
    if (localRefId && localRefId === localSong.id) return true;
    return currentSong.name === localSong.title;
};
