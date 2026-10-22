import { useCallback, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { findLatestActiveLineIndex } from '../../../../utils/appPlaybackHelpers';
import { PlayerState } from '../../../../types';
import { setCurrentLineIndex, setHandoffLineIndex, setPlayerState } from '../../../../stores/usePlaybackStore';
import { selectDisplayLyrics, usePlaybackStore } from '../../../../stores/usePlaybackStore';
import {
    audioBands,
    audioPower,
    currentTime,
    handoffLyricCurrentTime,
    handoffProgress,
    lyricCurrentTime,
} from '../../../../stores/motionSignals';
import { getTransitionHandoffProgress } from '../../../../services/automix/transitionCue';
import { tickBeatFx } from '../../../../services/beatFx/beatFxLive';
import { useBeatFxTrack } from '../../../../hooks/useBeatFxTrack';
import { NATIVE_VISIBILITY_EVENT } from '../../../../hooks/useDocumentVisibility';
import { isAppForegroundVisible, subscribeAppForegroundVisibility } from '../../../../utils/visualizerVisibilityGate';
import { readIncomingLyricClock } from './incomingLyricClock';
import {
    getCurrentDisplayRefreshRateHz,
    getInterpolatedAndroidPlaybackPositionSec,
    hasAndroidNativeVisualizerBridge,
    isAndroidNativeExoPlayerActive,
    setAndroidNativeVisualizerEnergy,
} from '../../../../services/android/foliaAndroidBridge';

// src/components/app/playback/bridges/usePlaybackVisualizerBridge.ts

type UsePlaybackVisualizerBridgeParams = {

    audioRef: MutableRefObject<HTMLAudioElement | null>;
    analyserRef: MutableRefObject<AnalyserNode | null>;
    animationFrameRef: MutableRefObject<number>;
    effectiveLoopMode: 'off' | 'all' | 'one';
    isNowPlayingStageActive: boolean;
    isPlayerCapStageActive: boolean;
    stageActiveEntryKind: string | null;
    stageLyricsSession: unknown;
    stageLyricsClockRef: MutableRefObject<{
        startTimeSec: number;
        endTimeSec: number;
        baseTimeSec: number;
        startedAtMs: number | null;
    }>;
    getSyntheticStageLyricsTime: () => number;
    syncStageLyricsClock: (timeSec: number, endTimeSec: number, nextPlayerState: PlayerState, startTimeSec?: number) => void;
    getNowPlayingDisplayTime: () => number;
    getPlayerCapDisplayTime: () => number;
    syncNowPlayingClock: (progressSec: number, durationSec: number, paused: boolean) => void;
    lyricTimelineOffsetMs: number;
    /**
     * The incoming track's own lyric offset during a blend (`lyricTimelineOffsetMs` is the displayed
     * track's): its clock is read against it, so it runs on unchanged when the settle makes it the
     * displayed track's. Left out, the displayed track's.
     */
    incomingLyricTimelineOffsetMs?: number;
    /** True while an automix handover is in progress and a deck other than the active one sounds. */
    isTransitionAudible: () => boolean;
    /**
     * The deck the on-screen track is playing on while a transition holds the picture, else null.
     *
     * The clock below has to follow whatever is on screen. From the moment a blend arms, the
     * active deck is seconds into the NEXT track while the title, cover and lyrics still belong to
     * the one finishing - so reading the active deck here puts the progress bar and the lyric
     * read-head near zero under a song that is three minutes in.
     */
    getDisplayElement?: () => HTMLAudioElement | null;
};

// Runs the requestAnimationFrame loop for audio-reactive visuals and lyric timing.
export function usePlaybackVisualizerBridge({
    audioRef,
    analyserRef,
    animationFrameRef,
    effectiveLoopMode,
    isNowPlayingStageActive,
    isPlayerCapStageActive,
    stageActiveEntryKind,
    stageLyricsSession,
    stageLyricsClockRef,
    getSyntheticStageLyricsTime,
    syncStageLyricsClock,
    getNowPlayingDisplayTime,
    getPlayerCapDisplayTime,
    syncNowPlayingClock,
    lyricTimelineOffsetMs,
    incomingLyricTimelineOffsetMs = lyricTimelineOffsetMs,
    isTransitionAudible,
    getDisplayElement,
}: UsePlaybackVisualizerBridgeParams) {
    // Read here rather than passed in: store fields and the module-level motion signals.
    const activePlaybackContext = usePlaybackStore(state => state.activePlaybackContext);
    const playerState = usePlaybackStore(state => state.playerState);
    const duration = usePlaybackStore(state => state.duration);
    // The lyrics on screen, matching the deck getDisplayElement points at.
    const lyrics = usePlaybackStore(selectDisplayLyrics);
    // The live lyrics, which during a blend are the incoming track's (null until they load).
    const incomingLyrics = usePlaybackStore(state => state.lyrics);

    const currentLineIndexRef = useRef(-1);
    const lyricsRef = useRef(lyrics);
    lyricsRef.current = lyrics;
    // Reuse a single typed array for FFT frequency reads instead of allocating on every frame.
    const fftBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
    const lastNativeEnergySyncMsRef = useRef<number>(0);
    const lastNativePlayingStateRef = useRef<boolean>(false);
    // High-resolution VSync clock anchor for frame-rate-independent audio time interpolation
    // across 60Hz, 90Hz, and 120Hz displays.
    const audioClockAnchorRef = useRef<{
        element: HTMLAudioElement | null;
        rawMediaTimeSec: number;
        anchorPerfNowMs: number;
    }>({
        element: null,
        rawMediaTimeSec: -1,
        anchorPerfNowMs: 0,
    });
    const emptySpectrumRef = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(new ArrayBuffer(0)));
    // 智能动感模式: loads the track's beats while it is on; the clock is stepped below. A ref, so
    // switching it does not rebuild the frame loop.
    const beatFxWantedRef = useRef(false);
    beatFxWantedRef.current = useBeatFxTrack();
    const handoffLineIndexRef = useRef(-1);
    // The lyric offsets as the loop reads them. The settle moves the displayed one onto the incoming
    // track's as it copies that track's clock: the prop catches up a render later, and a frame read in
    // between against the outgoing track's offset would move the line by the difference.
    const displayOffsetMsRef = useRef(lyricTimelineOffsetMs);
    const incomingOffsetMsRef = useRef(incomingLyricTimelineOffsetMs);
    useEffect(() => {
        displayOffsetMsRef.current = lyricTimelineOffsetMs;
    }, [lyricTimelineOffsetMs]);
    useEffect(() => {
        incomingOffsetMsRef.current = incomingLyricTimelineOffsetMs;
    }, [incomingLyricTimelineOffsetMs]);

    const applyLyricClockAtTime = useCallback((rawTimeSec: number) => {
        const effectiveLyricTime = rawTimeSec - displayOffsetMsRef.current / 1000;
        if (lyricCurrentTime.get() !== effectiveLyricTime) {
            lyricCurrentTime.set(effectiveLyricTime);
        }
        const activeLyrics = lyricsRef.current;
        const foundIndex = activeLyrics ? findLatestActiveLineIndex(activeLyrics.lines, effectiveLyricTime) : -1;
        if (
            foundIndex !== currentLineIndexRef.current
            || foundIndex !== usePlaybackStore.getState().currentLineIndex
        ) {
            currentLineIndexRef.current = foundIndex;
            setCurrentLineIndex(foundIndex);
        }
    }, []);

    // Keep currentLineIndexRef and lyricCurrentTime immediately synchronized whenever:
    // - lyrics change (new track loaded, lyric source switched, or async match finished)
    // - lyricTimelineOffsetMs changes (even while paused)
    useEffect(() => {
        const audioElement = getDisplayElement?.() ?? audioRef.current;
        const baseTime = audioElement && Number.isFinite(audioElement.currentTime) && audioElement.currentTime > 0
            ? audioElement.currentTime
            : currentTime.get();
        applyLyricClockAtTime(baseTime);
    }, [applyLyricClockAtTime, audioRef, getDisplayElement, lyricTimelineOffsetMs, lyrics]);

    // Resynchronize lyricCurrentTime and currentLineIndex immediately whenever currentTime is set
    // (including seeks while paused, track resets to 0, or metadata resume).
    useEffect(() => currentTime.on('change', (latestTimeSec: number) => {
        applyLyricClockAtTime(latestTimeSec);
    }), [applyLyricClockAtTime]);

    // The ends of a blend, written as the store changes rather than on the next frame: the visualizer
    // renders from that same change, and a frame late it would draw the incoming track's lyrics from
    // the outgoing track's clock and line (or the last blend's finished hand-off at the next one's start).
    useEffect(() => usePlaybackStore.subscribe((state, previous) => {
        if (state.currentLineIndex !== previous.currentLineIndex) {
            currentLineIndexRef.current = state.currentLineIndex;
        }
        if (state.transitionDisplay === previous.transitionDisplay) return;
        if (previous.transitionDisplay === null) {
            handoffProgress.set(0);
            handoffLineIndexRef.current = -1;
            setHandoffLineIndex(-1);
            return;
        }
        if (state.transitionDisplay !== null) return;
        // Handed over: the picture is now the incoming track, and its clock runs on from its own deck.
        const incoming = audioRef.current;
        if (state.transitionEnd !== 'handedOver' || !incoming) return;
        const clock = readIncomingLyricClock(incoming.currentTime, incomingOffsetMsRef.current, state.lyrics?.lines);
        displayOffsetMsRef.current = incomingOffsetMsRef.current;
        currentTime.set(incoming.currentTime);
        lyricCurrentTime.set(clock.lyricTimeSec);
        currentLineIndexRef.current = clock.lineIndex;
        setCurrentLineIndex(clock.lineIndex);
    }), [audioRef]);

    const updateLoop = useCallback((rafTimestampMs?: number) => {
        // Strict Screen-Off & Background Freeze: never run FFT or lyric rAF updates
        // when the phone screen is turned off or the document is hidden.
        if (!isAppForegroundVisible()) {
            animationFrameRef.current = 0;
            return;
        }
        const frameNowMs = typeof rafTimestampMs === 'number' && Number.isFinite(rafTimestampMs) && rafTimestampMs > 0
            ? rafTimestampMs
            : (typeof performance !== 'undefined' ? performance.now() : Date.now());

        // Normally the active deck; the outgoing one for as long as a blend holds the picture on
        // the track it is finishing, so that clock and picture never describe different songs.
        const audioElement = getDisplayElement?.() ?? audioRef.current;
        const nativeExoClock = isAndroidNativeExoPlayerActive()
            ? getInterpolatedAndroidPlaybackPositionSec(frameNowMs)
            : null;
        const isActuallyPlaying = nativeExoClock
            ? Boolean(nativeExoClock.isPlaying && !nativeExoClock.ended)
            : Boolean(audioElement && !audioElement.paused && !audioElement.ended);
        // Mid-handover a deck can be loading while the other one is still sounding. The analyser
        // is downstream of both, so it has real signal: dropping to the idle breath here would put
        // a visible stutter at exactly the moment meant to be seamless.
        const hasAudibleSignal = isActuallyPlaying || isTransitionAudible();

        if (hasAudibleSignal && analyserRef.current) {
            const bufferLength = analyserRef.current.frequencyBinCount;
            if (!fftBufferRef.current || fftBufferRef.current.length !== bufferLength) {
                fftBufferRef.current = new Uint8Array(new ArrayBuffer(bufferLength));
            }
            const dataArray = fftBufferRef.current;
            analyserRef.current.getByteFrequencyData(dataArray);
            audioBands.spectrum?.set(dataArray);

            const getEnergy = (minHz: number, maxHz: number): number => {
                const start = Math.floor(minHz / 21.5);
                const end = Math.floor(maxHz / 21.5);
                let sum = 0;
                for (let index = start; index <= end; index += 1) {
                    sum += dataArray[index];
                }
                const count = end - start + 1;
                return count > 0 ? sum / count : 0;
            };

            const bass = getEnergy(20, 150);
            const lowMid = getEnergy(150, 400);
            const mid = getEnergy(400, 1200);
            const vocal = getEnergy(1000, 3500);
            const treble = getEnergy(3500, 12000);

            const process = (value: number, boost = 2) => {
                const normalized = value / 255;
                return Math.pow(normalized, boost) * 255;
            };

            const procBass = process(bass, 1.8);
            const procLowMid = process(lowMid, 2);
            const procMid = process(mid, 2);
            const procVocal = process(vocal, 1.5);
            const procTreble = process(treble, 2);

            audioPower.set(process((bass + lowMid) / 2, 3));
            audioBands.bass.set(procBass);
            audioBands.lowMid.set(procLowMid);
            audioBands.mid.set(procMid);
            audioBands.vocal.set(procVocal);
            audioBands.treble.set(procTreble);

            if (hasAndroidNativeVisualizerBridge()) {
                const nowMs = frameNowMs;
                const minSyncIntervalMs = Math.max(30, Math.round(2000 / getCurrentDisplayRefreshRateHz()));
                if (!lastNativePlayingStateRef.current || nowMs - lastNativeEnergySyncMsRef.current >= minSyncIntervalMs) {
                    lastNativePlayingStateRef.current = true;
                    lastNativeEnergySyncMsRef.current = nowMs;
                    void setAndroidNativeVisualizerEnergy({
                        bass: Math.min(1, procBass / 255),
                        mid: Math.min(1, procMid / 255),
                        high: Math.min(1, procTreble / 255),
                        isPlaying: true,
                    });
                }
            }
        } else if (hasAudibleSignal) {
            // Hardware offload path (WebAudio DSP bypassed when Equalizer is disabled):
            // synthesize smooth rhythmic multi-band energy from playback clock for zero-CPU overhead.
            const tSec = audioElement ? audioElement.currentTime : Date.now() / 1000;
            const pulseBass = (Math.sin(tSec * 4.2) * 0.5 + 0.5) * 145 + 35;
            const pulseMid = (Math.sin(tSec * 2.7 + 1.1) * 0.5 + 0.5) * 115 + 25;
            const pulseHigh = (Math.cos(tSec * 5.3 + 2.4) * 0.5 + 0.5) * 95 + 20;
            audioPower.set(pulseBass * 0.75);
            audioBands.bass.set(pulseBass);
            audioBands.lowMid.set((pulseBass + pulseMid) * 0.5);
            audioBands.mid.set(pulseMid);
            audioBands.vocal.set(pulseMid * 0.9);
            audioBands.treble.set(pulseHigh);
            audioBands.spectrum?.set(emptySpectrumRef.current);

            if (hasAndroidNativeVisualizerBridge()) {
                const nowMs = frameNowMs;
                const minSyncIntervalMs = Math.max(30, Math.round(2000 / getCurrentDisplayRefreshRateHz()));
                if (!lastNativePlayingStateRef.current || nowMs - lastNativeEnergySyncMsRef.current >= minSyncIntervalMs) {
                    lastNativePlayingStateRef.current = true;
                    lastNativeEnergySyncMsRef.current = nowMs;
                    void setAndroidNativeVisualizerEnergy({
                        bass: Math.min(1, pulseBass / 255),
                        mid: Math.min(1, pulseMid / 255),
                        high: Math.min(1, pulseHigh / 255),
                        isPlaying: true,
                    });
                }
            }
        } else {
            const time = Date.now() / 2000;
            const breath = (Math.sin(time) + 1) * 20;
            audioPower.set(breath);
            audioBands.bass.set(breath);
            audioBands.lowMid.set(breath);
            audioBands.mid.set(breath);
            audioBands.vocal.set(breath);
            audioBands.treble.set(breath);
            audioBands.spectrum?.set(emptySpectrumRef.current);

            if (hasAndroidNativeVisualizerBridge() && lastNativePlayingStateRef.current) {
                lastNativePlayingStateRef.current = false;
                lastNativeEnergySyncMsRef.current = performance.now();
                void setAndroidNativeVisualizerEnergy({
                    bass: 0,
                    mid: 0,
                    high: 0,
                    isPlaying: false,
                });
            }
        }

        if (isActuallyPlaying && nativeExoClock) {
            // High-precision sub-millisecond interpolation from native AndroidX Media3 (ExoPlayer)
            // clock anchor (positionMs + (frameNowMs - clientPerfNowMs) * playbackSpeed) without polling the bridge.
            const smoothTime = nativeExoClock.positionSec;
            currentTime.set(smoothTime);
            applyLyricClockAtTime(smoothTime);
        } else if (isActuallyPlaying && audioElement) {
            const rawTime = audioElement.currentTime;
            const anchor = audioClockAnchorRef.current;
            const playbackRate = Number.isFinite(audioElement.playbackRate) && audioElement.playbackRate > 0
                ? audioElement.playbackRate
                : 1;
            let smoothTime = rawTime;
            if (
                anchor.element !== audioElement
                || Math.abs(rawTime - anchor.rawMediaTimeSec) > 0.0005
                || frameNowMs < anchor.anchorPerfNowMs
            ) {
                anchor.element = audioElement;
                anchor.rawMediaTimeSec = rawTime;
                anchor.anchorPerfNowMs = frameNowMs;
            } else {
                // Frame-rate-independent VSync interpolation between HTMLAudioElement timeupdate ticks:
                // advances smoothly by the exact elapsed frame delta whether display is 60Hz, 90Hz, or 120Hz.
                const elapsedSec = Math.max(0, (frameNowMs - anchor.anchorPerfNowMs) / 1000) * playbackRate;
                const maxLeadSec = 0.065 * playbackRate;
                const interpolated = anchor.rawMediaTimeSec + Math.min(elapsedSec, maxLeadSec);
                smoothTime = duration > 0 ? Math.min(duration, interpolated) : interpolated;
            }
            currentTime.set(smoothTime);
            applyLyricClockAtTime(smoothTime);
        } else if (isNowPlayingStageActive) {
            const nextTime = getNowPlayingDisplayTime();
            const hasReachedEnd = playerState === PlayerState.PLAYING && duration > 0 && nextTime >= duration;

            currentTime.set(nextTime);
            applyLyricClockAtTime(nextTime);

            if (hasReachedEnd) {
                if (effectiveLoopMode === 'one' || effectiveLoopMode === 'all') {
                    syncNowPlayingClock(0, duration, false);
                    currentTime.set(0);
                    applyLyricClockAtTime(0);
                } else {
                    syncNowPlayingClock(duration, duration, true);
                    setPlayerState(PlayerState.PAUSED);
                }
            }
        } else if (isPlayerCapStageActive) {
            // PlayerCap: clock extrapolated from progress×duration; a passive source, looping/ending is driven by the external player, so no end/loop handling here.
            const nextTime = getPlayerCapDisplayTime();
            currentTime.set(nextTime);
            applyLyricClockAtTime(nextTime);
        } else if (activePlaybackContext === 'stage' && stageActiveEntryKind === 'lyrics' && stageLyricsSession && lyrics) {
            const nextTime = getSyntheticStageLyricsTime();
            const clock = stageLyricsClockRef.current;
            const hasReachedEnd = playerState === PlayerState.PLAYING && nextTime >= clock.endTimeSec;

            currentTime.set(nextTime);

            const foundIndex = findLatestActiveLineIndex(lyrics.lines, nextTime);
            if (foundIndex !== currentLineIndexRef.current) {
                currentLineIndexRef.current = foundIndex;
                setCurrentLineIndex(foundIndex);
            }

            if (hasReachedEnd) {
                if (effectiveLoopMode === 'one' || effectiveLoopMode === 'all') {
                    syncStageLyricsClock(clock.startTimeSec, clock.endTimeSec, PlayerState.PLAYING, clock.startTimeSec);
                    currentTime.set(clock.startTimeSec);
                    const restartedLineIndex = findLatestActiveLineIndex(lyrics.lines, clock.startTimeSec);
                    if (restartedLineIndex !== currentLineIndexRef.current) {
                        currentLineIndexRef.current = restartedLineIndex;
                        setCurrentLineIndex(restartedLineIndex);
                    }
                } else {
                    syncStageLyricsClock(clock.endTimeSec, clock.endTimeSec, PlayerState.PAUSED, clock.startTimeSec);
                    setPlayerState(PlayerState.PAUSED);
                }
            }
        }

        if (beatFxWantedRef.current) {
            tickBeatFx(isActuallyPlaying ? audioElement : null, analyserRef.current?.context);
        }

        // While a blend holds the picture, the active deck is the incoming track: its hand-off, clock
        // and line for the visualizer, off this same frame rather than a second loop.
        const heldElement = getDisplayElement?.() ?? null;
        const incomingElement = heldElement ? audioRef.current : null;
        if (incomingElement && incomingElement !== heldElement) {
            handoffProgress.set(getTransitionHandoffProgress());
            const incomingClock = readIncomingLyricClock(incomingElement.currentTime, incomingOffsetMsRef.current, incomingLyrics?.lines);
            handoffLyricCurrentTime.set(incomingClock.lyricTimeSec);
            if (incomingClock.lineIndex !== handoffLineIndexRef.current) {
                handoffLineIndexRef.current = incomingClock.lineIndex;
                setHandoffLineIndex(incomingClock.lineIndex);
            }
        }

        animationFrameRef.current = requestAnimationFrame(updateLoop);
    }, [
        activePlaybackContext,
        analyserRef,
        animationFrameRef,
        applyLyricClockAtTime,
        audioRef,
        duration,
        effectiveLoopMode,
        getNowPlayingDisplayTime,
        getPlayerCapDisplayTime,
        getSyntheticStageLyricsTime,
        isNowPlayingStageActive,
        isPlayerCapStageActive,
        lyrics,
        incomingLyrics,
        playerState,
        stageActiveEntryKind,
        stageLyricsClockRef,
        stageLyricsSession,
        syncNowPlayingClock,
        syncStageLyricsClock,
        isTransitionAudible,
        getDisplayElement,
    ]);

    // Resynchronize playback position & active lyric immediately when returning from background or unlocking screen,
    // and strictly cancel the rAF loop the moment the screen turns off.
    useEffect(() => {
        if (typeof document === 'undefined' || typeof window === 'undefined') return undefined;
        const handleVisibilityChange = (visible: boolean) => {
            if (!visible) {
                if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                    animationFrameRef.current = 0;
                }
                return;
            }
            const audioElement = getDisplayElement?.() ?? audioRef.current;
            if (audioElement && Number.isFinite(audioElement.currentTime)) {
                currentTime.set(audioElement.currentTime);
                applyLyricClockAtTime(audioElement.currentTime);
            }
            if (!animationFrameRef.current) {
                animationFrameRef.current = requestAnimationFrame(updateLoop);
            }
        };
        const unsubscribe = subscribeAppForegroundVisibility(handleVisibilityChange);
        const handleRawNativeEvent = (event: Event) => {
            const custom = event as CustomEvent<{ visible?: boolean }> | undefined;
            if (typeof custom?.detail?.visible === 'boolean') {
                handleVisibilityChange(custom.detail.visible && document.visibilityState !== 'hidden');
            }
        };
        window.addEventListener(NATIVE_VISIBILITY_EVENT, handleRawNativeEvent);
        return () => {
            unsubscribe();
            window.removeEventListener(NATIVE_VISIBILITY_EVENT, handleRawNativeEvent);
        };
    }, [animationFrameRef, applyLyricClockAtTime, audioRef, getDisplayElement, updateLoop]);

    useEffect(() => {
        if (isAppForegroundVisible()) {
            animationFrameRef.current = requestAnimationFrame(updateLoop);
        }
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = 0;
            }
        };
    }, [animationFrameRef, updateLoop]);
}
