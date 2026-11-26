import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { PlayerState } from '../types';
import type { SongResult } from '../types';
import { getSongAlbumLabel, getSongArtistLabel, getSongCoverUrl } from '../services/onlineMusic/songMetadata';
import {
    hasFoliaAndroidBridge,
    stopAndroidPlaybackNotification,
    subscribeAndroidMediaActions,
    syncAndroidPlaybackNotification,
} from '../services/android/foliaAndroidBridge';
import { currentTime } from '../stores/motionSignals';
import {
    getSupportedMediaSessionArtworkUrl,
    isMediaSessionSourceReady,
    publishMediaSessionTrack,
} from '../utils/mediaSessionSync';
import { usePlaybackStore } from '../stores/usePlaybackStore';
import { useHifiTrackStore } from '../services/hifi/hifiPlayback';
import { getObservedMedia } from '../services/hifi/hifiMediaShim';

// Bridges Folia playback state to the browser Media Session API.
export type UseMediaSessionBridgeOptions = {
    audioRef: RefObject<HTMLAudioElement | null>;
    /**
     * The deck the displayed track is playing on, or null when the picture is live.
     *
     * Metadata, clock and source have to describe the same deck. `currentSong` is already the
     * DISPLAYED track - the outgoing one for the length of a blend - while `audioRef` names the
     * active deck, which by then is the arriving track. Publishing the two together put the outgoing
     * track's title on the incoming track's duration and position, so the system panel showed one
     * song's name over another song's progress. `audioSrc` is passed to match this element.
     */
    getDisplayAudioElement?: () => HTMLAudioElement | null;
    audioSrc: string | null;
    currentSong: SongResult | null;
    cachedCoverUrl: string | null;
    playerState: PlayerState;
    isNowPlayingStageActive: boolean;
    unknownArtistLabel: string;
    mediaSessionPlayRef: RefObject<() => Promise<void>>;
    mediaSessionPauseRef: RefObject<() => void>;
    mediaSessionPrevRef: RefObject<() => void>;
    mediaSessionNextRef: RefObject<() => Promise<void> | void>;
    isNowPlayingControlDisabledRef: RefObject<boolean>;
};

