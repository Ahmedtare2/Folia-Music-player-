import { useCallback, useEffect, useRef } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import { PlayerState } from '../../../../types';
import type { ReplayGainInfo, SongResult } from '../../../../types';
import type { LocalSong } from '../../../../types';
import { isLocalPlaybackSong, resolveNavidromePlaybackCarrier } from '../../../../utils/appPlaybackGuards';
import { calculateReplayGain } from '../../../../utils/replayGain';
import { shouldBypassWebAudioDspGraph } from '../../../../utils/audioEqualizer';
import { applyAudioEqualizerSettings } from '../../../../services/audioEqualizerGraph';
import { type AudioEffectChain } from '../../../../services/audioEffects/effectChain';
import { buildPlaybackGraph } from '../../../../services/playbackGraph';
import { cachePlayedTrackAssets } from '../../../../services/playedTrackCache';
import { markProgrammaticPause, registerPlaybackFadeGraph } from '../../../../services/playbackFade';
import { rampGain, type AutomixDeckChain } from '../../../../services/automix/crossfadeGraph';
import {
    bindAudioElementToNativeExoPlayer,
    isAndroidSafStreamUrl,
    loadAndroidNativeTrack,
    setAndroidNativeExoPlayerActive,
    shouldRouteToAndroidNativeExoPlayer,
} from '../../../../services/android/foliaAndroidBridge';
import { getSongAlbumLabel, getSongArtistLabel } from '../../../../services/onlineMusic/songMetadata';
import { setStatusMessage as setStatusMsg } from '../../../../stores/useStatusMessageStore';
import { useAudioSettingsStore } from '../../../../stores/useAudioSettingsStore';
import { setPlayerState } from '../../../../stores/usePlaybackStore';
import { useTranslation } from 'react-i18next';
import { usePlaybackStore } from '../../../../stores/usePlaybackStore';

// src/components/app/playback/bridges/usePlaybackAudioBridge.ts

type ManagedEffectChainHandle = AudioEffectChain & {
    setGraphDspBypass?: (bypassed: boolean) => void;
    isGraphDspBypassed?: () => boolean;
};

type UsePlaybackAudioBridgeParams = {

    audioRef: RefObject<HTMLAudioElement | null>;
    localSongs: LocalSong[];
    isLyricsLoading: boolean;
    shouldAutoPlayRef: MutableRefObject<boolean>;
    audioContextRef: MutableRefObject<AudioContext | null>;
    analyserRef: MutableRefObject<AnalyserNode | null>;
    gainNodeRef: MutableRefObject<GainNode | null>;
    /** Wires both automix decks into the shared mix point. Returns false if a deck is missing. */
    connectDecks: (context: AudioContext, output: AudioNode) => boolean;
    /** The deck the app is currently listening through, for per-track loudness compensation. */
    getActiveChain: () => AutomixDeckChain | null;
    /** Set when a pause interrupted an armed transition; suppresses exactly one autoplay. */
    suppressAutoplayRef: MutableRefObject<boolean>;
    /** True while automix has the next track loaded but its blend is not due to start yet. */
    isAutoplayHeld: boolean;
    syncOutputGain: (targetVolume: number, smoothing?: number) => void;
    getTargetPlaybackVolume: () => number;
    getCoverUrl: () => string | null;
    /** True when Automix crossfade/blend transitions are enabled. */
    automixEnabled?: boolean;
    /** True when Stem Separation is enabled for transitions. */
    stemSeparationEnabled?: boolean;
};

