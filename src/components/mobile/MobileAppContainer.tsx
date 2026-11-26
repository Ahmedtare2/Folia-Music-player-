import type { FoliaPlaylistSummary } from '../../types/foliaPlaylist';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { MotionValue } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import {
    type LocalSong,
    type LyricData,
    PlayerState,
    type ReplayGainMode,
    type SongResult,
    type Theme,
} from '../../types';
import { type LocalLibraryDisplayCatalog, buildLocalQueue } from '../../services/playbackAdapters';
import {
    LOCAL_MUSIC_SCAN_PROGRESS_EVENT,
    type LocalMusicScanProgressDetail,
    cancelLocalLibraryScan,
    getActiveLocalMusicScanProgress,
    importFolder,
    resyncAllFolders,
} from '../../services/localMusicService';
import { importLocalPlaylistFile } from '../../services/foliaPlaylist/foliaPlaylistM3u';
import { getSongAlbumLabel, getSongArtistLabel } from '../../services/onlineMusic/songMetadata';
import { usePlaybackStore } from '../../stores/usePlaybackStore';
import { closeSettings, openSettings, useSettingsModalStore } from '../../stores/useSettingsModalStore';
import { setStatusMessage } from '../../stores/useStatusMessageStore';
import { useThemeSettingsStore } from '../../stores/useThemeSettingsStore';
import { useTypographySettingsStore } from '../../stores/useTypographySettingsStore';
import type { NavidromeSong } from '../../types/navidrome';
import { useAudioSettingsStore } from '../../stores/useAudioSettingsStore';
import { useVisualizerSettingsStore } from '../../stores/useVisualizerSettingsStore';
import { closeLoginWindow, useLoginWindowStore } from '../login/loginWindowStore';
import MobilePlayerShell from './MobilePlayerShell';

// src/components/mobile/MobileAppContainer.tsx
// Connects the Phase 4 MobilePlayerShell to Folia's stores and local music services.

interface MobileAppContainerProps {
    localSongs: LocalSong[];
    localPlaylists: FoliaPlaylistSummary[];
    localLibraryCatalog: LocalLibraryDisplayCatalog;
    currentSong: SongResult | null;
    coverUrl: string | null;
    playerState: PlayerState;
    currentTime: MotionValue<number>;
    lyricCurrentTime: MotionValue<number>;
    duration: number;
    lyrics: LyricData | null;
    currentLineIndex: number;
    isLyricsLoading: boolean;
    isLiked: boolean;
    loopMode: 'off' | 'all' | 'one';
    replayGainMode: ReplayGainMode;
    onChangeReplayGainMode: (mode: ReplayGainMode) => void;
    theme: Theme;
    onToggleDaylight: () => void;
    lyricTimelineOffsetMs: number;
    onLyricTimelineOffsetChange: (offsetMs: number) => void;
    onChangeLyricsSource: (source: 'local' | 'embedded' | 'online') => void;
    onUpdateLocalLyrics: (content: string, isTranslation: boolean, fileName?: string) => void;
    onOpenLyricMatch: () => void;
    onCloseLyricMatch: () => void;
    isLyricMatchOpen: boolean;
    onTogglePureMusic?: () => void;
    onRefreshLocalSongs: () => Promise<void> | void;
    onPlayLocalSong: (song: LocalSong, queue?: LocalSong[]) => Promise<void> | void;
    onAddLocalSongToQueue: (song: LocalSong) => void;
    playQueue: SongResult[];
    onPlayQueueSong: (song: SongResult, queue: SongResult[]) => void;
    onRemoveQueueSong: (index: number) => void;
    onSaveQueueAsPlaylist: (name: string) => Promise<void>;
    onSeek: (timeSec: number) => void;
    onLyricLineSeek: (timeSec: number) => void;
    onTogglePlay: () => void;
    onPrevTrack: () => void;
    onNextTrack: () => void;
    onToggleLoop: () => void;
    onToggleLike: () => void;
    onShuffleQueue: () => void;
    isCommandPaletteOpen: boolean;
    onCloseCommandPalette: () => void;
    onVisualizerVisibilityChange?: (visible: boolean) => void;
    isLatticeOpen?: boolean;
    onOpenLattice?: () => void;
    onCloseLattice?: () => void;
    onPlayOnlineSong?: (song: SongResult, queue?: SongResult[]) => void;
    onAddOnlineSongToQueue?: (song: SongResult) => void;
    onPlayNavidromeSong?: (song: NavidromeSong, queue?: NavidromeSong[]) => void;
    onAddNavidromeSongsToQueue?: (songs: NavidromeSong[]) => void;
    onOpenFullSearchWorkspace?: () => void;
    onCloseSearch?: () => void;
    isSearchOpen?: boolean;
    onAutoMatchLyrics?: () => void;
}

