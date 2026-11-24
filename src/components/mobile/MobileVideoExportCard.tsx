import React, { useEffect, useRef, useState } from 'react';
import { Clapperboard, Copy } from 'lucide-react';
import { createNativeMp4Sink, type NativeMp4Sink } from '../../services/videoExport/nativeMp4Sink';
import type { LocalSong, SongResult, Theme, LyricData } from '../../types';
import { readAndroidContentUriBytes } from '../../services/android/foliaAndroidBridge';
import { useVisualizerSettingsStore } from '../../stores/useVisualizerSettingsStore';
import type { VideoChunkSink } from '../../services/videoExport/videoEncoderSession';
import { DEFAULT_METAPHOR_TUNING, type MetaphorTuning } from '../visualizer/metaphor/types';
import {
    EXPORT_PRESETS,
    formatMetaphorExportReport,
    runMetaphorExport,
    type ExportPreset,
} from '../../services/videoExport/metaphorOfflineExport';

// src/components/mobile/MobileVideoExportCard.tsx
// Settings card for the video export (Metaphor first): renders the song that is loaded, frame by frame, encodes it and
// saves an MP4 (with the song's sound) to Movies/Folia. A 10 second test clip (nothing saved) measures the speed first.

type Props = {
    accentColor: string;
    song: LocalSong | null;
    currentSong: SongResult | null;
    lyrics: LyricData | null;
    theme: Theme;
};

const TEST_CLIP_SECONDS = 10;

const formatDuration = (seconds: number) => {
    const total = Math.max(0, Math.round(seconds));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    return h > 0 ? `${h} h ${m} min` : m > 0 ? `${m} min ${total % 60} s` : `${total} s`;
};