// Bridges audio element setup, direct hardware decoder bypass vs. WebAudio DSP graph, autoplay, replay gain, and media caching.
export function usePlaybackAudioBridge({
    audioRef,
    localSongs,
    isLyricsLoading,
    shouldAutoPlayRef,
    audioContextRef,
    analyserRef,
    gainNodeRef,
    connectDecks,
    getActiveChain,
    suppressAutoplayRef,
    isAutoplayHeld,
    syncOutputGain,
    getTargetPlaybackVolume,
    getCoverUrl,
    automixEnabled = false,
    stemSeparationEnabled = false,
}: UsePlaybackAudioBridgeParams) {
    // Read here rather than passed in: all store fields or i18n.
    const { t } = useTranslation();
    const audioSrc = usePlaybackStore(state => state.audioSrc);
    const currentSong = usePlaybackStore(state => state.currentSong);
    const replayGainMode = usePlaybackStore(state => state.replayGainMode);
    const enableMediaCache = useAudioSettingsStore(state => state.enableMediaCache);

    const previousAudioSrcRef = useRef<string | null>(null);
    const replayGainLogSignatureRef = useRef<string | null>(null);
    const equalizerNodesRef = useRef<BiquadFilterNode[]>([]);
    const effectChainRef = useRef<ManagedEffectChainHandle | null>(null);
    const audioEqualizerSettings = useAudioSettingsStore(state => state.audioEqualizerSettings);

    // When Chorus/Effects, EQ, Automix, and Stem Separation are all turned off, bypass the WebAudio
    // AudioContext processing nodes so the Android hardware audio decoder handles playback directly
    // with minimal CPU usage, leaving maximum CPU/GPU resources for the 60/120fps lyrics visualizer.
    const shouldBypassDsp = shouldBypassWebAudioDspGraph({
        equalizerSettings: audioEqualizerSettings,
        automixEnabled,
        stemSeparationEnabled,
    });
    const useNativeExoPlayer = shouldRouteToAndroidNativeExoPlayer({
        audioSrc,
        automixEnabled,
        stemSeparationEnabled,
        equalizerEnabled: !shouldBypassDsp,
    });
    const lastLoadedExoSrcRef = useRef<string | null>(null);

    useEffect(() => {
        setAndroidNativeExoPlayerActive(useNativeExoPlayer);
        bindAudioElementToNativeExoPlayer(audioRef.current, useNativeExoPlayer);
        if (!useNativeExoPlayer) {
            lastLoadedExoSrcRef.current = null;
        }
        return () => {
            if (!useNativeExoPlayer && audioRef.current) {
                bindAudioElementToNativeExoPlayer(audioRef.current, false);
            }
        };
    }, [audioRef, useNativeExoPlayer]);

    // Recalculates source-specific gain after the audio graph or playback settings become ready.
    const applyReplayGain = useCallback(() => {
        if (!currentSong || !gainNodeRef.current || !audioContextRef.current) return;

        let replayGainInfo: ReplayGainInfo | undefined;
        const localSongId = (currentSong as SongResult & { localRef?: { songId: string } }).localRef?.songId;
        const localData = localSongId ? localSongs.find(song => song.id === localSongId) : undefined;
        if ((currentSong as SongResult & { isLocal?: boolean }).isLocal && localData) {
            replayGainInfo = {
                trackGain: typeof localData.replayGainTrackGain === 'number'
                    ? localData.replayGainTrackGain
                    : localData.replayGain,
                trackPeak: localData.replayGainTrackPeak,
                albumGain: localData.replayGainAlbumGain,
                albumPeak: localData.replayGainAlbumPeak,
            };
        }

        const navidromeSong = resolveNavidromePlaybackCarrier(currentSong);
        const navidromeReplayGain = navidromeSong?.navidromeData.replayGain;
        if (navidromeReplayGain) {
            replayGainInfo = navidromeReplayGain;
        }

        if (currentSong.sourceRef?.kind === 'online') {
            replayGainInfo = currentSong.replayGain;
        }

        const calculation = calculateReplayGain(replayGainInfo, replayGainMode);

        try {
            // Onto the deck rather than the shared output: loudness compensation is a per-track
            // value, so during a blend the two decks legitimately need different ones.
            const activeChain = getActiveChain();
            if (activeChain) {
                rampGain(audioContextRef.current, activeChain.replayGain, calculation.linearGain, 0.1);
            }

            const replayGainLogSignature = JSON.stringify({
                songId: currentSong.id,
                mode: replayGainMode,
                raw: calculation.gainDb,
                effective: calculation.effectiveGainDb,
                peak: calculation.peak ?? null,
            });

            if (replayGainLogSignatureRef.current !== replayGainLogSignature) {
                replayGainLogSignatureRef.current = replayGainLogSignature;
                console.log(`[AudioContext] ReplayGain mode=${replayGainMode} gain=${calculation.effectiveGainDb}dB (raw=${calculation.gainDb}dB, peak=${calculation.peak ?? 'n/a'}, linear=${calculation.linearGain.toFixed(2)})`);
            }
        } catch (error) {
            console.warn('[AudioContext] Failed to apply ReplayGain', error);
        }
    }, [audioContextRef, currentSong, gainNodeRef, getActiveChain, localSongs, replayGainMode]);

    const setupAudioAnalyzer = useCallback((forceCreate = false) => {
        if (!audioRef.current) return;
        // If the AudioContext already exists, update its DSP bypass state and ensure it is not stuck
        // in 'suspended' state when playback starts.
        if (audioContextRef.current) {
            effectChainRef.current?.setGraphDspBypass?.(shouldBypassDsp);
            if (audioContextRef.current.state === 'suspended') {
                void audioContextRef.current.resume().catch(() => {});
            }
            return;
        }
        // Direct Hardware Audio Path: when Chorus, EQ, Automix, and Stem Separation are all turned off,
        // do not instantiate AudioContext or hijack the HTMLAudioElement via createMediaElementSource.
        if (shouldBypassDsp && !forceCreate) {
            syncOutputGain(getTargetPlaybackVolume(), 0);
            return;
        }
        try {
            const AudioContextClass = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!AudioContextClass) return;
            const ctx = new AudioContextClass();
            audioContextRef.current = ctx;

            const analyser = ctx.createAnalyser();
            analyser.fftSize = 2048;
            analyser.smoothingTimeConstant = 0.6;
            analyserRef.current = analyser;

            const builtGraph = buildPlaybackGraph({
                context: ctx,
                analyser,
                connectDecks,
                equalizerNodesRef,
                settings: audioEqualizerSettings,
                bypassDsp: shouldBypassDsp,
            });
            if (!builtGraph) return;
            const { gainNode, fadeNode, effectChain, decksConnected, setDspBypass, isDspBypassed } = builtGraph;
            gainNodeRef.current = gainNode;
            // Hands the transport its own fade node; until this runs (or if setup fails) pause and
            // resume see no graph and fall back to plain element pause/play.
            registerPlaybackFadeGraph({ context: ctx, gain: fadeNode });
            const managedChain: ManagedEffectChainHandle = Object.assign(effectChain, {
                setGraphDspBypass: setDspBypass,
                isGraphDspBypassed: isDspBypassed,
            });
            effectChainRef.current = managedChain;
            if (!decksConnected) {
                console.warn('[AudioContext] Deck setup incomplete, automix will stay idle');
            }
            applyReplayGain();
            syncOutputGain(getTargetPlaybackVolume(), 0);
            if (ctx.state === 'suspended') {
                void ctx.resume().catch(() => {});
            }
        } catch (error) {
            console.error('Audio Context Setup Failed:', error);
        }
    }, [analyserRef, applyReplayGain, audioContextRef, audioEqualizerSettings, audioRef, connectDecks, gainNodeRef, getTargetPlaybackVolume, shouldBypassDsp, syncOutputGain]);

    /**
     * Writes a fully-played track's audio and cover into the media cache.
     */
    const cacheSongAssetsFor = useCallback(async (
        song: SongResult | null,
        src: string | null,
        coverUrl?: string | null,
    ) => {
        if (!enableMediaCache) return;

        await cachePlayedTrackAssets(song, src, coverUrl);
    }, [enableMediaCache]);

    const cacheSongAssets = useCallback(
        () => cacheSongAssetsFor(currentSong, audioSrc, getCoverUrl()),
        [audioSrc, cacheSongAssetsFor, currentSong, getCoverUrl],
    );

    useEffect(() => {
        if (audioRef.current) {
            syncOutputGain(getTargetPlaybackVolume(), 0.015);
        }
    }, [audioRef, getTargetPlaybackVolume, syncOutputGain]);

    useEffect(() => {
        localStorage.setItem('local_replaygain_mode', replayGainMode);
    }, [replayGainMode]);

    useEffect(() => {
        applyReplayGain();
    }, [applyReplayGain]);

    useEffect(() => {
        if (!shouldBypassDsp && !audioContextRef.current && audioRef.current) {
            setupAudioAnalyzer(true);
        }
        const context = audioContextRef.current;
        if (!context) {
            return;
        }
        effectChainRef.current?.setGraphDspBypass?.(shouldBypassDsp);
        if (equalizerNodesRef.current.length === 0) {
            return;
        }
        applyAudioEqualizerSettings(context, equalizerNodesRef.current, audioEqualizerSettings);
        effectChainRef.current?.apply(audioEqualizerSettings.effects, audioEqualizerSettings.enabled && !shouldBypassDsp);
    }, [audioContextRef, audioEqualizerSettings, audioRef, setupAudioAnalyzer, shouldBypassDsp]);

    useEffect(() => () => {
        effectChainRef.current?.dispose();
        effectChainRef.current = null;
    }, []);

    useEffect(() => {
        const audioElement = audioRef.current;
        if (!audioElement) {
            previousAudioSrcRef.current = audioSrc;
            return;
        }

        if (audioSrc && previousAudioSrcRef.current && previousAudioSrcRef.current !== audioSrc) {
            if (!audioElement.paused && !audioElement.ended) {
                // Mark as programmatic pause before calling pause() on source switch so the queued
                // DOM 'pause' event is not misinterpreted by App.tsx's onPause handler as a user pause.
                markProgrammaticPause(audioElement);
                audioElement.pause();
            }
            audioElement.load();
        }

        previousAudioSrcRef.current = audioSrc;
    }, [audioRef, audioSrc]);

    useEffect(() => {
        if (audioSrc && audioRef.current) {
            if (useNativeExoPlayer) {
                bindAudioElementToNativeExoPlayer(audioRef.current, true);
                const autoPlayWanted = Boolean(shouldAutoPlayRef.current && !isAutoplayHeld && !suppressAutoplayRef.current);
                if (lastLoadedExoSrcRef.current !== audioSrc) {
                    lastLoadedExoSrcRef.current = audioSrc;
                    if (suppressAutoplayRef.current) {
                        suppressAutoplayRef.current = false;
                        shouldAutoPlayRef.current = false;
                        setPlayerState(PlayerState.PAUSED);
                    } else if (shouldAutoPlayRef.current) {
                        shouldAutoPlayRef.current = false;
                        setPlayerState(PlayerState.PLAYING);
                    }
                    void loadAndroidNativeTrack({
                        url: audioSrc,
                        trackId: currentSong ? String(currentSong.id) : '',
                        title: currentSong?.name || 'Folia',
                        artist: currentSong ? (getSongArtistLabel(currentSong) || '') : '',
                        album: currentSong ? (getSongAlbumLabel(currentSong) || '') : '',
                        artworkUrl: getCoverUrl(),
                        autoPlay: autoPlayWanted,
                        startPositionMs: 0,
                        volume: getTargetPlaybackVolume(),
                        playbackSpeed: 1.0,
                    });
                } else if (autoPlayWanted) {
                    shouldAutoPlayRef.current = false;
                    setPlayerState(PlayerState.PLAYING);
                    void audioRef.current.play();
                }
                return;
            }
            if (audioRef.current.getAttribute('src') !== audioSrc) return;
            if (audioRef.current.error) return;

            const isLocalSourceReady = Boolean(
                isLocalPlaybackSong(currentSong)
                || audioSrc.startsWith('blob:')
                || isAndroidSafStreamUrl(audioSrc)
            );

            // Local sources already have their playable URL and local lyrics resolved before audioSrc commits;
            // do not delay starting local audio playback while optional online lyric/cover matching runs in the background.
            if (shouldAutoPlayRef.current && (!isLyricsLoading || isLocalSourceReady)) {
                if (isAutoplayHeld) {
                    setPlayerState(PlayerState.PLAYING);
                    return;
                }

                shouldAutoPlayRef.current = false;

                if (suppressAutoplayRef.current) {
                    suppressAutoplayRef.current = false;
                    setPlayerState(PlayerState.PAUSED);
                    return;
                }

                if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
                    void audioContextRef.current.resume().catch(() => {});
                }
                syncOutputGain(getTargetPlaybackVolume(), 0);
                const playPromise = audioRef.current.play();
                if (playPromise !== undefined) {
                    playPromise
                        .then(() => {
                            setPlayerState(PlayerState.PLAYING);
                            setupAudioAnalyzer();
                        })
                        .catch(error => {
                            if (audioRef.current && !audioRef.current.paused && !audioRef.current.ended) {
                                setPlayerState(PlayerState.PLAYING);
                                setupAudioAnalyzer();
                                return;
                            }

                            if (error.name === 'AbortError') {
                                shouldAutoPlayRef.current = true;
                                return;
                            }

                            if (error.name === 'NotAllowedError') {
                                setStatusMsg({ type: 'info', text: t('status.clickToPlay') });
                                setPlayerState(PlayerState.PAUSED);
                            }
                        });
                }
            }
        }
    }, [audioContextRef, audioRef, audioSrc, currentSong, getCoverUrl, getTargetPlaybackVolume, isAutoplayHeld, isLyricsLoading, setPlayerState, setStatusMsg, setupAudioAnalyzer, shouldAutoPlayRef, suppressAutoplayRef, syncOutputGain, t, useNativeExoPlayer]);

    const adoptActiveDeckSource = useCallback((src: string) => {
        previousAudioSrcRef.current = src;
    }, []);

    return {
        setupAudioAnalyzer,
        cacheSongAssets,
        cacheSongAssetsFor,
        adoptActiveDeckSource,
    };
}