export const useMediaSessionBridge = ({
    audioRef,
    getDisplayAudioElement,
    audioSrc,
    currentSong,
    cachedCoverUrl,
    playerState,
    isNowPlayingStageActive,
    unknownArtistLabel,
    mediaSessionPlayRef,
    mediaSessionPauseRef,
    mediaSessionPrevRef,
    mediaSessionNextRef,
    isNowPlayingControlDisabledRef,
}: UseMediaSessionBridgeOptions) => {
    const preDuckVolumeRef = useRef<number | null>(null);
    // On the HiFi route mpv sounds the song: the position comes off the HiFi media shim, and its
    // source (one per HiFi track) stands in for `audioSrc`, which is null there.
    const playbackRoute = usePlaybackStore(state => state.playbackRoute);
    const hifiTrackKey = useHifiTrackStore(state => state.current?.trackKey ?? null);

    useEffect(() => {
        const seekDisplayElement = (targetTimeSec: number) => {
            if (isNowPlayingControlDisabledRef.current) return;
            const audio = getDisplayAudioElement?.() ?? audioRef.current;
            if (!audio || !Number.isFinite(targetTimeSec)) return;
            const maxTime = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : targetTimeSec;
            const clamped = Math.max(0, Math.min(targetTimeSec, maxTime));
            audio.currentTime = clamped;
            currentTime.set(clamped);
        };

        const unsubscribeAndroid = hasFoliaAndroidBridge()
            ? subscribeAndroidMediaActions((event) => {
                if (isNowPlayingControlDisabledRef.current && event.action !== 'pause' && event.action !== 'stop') {
                    return;
                }
                const audio = getDisplayAudioElement?.() ?? audioRef.current;
                switch (event.action) {
                    case 'play':
                        if (audio) void mediaSessionPlayRef.current().catch(err => console.error('Android MediaSession play failed', err));
                        break;
                    case 'pause':
                    case 'stop':
                        if (audio) mediaSessionPauseRef.current();
                        break;
                    case 'previoustrack':
                        mediaSessionPrevRef.current();
                        break;
                    case 'nexttrack':
                        void mediaSessionNextRef.current();
                        break;
                    case 'seekto':
                        if (typeof event.seekTimeMs === 'number' && Number.isFinite(event.seekTimeMs)) {
                            seekDisplayElement(event.seekTimeMs / 1000);
                        }
                        break;
                    case 'duck':
                        if (audio && preDuckVolumeRef.current === null) {
                            preDuckVolumeRef.current = audio.volume;
                            audio.volume = Math.max(0.05, audio.volume * 0.25);
                        }
                        break;
                    case 'unduck':
                        if (audio && preDuckVolumeRef.current !== null) {
                            audio.volume = preDuckVolumeRef.current;
                            preDuckVolumeRef.current = null;
                        }
                        break;
                }
            })
            : () => {};

        if (!('mediaSession' in navigator)) {
            return () => {
                unsubscribeAndroid();
            };
        }

        const mediaSession = navigator.mediaSession;
        const setActionHandlerSafely = (
            action: MediaSessionAction,
            handler: MediaSessionActionHandler | null
        ) => {
            try {
                mediaSession.setActionHandler(action, handler);
            } catch (e) {
                console.warn(`[MediaSession] Failed to bind ${action} handler`, e);
            }
        };

        setActionHandlerSafely('play', async () => {
            if (isNowPlayingControlDisabledRef.current || !audioRef.current) {
                return;
            }

            try {
                await mediaSessionPlayRef.current();
            } catch (e) {
                console.error('MediaSession play failed', e);
            }
        });
        setActionHandlerSafely('pause', () => {
            if (isNowPlayingControlDisabledRef.current || !audioRef.current) {
                return;
            }

            mediaSessionPauseRef.current();
        });
        setActionHandlerSafely('previoustrack', () => {
            if (isNowPlayingControlDisabledRef.current) {
                return;
            }
            mediaSessionPrevRef.current();
        });
        setActionHandlerSafely('nexttrack', () => {
            if (isNowPlayingControlDisabledRef.current) {
                return;
            }
            void mediaSessionNextRef.current();
        });
        setActionHandlerSafely('seekto', (details) => {
            if (typeof details.seekTime === 'number') {
                seekDisplayElement(details.seekTime);
            }
        });

        return () => {
            unsubscribeAndroid();
            setActionHandlerSafely('play', null);
            setActionHandlerSafely('pause', null);
            setActionHandlerSafely('previoustrack', null);
            setActionHandlerSafely('nexttrack', null);
            setActionHandlerSafely('seekto', null);
        };
    }, [audioRef, getDisplayAudioElement, isNowPlayingControlDisabledRef, mediaSessionNextRef, mediaSessionPauseRef, mediaSessionPlayRef, mediaSessionPrevRef]);

    useEffect(() => {
        if (!currentSong) {
            if ('mediaSession' in navigator) {
                try {
                    navigator.mediaSession.setPositionState();
                    navigator.mediaSession.metadata = null;
                } catch (e) {
                    console.warn('[MediaSession] Failed to clear metadata', e);
                }
            }
            if (hasFoliaAndroidBridge()) {
                void stopAndroidPlaybackNotification();
            }
            return;
        }

        // The displayed track's own deck, so the position published below belongs to the title
        // published beside it. Falls back to the active deck whenever no blend is holding a picture.
        const audio = getObservedMedia(getDisplayAudioElement?.() ?? audioRef.current);
        // The shim switched to this track before the track store named it, so its source is current here.
        // On every non-web route (mpv, the provider's own player) that is its shim's source, not a URL.
        const expectedSource = playbackRoute === 'web' ? audioSrc : getObservedMedia(null)?.currentSrc;
        if (!audio || !expectedSource) {
            return;
        }

        let disposed = false;
        const sourceArtworkUrl = cachedCoverUrl || getSongCoverUrl(currentSong) || '';
        const baseUri = typeof document !== 'undefined' ? document.baseURI : 'https://localhost/';
        let artworkUrl = getSupportedMediaSessionArtworkUrl(sourceArtworkUrl, baseUri);
        let disposableArtworkUrl: string | null = null;

        const publish = () => {
            if (disposed) return;

            const title = currentSong.name;
            const artist = getSongArtistLabel(currentSong) || unknownArtistLabel;
            const album = getSongAlbumLabel(currentSong);

            if ('mediaSession' in navigator && isMediaSessionSourceReady(audio, expectedSource, baseUri)) {
                try {
                    publishMediaSessionTrack(navigator.mediaSession, audio, {
                        title,
                        artist,
                        album,
                        artworkUrl,
                    });
                } catch (e) {
                    console.warn('[MediaSession] Failed to update metadata', e);
                }
            }

            if (hasFoliaAndroidBridge()) {
                const durationSec = Number.isFinite(audio.duration) && audio.duration > 0
                    ? audio.duration
                    : (currentSong.durationMs ? currentSong.durationMs / 1000 : 0);
                const positionSec = Number.isFinite(audio.currentTime) && audio.currentTime >= 0
                    ? audio.currentTime
                    : 0;
                const isPlaying = !isNowPlayingStageActive && playerState === PlayerState.PLAYING;
                void syncAndroidPlaybackNotification({
                    title,
                    artist,
                    album,
                    artworkUrl: artworkUrl || sourceArtworkUrl || null,
                    durationMs: Math.round(durationSec * 1000),
                    positionMs: Math.round(positionSec * 1000),
                    isPlaying,
                    playbackSpeed: Number.isFinite(audio.playbackRate) && audio.playbackRate > 0 ? audio.playbackRate : 1,
                });
            }
        };

        // MediaMetadata rejects Electron's custom protocol, so expose that image through a
        // short-lived blob URL while this track owns the platform media session.
        const prepareUnsupportedArtwork = async () => {
            if (!sourceArtworkUrl || artworkUrl) return;

            try {
                const response = await fetch(sourceArtworkUrl);
                if (!response.ok) throw new Error(`Artwork request failed: ${response.status}`);
                const artworkBlob = await response.blob();
                if (artworkBlob.size <= 0 || !artworkBlob.type.startsWith('image/')) {
                    throw new Error('Artwork response is not a valid image');
                }

                const objectUrl = URL.createObjectURL(artworkBlob);
                if (disposed) {
                    URL.revokeObjectURL(objectUrl);
                    return;
                }
                disposableArtworkUrl = objectUrl;
                artworkUrl = objectUrl;
                publish();
            } catch (e) {
                if (!disposed) console.warn('[MediaSession] Failed to prepare artwork', e);
            }
        };

        audio.addEventListener('loadedmetadata', publish);
        audio.addEventListener('durationchange', publish);
        audio.addEventListener('seeked', publish);
        audio.addEventListener('ratechange', publish);
        // Re-publish after playback starts in case Chromium delivered a late clear from the old source.
        audio.addEventListener('playing', publish);
        publish();
        void prepareUnsupportedArtwork();

        return () => {
            disposed = true;
            audio.removeEventListener('loadedmetadata', publish);
            audio.removeEventListener('durationchange', publish);
            audio.removeEventListener('seeked', publish);
            audio.removeEventListener('ratechange', publish);
            audio.removeEventListener('playing', publish);
            if (disposableArtworkUrl) URL.revokeObjectURL(disposableArtworkUrl);
        };
    }, [audioRef, audioSrc, cachedCoverUrl, currentSong, getDisplayAudioElement, hifiTrackKey, isNowPlayingStageActive, playbackRoute, playerState, unknownArtistLabel]);

    useEffect(() => {
        if (!('mediaSession' in navigator)) {
            return;
        }

        try {
            navigator.mediaSession.playbackState = isNowPlayingStageActive
                ? 'none'
                : currentSong
                    ? (playerState === PlayerState.PLAYING ? 'playing' : 'paused')
                    : 'none';
        } catch (e) {
            console.warn('[MediaSession] Failed to update playback state', e);
        }
    }, [currentSong, isNowPlayingStageActive, playerState]);
};