export const MobileAppContainer: React.FC<MobileAppContainerProps> = ({
    localSongs,
    localPlaylists,
    localLibraryCatalog,
    currentSong,
    coverUrl,
    playerState,
    currentTime,
    lyricCurrentTime,
    duration,
    lyrics,
    currentLineIndex,
    isLyricsLoading,
    isLiked,
    loopMode,
    replayGainMode,
    onChangeReplayGainMode,
    theme,
    onToggleDaylight,
    lyricTimelineOffsetMs,
    onLyricTimelineOffsetChange,
    onChangeLyricsSource,
    onUpdateLocalLyrics,
    onOpenLyricMatch,
    onCloseLyricMatch,
    isLyricMatchOpen,
    onTogglePureMusic,
    onRefreshLocalSongs,
    onPlayLocalSong,
    onAddLocalSongToQueue,
    playQueue,
    onPlayQueueSong,
    onRemoveQueueSong,
    onSaveQueueAsPlaylist,
    onSeek,
    onLyricLineSeek,
    onTogglePlay,
    onPrevTrack,
    onNextTrack,
    onToggleLoop,
    onToggleLike,
    onShuffleQueue,
    isCommandPaletteOpen,
    onCloseCommandPalette,
    onVisualizerVisibilityChange,
    isLatticeOpen = false,
    onOpenLattice,
    onCloseLattice,
    onPlayOnlineSong,
    onAddOnlineSongToQueue,
    onPlayNavidromeSong,
    onAddNavidromeSongsToQueue,
    onOpenFullSearchWorkspace,
    onCloseSearch,
    isSearchOpen = false,
    onAutoMatchLyrics,
}) => {
    const isEqualizerOpen = useAudioSettingsStore(state => state.isAudioEqualizerOpen);
    const closeEqualizer = useAudioSettingsStore(state => state.closeAudioEqualizer);
    const isLoginWindowOpen = useLoginWindowStore(state => state.isOpen);
    const { t } = useTranslation();
    const activeLocalLyricsSource = usePlaybackStore(state => state.activeLocalLyricsSource);
    const isSettingsModalOpen = useSettingsModalStore(state => state.settingsModalState.isOpen);
    const { isDaylight, useCoverColorBg, handleToggleCoverColorBg } = useThemeSettingsStore(
        useShallow(state => ({
            isDaylight: state.isDaylight,
            useCoverColorBg: state.useCoverColorBg,
            handleToggleCoverColorBg: state.handleToggleCoverColorBg,
        })),
    );
    const { visualizerMode, handleSetVisualizerMode } = useVisualizerSettingsStore(
        useShallow(state => ({
            visualizerMode: state.visualizerMode,
            handleSetVisualizerMode: state.handleSetVisualizerMode,
        })),
    );
    const {
        lyricsFontScale,
        handleSetLyricsFontScale,
        showSubtitleTranslation,
        handleToggleSubtitleTranslation,
    } = useTypographySettingsStore(
        useShallow(state => ({
            lyricsFontScale: state.lyricsFontScale,
            handleSetLyricsFontScale: state.handleSetLyricsFontScale,
            showSubtitleTranslation: state.showSubtitleTranslation,
            handleToggleSubtitleTranslation: state.handleToggleShowSubtitleTranslation,
        })),
    );

    const [isBusy, setIsBusy] = useState(false);
    const [scanProgress, setScanProgress] = useState<LocalMusicScanProgressDetail | null>(() => getActiveLocalMusicScanProgress());
    const scanPercent = useMemo(() => {
        if (!scanProgress?.active) return 0;
        if (!scanProgress.totalSongs || scanProgress.totalSongs <= 0) return 5;
        return Math.min(100, Math.round(((scanProgress.completedSongs ?? 0) / scanProgress.totalSongs) * 100));
    }, [scanProgress]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const onScanProgress = (event: Event) => {
            const detail = (event as CustomEvent<LocalMusicScanProgressDetail>).detail;
            setScanProgress(detail ? { ...detail } : null);
        };
        window.addEventListener(LOCAL_MUSIC_SCAN_PROGRESS_EVENT, onScanProgress);
        return () => window.removeEventListener(LOCAL_MUSIC_SCAN_PROGRESS_EVENT, onScanProgress);
    }, []);

    const handleCancelScan = useCallback(() => {
        cancelLocalLibraryScan(scanProgress?.folderName);
    }, [scanProgress?.folderName]);

    const handleImportFolder = useCallback(async () => {
        if (isBusy) return;
        setIsBusy(true);
        try {
            const imported = await importFolder();
            if (imported.length > 0) {
                await onRefreshLocalSongs();
                setStatusMessage({
                    type: 'success',
                    text: `Imported ${imported.length} tracks`,
                });
            }
        } catch (error) {
            console.error('[MobileAppContainer] Failed to import folder:', error);
            setStatusMessage({
                type: 'error',
                text: t('localMusic.importNotSupported', 'Failed to import folder'),
            });
        } finally {
            setIsBusy(false);
        }
    }, [isBusy, onRefreshLocalSongs, t]);

    const handleRefreshFolders = useCallback(async () => {
        if (isBusy) return;
        setIsBusy(true);
        try {
            const resynced = await resyncAllFolders();
            if ((resynced?.length ?? 0) > 0) {
                await onRefreshLocalSongs();
            }
        } catch (error) {
            console.error('[MobileAppContainer] Failed to resync folders:', error);
        } finally {
            setIsBusy(false);
        }
    }, [isBusy, onRefreshLocalSongs]);

    const handleImportPlaylist = useCallback(async (file: File) => {
        if (isBusy) return;
        setIsBusy(true);
        try {
            const result = await importLocalPlaylistFile(file, localSongs);
            if (result.playlist?.name) {
                await onRefreshLocalSongs();
                setStatusMessage({
                    type: 'success',
                    text: `Imported playlist "${result.playlist.name}" (${result.matchedSongIds.length} tracks)`,
                });
            } else {
                setStatusMessage({
                    type: 'error',
                    text: t('localMusic.playlistImportNoMatches', 'No matching tracks found in library'),
                });
            }
        } catch (error) {
            console.error('[MobileAppContainer] Failed to import playlist file:', error);
        } finally {
            setIsBusy(false);
        }
    }, [isBusy, localSongs, onRefreshLocalSongs, t]);

    const artistName = useMemo(
        () => (currentSong ? getSongArtistLabel(currentSong) || t('localMusic.unknownArtist', 'Unknown Artist') : ''),
        [currentSong, t],
    );
    const albumName = useMemo(
        () => (currentSong ? getSongAlbumLabel(currentSong) || '' : ''),
        [currentSong],
    );

    const externalModals = useMemo(() => ({
        isLyricMatchOpen,
        isSettingsModalOpen,
        isCommandPaletteOpen,
        isEqualizerOpen,
        isSearchOpen,
        isLoginWindowOpen,
        closeLyricMatch: onCloseLyricMatch,
        closeSettingsModal: closeSettings,
        closeCommandPalette: onCloseCommandPalette,
        closeEqualizer,
        closeSearch: onCloseSearch,
        closeLoginWindow,
    }), [
        closeEqualizer,
        isCommandPaletteOpen,
        isEqualizerOpen,
        isLoginWindowOpen,
        isLyricMatchOpen,
        isSearchOpen,
        isSettingsModalOpen,
        onCloseCommandPalette,
        onCloseLyricMatch,
        onCloseSearch,
    ]);

    return (
        <MobilePlayerShell
            localSongs={localSongs}
            localPlaylists={localPlaylists}
            localLibraryCatalog={localLibraryCatalog}
            currentSong={currentSong}
            artistName={artistName}
            albumName={albumName}
            coverUrl={coverUrl}
            playerState={playerState}
            currentTime={currentTime}
            lyricCurrentTime={lyricCurrentTime}
            duration={duration}
            lyrics={lyrics}
            currentLineIndex={currentLineIndex}
            isLyricsLoading={isLyricsLoading}
            isLiked={isLiked}
            loopMode={loopMode}
            replayGainMode={replayGainMode}
            onChangeReplayGainMode={onChangeReplayGainMode}
            theme={theme}
            isDaylight={isDaylight}
            onToggleDaylight={onToggleDaylight}
            useCoverColorBg={useCoverColorBg}
            onToggleCoverColorBg={handleToggleCoverColorBg}
            visualizerMode={visualizerMode}
            onVisualizerModeChange={handleSetVisualizerMode}
            lyricsFontScale={lyricsFontScale}
            onLyricsFontScaleChange={handleSetLyricsFontScale}
            showSubtitleTranslation={showSubtitleTranslation}
            onToggleSubtitleTranslation={handleToggleSubtitleTranslation}
            lyricTimelineOffsetMs={lyricTimelineOffsetMs}
            onLyricTimelineOffsetChange={onLyricTimelineOffsetChange}
            activeLocalLyricsSource={activeLocalLyricsSource}
            onChangeLyricsSource={onChangeLyricsSource}
            onImportLocalLyricsFile={(content, fileName) => onUpdateLocalLyrics(content, false, fileName)}
            onOpenLyricMatch={onOpenLyricMatch}
            onAutoMatchLyrics={onAutoMatchLyrics}
            onTogglePureMusic={onTogglePureMusic}
            onImportFolder={handleImportFolder}
            onRefreshFolders={handleRefreshFolders}
            onImportPlaylistFile={handleImportPlaylist}
            isImportingOrScanning={isBusy || Boolean(scanProgress?.active)}
            scanPercent={scanPercent}
            scanProgress={scanProgress}
            onCancelScan={handleCancelScan}
            onPlayLocalSongList={(song, queue) => {
                void onPlayLocalSong(song, queue);
            }}
            onAddLocalSongToQueue={onAddLocalSongToQueue}
            onPlayQueueSong={onPlayQueueSong}
            playQueue={playQueue}
            onRemoveQueueSong={onRemoveQueueSong}
            onSaveQueueAsPlaylist={onSaveQueueAsPlaylist}
            onSeek={onSeek}
            onLyricLineSeek={onLyricLineSeek}
            onTogglePlay={onTogglePlay}
            onPrevTrack={onPrevTrack}
            onNextTrack={onNextTrack}
            onToggleLoop={onToggleLoop}
            onToggleLike={onToggleLike}
            onShuffleQueue={onShuffleQueue}
            onOpenFullSettingsModal={() => openSettings('options')}
            externalModals={externalModals}
            onVisualizerVisibilityChange={onVisualizerVisibilityChange}
            isLatticeOpen={isLatticeOpen}
            onOpenLattice={onOpenLattice}
            onCloseLattice={onCloseLattice}
            onPlayOnlineSong={onPlayOnlineSong}
            onAddOnlineSongToQueue={onAddOnlineSongToQueue}
            onPlayNavidromeSong={onPlayNavidromeSong}
            onAddNavidromeSongsToQueue={onAddNavidromeSongsToQueue}
            onOpenFullSearchWorkspace={onOpenFullSearchWorkspace}
        />
    );
};

export default React.memo(MobileAppContainer);
export { buildLocalQueue };