export const MobileVideoExportTestCard: React.FC<Props> = ({ accentColor, song, currentSong, lyrics, theme }) => {
    const [presetId, setPresetId] = useState<ExportPreset['id']>('2k60');
    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState('');
    const [report, setReport] = useState('');
    const [copied, setCopied] = useState(false);
    const abortRef = useRef<AbortController | null>(null);
    const mounted = useRef(true);
    useEffect(() => () => { mounted.current = false; abortRef.current?.abort(); }, []);

    const preset = EXPORT_PRESETS.find(entry => entry.id === presetId) ?? EXPORT_PRESETS[0];
    const lines = lyrics?.lines ?? [];
    const ready = Boolean(song?.safContentUri && currentSong && lines.length > 0);

    const run = async (mode: 'test' | 'export') => {
        if (!song?.safContentUri || !currentSong) return;
        const controller = new AbortController();
        abortRef.current = controller;
        setRunning(true);
        setReport('');
        let nativeSink: NativeMp4Sink | null = null;
        let finished = false;
        try {
            setProgress('Reading the song file...');
            const audioBytes = await readAndroidContentUriBytes(song.safContentUri, song.safTreeUri, song.mimeType);
            const durationSec = Math.max(1, (song.duration || currentSong.durationMs || 0) / 1000);
            const firstLine = lines[0]?.startTime ?? 0;
            const startSec = mode === 'export' ? 0 : Math.max(0, Math.min(firstLine, Math.max(0, durationSec - TEST_CLIP_SECONDS)));
            const clipSec = mode === 'export' ? durationSec : Math.min(TEST_CLIP_SECONDS, durationSec - startSec);
            const tuning = ((useVisualizerSettingsStore.getState() as unknown as { metaphorTuning?: MetaphorTuning }).metaphorTuning)
                ?? DEFAULT_METAPHOR_TUNING;
            let chunks = 0;
            let sink: VideoChunkSink = { write: () => { chunks += 1; } };
            if (mode === 'export') {
                setProgress('Preparing the sound track...');
                const safeTitle = (currentSong.name || 'song').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'song';
                nativeSink = await createNativeMp4Sink({
                    family: preset.family,
                    width: preset.width,
                    height: preset.height,
                    fps: preset.fps,
                    displayName: `${safeTitle} - Metaphor ${preset.width}x${preset.height} ${preset.fps}fps.mp4`,
                    audio: { contentUri: song.safContentUri, startSec: 0, durationSec },
                });
                sink = nativeSink;
            }
            const result = await runMetaphorExport({
                lines,
                theme,
                tuning,
                seed: String(currentSong.id),
                title: currentSong.name,
                audioBytes,
                preset,
                startSec,
                clipSec,
                sink,
                signal: controller.signal,
                onProgress: info => {
                    if (!mounted.current) return;
                    setProgress(info.phase === 'Rendering'
                        ? `Rendering ${info.frame}/${info.total} frames, ${info.fps.toFixed(1)} fps${info.etaSec !== null ? `, about ${formatDuration(info.etaSec)} left` : ''}`
                        : `${info.phase}...`);
                },
            });
            finished = true;
            if (mounted.current) {
                const saved = nativeSink?.result;
                setReport([
                    formatMetaphorExportReport(preset, result),
                    mode === 'export'
                        ? (saved ? `Saved: Movies/Folia/${saved.displayName} (${(saved.bytes / 1_000_000).toFixed(1)} MB)\n${saved.uri}` : 'Saved, but the file location was not reported')
                        : `Encoded chunks: ${chunks} (nothing saved, this was a test)`,
                    nativeSink?.audioNote ?? '',
                ].filter(Boolean).join('\n'));
            }
        } catch (error) {
            const aborted = controller.signal.aborted;
            if (mounted.current) {
                setReport(aborted ? 'Cancelled. Nothing was saved.' : `${mode === 'export' ? 'Export' : 'Test'} failed: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`);
            }
        } finally {
            if (nativeSink && !finished) await nativeSink.abort();
            abortRef.current = null;
            if (mounted.current) setRunning(false);
        }
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(report);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    };

    return (
        <section
            data-testid="mobile-settings-video-export-test-card"
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 space-y-3"
        >
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h3 className="text-sm font-bold text-white">Metaphor video export</h3>
                    <p className="text-xs text-zinc-400">
                        Renders the song that is loaded in the Metaphor style, frame by frame, with its sound, and saves an MP4 to Movies/Folia. Test first to see how long it will take.
                    </p>
                </div>
                <Clapperboard size={18} className="shrink-0" style={{ color: accentColor }} />
            </div>
            <div className="grid grid-cols-3 gap-2">
                {EXPORT_PRESETS.map(entry => (
                    <button
                        key={entry.id}
                        type="button"
                        disabled={running}
                        onClick={() => setPresetId(entry.id)}
                        className={`h-9 rounded-xl border text-[11px] font-semibold active:scale-95 ${entry.id === presetId ? 'border-white bg-white text-zinc-950' : 'border-white/10 text-zinc-300'}`}
                    >
                        {entry.label}
                    </button>
                ))}
            </div>
            {!ready && (
                <p className="text-[11px] text-zinc-500">
                    Play a song from your library that has lyrics first. The test uses the song that is loaded.
                </p>
            )}
            <div className="grid grid-cols-2 gap-2">
                <button
                    type="button"
                    disabled={running || !ready}
                    onClick={() => run('test')}
                    className="flex h-11 items-center justify-center rounded-2xl border border-white/20 text-xs font-semibold text-white active:scale-95 disabled:opacity-60"
                >
                    Test 10 s (no file)
                </button>
                <button
                    type="button"
                    disabled={running || !ready}
                    onClick={() => run('export')}
                    className="flex h-11 items-center justify-center rounded-2xl bg-white text-xs font-semibold text-zinc-950 active:scale-95 disabled:opacity-60"
                >
                    Export full song
                </button>
            </div>
            {running && <p className="text-xs text-zinc-300">{progress || 'Working...'}</p>}
            <p className="text-[11px] text-zinc-500">
                Keep the app open and the phone plugged in while it renders. Long songs at 2K or 4K can take a long time.
            </p>
            {running && (
                <button
                    type="button"
                    onClick={() => abortRef.current?.abort()}
                    className="flex h-9 w-full items-center justify-center rounded-2xl border border-white/10 text-xs text-zinc-300 active:scale-95"
                >
                    Cancel
                </button>
            )}
            {report && (
                <>
                    <pre className="whitespace-pre-wrap break-words rounded-2xl bg-black/30 p-3 text-[10px] leading-relaxed text-zinc-300">{report}</pre>
                    <button
                        type="button"
                        onClick={copy}
                        className="flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 text-xs font-semibold text-zinc-200 active:scale-95"
                    >
                        <Copy size={14} />
                        {copied ? 'Copied' : 'Copy report'}
                    </button>
                </>
            )}
        </section>
    );
};
