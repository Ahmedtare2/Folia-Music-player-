import type { LocalLibraryGroup, LocalPlaylist, LocalSong, SongResult } from '../../types';
import type { LocalLibraryDisplayCatalog } from '../../services/playbackAdapters';
import { getLocalCoverAssetUrl } from '../../services/localCoverAssetUrl';
import { buildLocalHomeGroups } from '../../library/core/home/localHomeModel';

// src/components/mobile/mobileNavigationModel.ts
// Pure state, collection grouping, filtering/sorting, visualizer visibility, and hardware-Back
// navigation model for the Phase 4 mobile-first Android music player shell.

export type MobilePrimaryTab = 'songs' | 'albums' | 'folders' | 'online' | 'settings';
export type MobileAlbumsSubTab = 'albums' | 'artists';
export type MobileFoldersSubTab = 'folders' | 'playlists';
export type MobileOnlineSubTab = 'discover' | 'search' | 'navidrome' | 'backends';
export type MobileSongSortOrder = 'title' | 'artist' | 'album' | 'recent';
export type MobilePlayerSheetState = 'collapsed' | 'expanded';
export type MobilePlayerDisplayMode = 'cover' | 'lyrics' | 'stage';
export type MobileSubDrawer = 'none' | 'lyrics-tools' | 'equalizer' | 'queue';

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
    onlineSubTab?: MobileOnlineSubTab;
    collectionDetail: MobileCollectionDetail | null;
    playerSheet: MobilePlayerSheetState;
    playerDisplayMode: MobilePlayerDisplayMode;
    subDrawer: MobileSubDrawer;
}

export interface ExternalModalState {
    isLyricMatchOpen?: boolean;
    isSettingsModalOpen?: boolean;
    isCommandPaletteOpen?: boolean;
    isEqualizerOpen?: boolean;
    isSearchOpen?: boolean;
    isLoginWindowOpen?: boolean;
    closeLyricMatch?: () => void;
    closeSettingsModal?: () => void;
    closeCommandPalette?: () => void;
    closeEqualizer?: () => void;
    closeSearch?: () => void;
    closeLoginWindow?: () => void;
}

export const INITIAL_MOBILE_NAVIGATION_STATE: MobileNavigationState = {
    activeTab: 'songs',
    albumsSubTab: 'albums',
    foldersSubTab: 'folders',
    onlineSubTab: 'discover',
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

    if (modals.isEqualizerOpen && modals.closeEqualizer) {
        return {
            handled: true,
            nextState: state,
            sideEffect: modals.closeEqualizer,
        };
    }

    if (modals.isLoginWindowOpen && modals.closeLoginWindow) {
        return {
            handled: true,
            nextState: state,
            sideEffect: modals.closeLoginWindow,
        };
    }

    if (modals.isSearchOpen && modals.closeSearch) {
        return {
            handled: true,
            nextState: state,
            sideEffect: modals.closeSearch,
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
    const importedNames = (song.importedMetadata?.artistNames || []).filter(Boolean);
    const onlineNames = (song.onlineMetadata?.artists?.map(a => a.name) || []).filter(Boolean);
    const names = song.titleOrigin === 'import'
        ? (importedNames.length > 0 ? importedNames : onlineNames)
        : (onlineNames.length > 0 ? onlineNames : importedNames);
    const joined = names.join(', ').trim();
    return joined || song.albumArtist?.trim() || unknownArtistLabel;
};

export const resolveLocalSongAlbumText = (song: LocalSong, unknownAlbumLabel = 'Unknown Album'): string => {
    const importedAlbum = (song.importedMetadata?.albumName || '').trim();
    const onlineAlbum = (song.onlineMetadata?.album?.name || '').trim();
    const album = song.titleOrigin === 'import'
        ? (importedAlbum || onlineAlbum)
        : (onlineAlbum || importedAlbum);
    return album || unknownAlbumLabel;
};

// ---- A-Z title ordering (Latin A-Z, then Arabic, then digits/symbols as "#") and the letter index beside the list.
const ARABIC_LETTER_ORDER = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي';
const ARABIC_MARKS_RE = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
const ARABIC_CHAR_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const ARABIC_FOLD: Record<string, string> = {
    'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ى': 'ي', 'ئ': 'ي', 'ی': 'ي', 'ؤ': 'و', 'ة': 'ه', 'ہ': 'ه', 'ک': 'ك', 'ء': 'ا',
};
const titleCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export type TitleSortInfo = { group: 0 | 1 | 2; letter: string; rank: number; text: string };

export const getTitleSortInfo = (rawTitle: string): TitleSortInfo => {
    let text = (rawTitle || '').normalize('NFKC').replace(ARABIC_MARKS_RE, '');
    text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    text = text.replace(/^[^\p{L}\p{N}]+/u, '');
    const first = text.charAt(0);
    if (/[A-Za-z]/.test(first)) {
        return { group: 0, letter: first.toUpperCase(), rank: first.toUpperCase().charCodeAt(0), text: text.toLowerCase() };
    }
    if (first && ARABIC_CHAR_RE.test(first)) {
        const folded = ARABIC_FOLD[first] ?? first;
        const index = ARABIC_LETTER_ORDER.indexOf(folded);
        const letter = index >= 0 ? folded : 'ا';
        const body = Array.from(text).map(ch => ARABIC_FOLD[ch] ?? ch).join('');
        return { group: 1, letter, rank: index >= 0 ? index : 0, text: body };
    }
    return { group: 2, letter: '#', rank: 0, text: text.toLowerCase() };
};

const compareTitleInfo = (a: TitleSortInfo, b: TitleSortInfo): number => (
    a.group - b.group
    || a.rank - b.rank
    || titleCollator.compare(a.text, b.text)
);

const songTitleForSort = (song: LocalSong): string => song.title?.trim() || song.fileName || '';

/** Letters present in the (title-sorted) list, in list order, and the index of the first song under each. */
export const buildTitleLetterIndex = (songs: readonly LocalSong[]): { letters: string[]; firstIndex: Map<string, number> } => {
    const firstIndex = new Map<string, number>();
    songs.forEach((song, index) => {
        const { letter } = getTitleSortInfo(songTitleForSort(song));
        if (!firstIndex.has(letter)) firstIndex.set(letter, index);
    });
    return { letters: Array.from(firstIndex.keys()), firstIndex };
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

    if (sortOrder === 'title') {
        const keyed = filtered.map(song => ({ song, info: getTitleSortInfo(songTitleForSort(song)) }));
        keyed.sort((a, b) => compareTitleInfo(a.info, b.info));
        return keyed.map(item => item.song);
    }

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
    ): MobileCollectionDetail => {
        const firstSong = group.songs[0];
        const fallbackCover = firstSong ? resolveLocalSongCoverThumb(firstSong, 512) : undefined;
        let subtitle = group.description;
        if (kind === 'album' && firstSong) {
            const artistText = resolveLocalSongArtistText(firstSong, t('localMusic.unknownArtist', 'Unknown Artist'));
            if (!subtitle || subtitle === t('localMusic.albums', 'localMusic.albums') || subtitle === 'localMusic.albums') {
                subtitle = artistText;
            }
        }
        return {
            kind,
            id: group.id,
            title: group.name,
            subtitle,
            coverUrl: (typeof group.coverUrl === 'string' && group.coverUrl) ? group.coverUrl : fallbackCover,
            songs: group.songs,
        };
    };

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

export interface LibraryScrollRestorationInput {
    savedScrollTop: number;
    viewportHeight: number;
    rowHeight: number;
    totalItems: number;
    currentVisibleLimit: number;
    stepSize: number;
    activeSongIndex: number;
    openedFromThisContext: boolean;
}

export interface LibraryScrollRestorationResult {
    nextVisibleLimit: number;
    nextScrollTop: number;
    shouldScrollActiveSongIntoView: boolean;
}

/**
 * Computes the restored library window limit and scroll offset when returning from the Now Playing
 * sheet back to the library view.
 * - Preserves the exact saved scroll offset when valid.
 * - Expands `visibleSongLimit` if the currently playing track was opened from this library context
 *   and advanced beyond the rendered window while the player was open.
 * - Keeps the currently playing song visible within the viewport if it was opened from this context
 *   and moved outside the visible scroll range while the player was open.
 * - Clamps scroll offset cleanly if items were removed or filtered while the player was open.
 */
export const computeRestoredLibraryScrollState = (
    input: LibraryScrollRestorationInput,
): LibraryScrollRestorationResult => {
    const safeRowHeight = Math.max(40, input.rowHeight || 64);
    const safeViewport = Math.max(safeRowHeight, input.viewportHeight || 480);
    const safeStep = Math.max(20, input.stepSize || 120);
    const safeTotal = Math.max(0, input.totalItems);

    let nextVisibleLimit = Math.max(safeStep, input.currentVisibleLimit || safeStep);
    if (input.openedFromThisContext && input.activeSongIndex >= 0) {
        const neededLimit = Math.min(
            safeTotal,
            Math.ceil((input.activeSongIndex + 12) / safeStep) * safeStep,
        );
        if (neededLimit > nextVisibleLimit) {
            nextVisibleLimit = neededLimit;
        }
    }

    const renderedCount = Math.min(safeTotal, nextVisibleLimit);
    const maxScrollTop = Math.max(0, renderedCount * safeRowHeight - safeViewport);
    let nextScrollTop = Math.max(0, Math.min(input.savedScrollTop || 0, maxScrollTop));
    let shouldScrollActiveSongIntoView = false;

    if (input.openedFromThisContext && input.activeSongIndex >= 0 && input.activeSongIndex < safeTotal) {
        const itemTop = input.activeSongIndex * safeRowHeight;
        const itemBottom = itemTop + safeRowHeight;
        const viewTop = nextScrollTop;
        const viewBottom = nextScrollTop + safeViewport;
        if (itemTop < viewTop) {
            nextScrollTop = Math.max(0, Math.min(itemTop - safeRowHeight * 0.5, maxScrollTop));
            shouldScrollActiveSongIntoView = true;
        } else if (itemBottom > viewBottom) {
            nextScrollTop = Math.max(0, Math.min(itemBottom - safeViewport + safeRowHeight * 0.5, maxScrollTop));
            shouldScrollActiveSongIntoView = true;
        }
    }

    return {
        nextVisibleLimit,
        nextScrollTop,
        shouldScrollActiveSongIntoView,
    };
};
