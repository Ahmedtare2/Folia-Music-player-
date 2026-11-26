import React, { useEffect, useRef, useState } from 'react';
import { Clapperboard, Copy } from 'lucide-react';
import { usePlaybackStore } from '../../../../../stores/usePlaybackStore';
import { useDesktopExportContextStore } from '../../../../../stores/useDesktopExportContextStore';
import { useVisualizerSettingsStore } from '../../../../../stores/useVisualizerSettingsStore';
import { DEFAULT_METAPHOR_TUNING, type MetaphorTuning } from '../../../../visualizer/metaphor/types';
import { VISUALIZER_REGISTRY } from '../../../../visualizer/registry';
import { collectVisualizerTunings } from '../../../../visualizer/tuningRegistry';
import { EXPORT_ASPECTS, resolveExportSize, type ExportAspectId } from '../../../../../services/videoExport/exportFormats';
import { DOM_STYLES, runStyleCanvasExport } from '../../../../../services/videoExport/styleCanvasExport';
import {
    EXPORT_PRESETS,
    formatMetaphorExportReport,
    runMetaphorExport,
    type ExportPreset,
} from '../../../../../services/videoExport/metaphorOfflineExport';
import type { VideoChunkSink } from '../../../../../services/videoExport/videoEncoderSession';
import { createDesktopMp4Sink, isDesktopMp4ExportAvailable, type DesktopMp4Sink } from '../../../../../services/videoExport/desktopMp4Sink';

// src/components/modal/settings/pages/videoExport/DesktopOfflineVideoExportCard.tsx
// Desktop version of the phone's video export: renders the song that is loaded in the style you pick, frame by frame on an
// exact clock (a slow PC only takes longer, it never drops frames), and saves an MP4 with the song's sound where you choose.
// Same renderer as the Android app. Unlike the live recording in the remote window, nothing on screen is captured.

const TEST_CLIP_SECONDS = 10;

const formatDuration = (seconds: number) => {
    const total = Math.max(0, Math.round(seconds));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    return h > 0 ? `${h} h ${m} min` : m > 0 ? `${m} min ${total % 60} s` : `${total} s`;
};

const parseTime = (text: string): number | null => {
    const parts = text.trim().split(':');
    if (!text.trim() || parts.length > 3 || parts.some(part => !/^\d+(\.\d+)?$/.test(part))) return null;
    return parts.reduce((total, part) => total * 60 + Number(part), 0);
};

const formatClock = (seconds: number) => {
    const total = Math.max(0, Math.round(seconds));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = String(total % 60).padStart(2, '0');
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

export const DesktopOfflineVideoExportCard: React.FC = () => {
    const currentSong = usePlaybackStore(state => state.currentSong);
    const lyrics = usePlaybackStore(state => state.lyrics);
    const audioSrc = usePlaybackStore(state => state.audioSrc);
    const storeDuration = usePlaybackStore(state => state.duration);
    const theme = useDesktopExportContextStore(state => state.theme);

    const [presetId, setPresetId] = useState<ExportPreset['id']>('2k60');
    const exportableStyles = VISUALIZER_REGISTRY.filter(entry => !DOM_STYLES.includes(entry.mode));
    const storedMode = (useVisualizerSettingsStore.getState() as unknown as { visualizerMode?: string }).visualizerMode ?? 'metaphor';
    const [styleMode, setStyleMode] = useState<string>(exportableStyles.some(entry => entry.mode === storedMode) ? storedMode : 'metaphor');
    const [aspectId, setAspectId] = useState<ExportAspectId>('16:9');
    const [fromText, setFromText] = useState('');
    const [toText, setToText] = useState('');
    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState('');
    const [report, setReport] = useState('');
    const [copied, setCopied] = useState(false);
    const abortRef = useRef<AbortController | null>(null);
    const mounted = useRef(true);
    useEffect(() => () => { mounted.current = false; abortRef.current?.abort(); }, []);

    // The desktop MP4 writer takes H.264 only; the phone's HEVC 4K60 preset becomes H.264 here.
    const basePreset = EXPORT_PRESETS.find(entry => entry.id === presetId) ?? EXPORT_PRESETS[0];
    const preset: ExportPreset = { ...basePreset, family: 'avc', label: basePreset.label.replace(' (HEVC)', '') };
    const aspect = EXPORT_ASPECTS.find(entry => entry.id === aspectId) ?? EXPORT_ASPECTS[0];
    const size = resolveExportSize(preset, aspect);
    const styleLabel = exportableStyles.find(entry => entry.mode === styleMode)?.labelFallback ?? styleMode;
    const lines = lyrics?.lines ?? [];
    const lastLineEnd = lines.length ? Math.max(...lines.map(line => line.endTime || 0)) : 0;
    const songSec = Math.max(1, storeDuration > 0 ? storeDuration : (currentSong?.durationMs ? currentSong.durationMs / 1000 : lastLineEnd));
    const fromSec = fromText.trim() ? parseTime(fromText) : 0;
    const toSec = toText.trim() ? parseTime(toText) : songSec;
    const rangeError = fromSec === null || toSec === null
        ? 'Type times like 1:05 or 65.'
        : fromSec >= songSec ? `Start is past the end of the song (${formatClock(songSec)}).`
            : toSec - fromSec < 1 ? 'The section must be at least 1 second long.' : '';
    const sectionStart = rangeError ? 0 : Math.max(0, fromSec ?? 0);
    const sectionEnd = rangeError ? songSec : Math.min(songSec, toSec ?? songSec);
    const isWholeSong = sectionStart <= 0 && sectionEnd >= songSec - 0.01;
    const hasWriter = isDesktopMp4ExportAvailable();
    const ready = Boolean(currentSong && audioSrc && theme && lines.length > 0 && !rangeError);

    const run = async (mode: 'test' | 'export') => {
        if (!currentSong || !audioSrc || !theme) return;
        const controller = new AbortController();
        abortRef.current = controller;
        setRunning(true);
        setReport('');
        let sink: DesktopMp4Sink | null = null;
        let finished = false;
        try {
            let filePath: string | null = null;
            const safeTitle = (currentSong.name || 'song').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'song';
            const displayName = `${safeTitle} - ${styleLabel} ${aspect.id.replace(':', 'x')} ${size.width}x${size.height} ${preset.fps}fps.mp4`;
            if (mode === 'export') {
                if (!hasWriter || !window.electron) throw new Error('Saving video needs the Folia desktop app');
                const chosen = await window.electron.chooseVideoExportPath(displayName, 'mp4', 'MP4 Video');
                if (chosen.canceled || !chosen.filePath) { setReport('Cancelled. Nothing was saved.'); return; }
                filePath = chosen.filePath;
            }
            setProgress('Reading the song file...');
            const response = await fetch(audioSrc);
            if (!response.ok) throw new Error(`The song file could not be read (${response.status})`);
            const audioBytes = new Uint8Array(await response.arrayBuffer());
            controller.signal.throwIfAborted();

            const sectionLen = sectionEnd - sectionStart;
            const firstLine = lines[0]?.startTime ?? 0;
            const testStart = isWholeSong
                ? Math.max(0, Math.min(firstLine, Math.max(0, sectionEnd - TEST_CLIP_SECONDS)))
                : sectionStart;
            const startSec = mode === 'export' ? sectionStart : testStart;
            const clipSec = mode === 'export' ? sectionLen : Math.min(TEST_CLIP_SECONDS, sectionEnd - startSec);
            const tuning = ((useVisualizerSettingsStore.getState() as unknown as { metaphorTuning?: MetaphorTuning }).metaphorTuning)
                ?? DEFAULT_METAPHOR_TUNING;
            let chunks = 0;
            let activeSink: VideoChunkSink = { write: () => { chunks += 1; } };
            if (mode === 'export' && filePath) {
                setProgress('Preparing the sound track...');
                sink = await createDesktopMp4Sink({
                    width: size.width,
                    height: size.height,
                    fps: preset.fps,
                    filePath,
                    displayName: filePath.split(/[\\/]/).pop() || displayName,
                    audio: { bytes: audioBytes, startSec, durationSec: clipSec },
                    signal: controller.signal,
                });
                activeSink = sink;
            }
            const onProgress = (info: { frame: number; total: number; fps: number; etaSec: number | null; phase: string }) => {
                if (!mounted.current) return;
                setProgress(info.phase === 'Rendering'
                    ? `Rendering ${info.frame}/${info.total} frames, ${info.fps.toFixed(1)} fps${info.etaSec !== null ? `, about ${formatDuration(info.etaSec)} left` : ''}`
                    : `${info.phase}...`);
            };
            const common = {
                lines, theme, title: currentSong.name, audioBytes, preset, size, startSec, clipSec,
                sink: activeSink, signal: controller.signal, onProgress,
                avcFormat: (mode === 'export' ? 'avc' : 'annexb') as 'avc' | 'annexb',
            };
            let blankFrame = -1;
            const result = styleMode === 'metaphor'
                ? await runMetaphorExport({ ...common, tuning, seed: String(currentSong.id) })
                : await runStyleCanvasExport({
                    ...common,
                    mode: styleMode,
                    artist: currentSong.artists?.map(a => a.name).join(', ') ?? null,
                    tunings: collectVisualizerTunings(useVisualizerSettingsStore.getState() as unknown as Record<string, unknown>),
                }, frame => { blankFrame = frame; });
            finished = true;
            if (mounted.current) {
                const saved = sink?.result;
                setReport([
                    formatMetaphorExportReport(preset, size, result, styleLabel),
                    blankFrame >= 0 ? `Warning: this style drew nothing from frame ${blankFrame}, so the video may be blank. Try another style.` : '',
                    mode === 'export'
                        ? (saved ? `Saved: ${saved.filePath} (${(saved.bytes / 1_000_000).toFixed(1)} MB)` : 'Saved, but the file location was not reported')
                        : `Encoded chunks: ${chunks} (nothing saved, this was a test)`,
                    sink?.audioNote ?? '',
                ].filter(Boolean).join('\n'));
            }
        } catch (error) {
            const aborted = controller.signal.aborted;
            if (mounted.current) {
                setReport(aborted ? 'Cancelled. Nothing was saved.' : `${mode === 'export' ? 'Export' : 'Test'} failed: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`);
            }
        } finally {
            if (sink && !finished) await sink.abort();
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

    const buttonOn = 'border-white bg-white text-zinc-950';
    const buttonOff = 'border-white/10 text-zinc-300';
    return (
        <section data-testid="desktop-settings-offline-video-export-card" className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h3 className="text-sm font-bold">Video export (offline render)</h3>
                    <p className="text-xs opacity-70">
                        Renders the song that is loaded in the style you pick, frame by frame, with its sound, and saves an MP4 where you choose. The window does not need to stay on screen. Test first to see how long it will take.
                    </p>
                </div>
                <Clapperboard size={18} className="shrink-0 opacity-70" />
            </div>
            <label className="block text-[11px] opacity-80">
                Style
                <select
                    value={styleMode}
                    disabled={running}
                    onChange={event => setStyleMode(event.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-white/10 bg-zinc-900 px-2 text-xs text-white"
                >
                    {exportableStyles.map(entry => (
                        <option key={entry.mode} value={entry.mode}>{entry.labelFallback}</option>
                    ))}
                </select>
            </label>
            <div className="grid grid-cols-3 gap-2">
                {EXPORT_ASPECTS.map(entry => (
                    <button key={entry.id} type="button" disabled={running} onClick={() => setAspectId(entry.id)}
                        className={`h-11 rounded-xl border text-[11px] font-semibold ${entry.id === aspectId ? buttonOn : buttonOff}`}>
                        {entry.label}
                        <span className="block text-[9px] font-normal opacity-70">{entry.hint}</span>
                    </button>
                ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
                {EXPORT_PRESETS.map(entry => (
                    <button key={entry.id} type="button" disabled={running} onClick={() => setPresetId(entry.id)}
                        className={`h-9 rounded-xl border text-[11px] font-semibold ${entry.id === presetId ? buttonOn : buttonOff}`}>
                        {entry.label.replace(' (HEVC)', '')}
                    </button>
                ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
                <label className="block text-[11px] opacity-80">
                    From (empty = start)
                    <input value={fromText} disabled={running} inputMode="decimal" placeholder="0:00"
                        onChange={event => setFromText(event.target.value)}
                        className="mt-1 h-9 w-full rounded-xl border border-white/10 bg-zinc-900 px-2 text-xs text-white" />
                </label>
                <label className="block text-[11px] opacity-80">
                    To (empty = end{currentSong ? `, ${formatClock(songSec)}` : ''})
                    <input value={toText} disabled={running} inputMode="decimal" placeholder={formatClock(songSec)}
                        onChange={event => setToText(event.target.value)}
                        className="mt-1 h-9 w-full rounded-xl border border-white/10 bg-zinc-900 px-2 text-xs text-white" />
                </label>
            </div>
            {rangeError
                ? <p className="text-[11px] text-red-300">{rangeError}</p>
                : <p className="text-[11px] opacity-70">Section: {formatClock(sectionStart)} to {formatClock(sectionEnd)} ({formatDuration(sectionEnd - sectionStart)}). The sound is cut to the same section.</p>}
            <p className="text-[11px] opacity-70">Output: {size.width}x{size.height}, {preset.fps} fps, H.264 MP4. Styles drawn with page text (Cappella, Partita, Tilt, Window, Claddagh, Still, Diorama) are not offered here; use the live recording in the remote window for those.</p>
            {!hasWriter && <p className="text-[11px] text-red-300">This needs the Folia desktop app (Windows). The browser version cannot save video files.</p>}
            {!ready && (
                <p className="text-[11px] opacity-60">Play a song that has lyrics first. The export uses the song that is loaded.</p>
            )}
            <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={running || !ready} onClick={() => run('test')}
                    className="flex h-11 items-center justify-center rounded-2xl border border-white/20 text-xs font-semibold disabled:opacity-50">
                    Test 10 s (no file)
                </button>
                <button type="button" disabled={running || !ready || !hasWriter} onClick={() => run('export')}
                    className="flex h-11 items-center justify-center rounded-2xl bg-white text-xs font-semibold text-zinc-950 disabled:opacity-50">
                    Export and save...
                </button>
            </div>
            {running && <p className="text-xs opacity-90">{progress || 'Working...'}</p>}
            <p className="text-[11px] opacity-60">Keep the app open while it renders. Long songs at 4K can take a long time.</p>
            {running && (
                <button type="button" onClick={() => abortRef.current?.abort()}
                    className="flex h-9 w-full items-center justify-center rounded-2xl border border-white/10 text-xs opacity-90">
                    Cancel
                </button>
            )}
            {report && (
                <>
                    <pre className="whitespace-pre-wrap break-words rounded-2xl bg-black/30 p-3 text-[10px] leading-relaxed opacity-90">{report}</pre>
                    <button type="button" onClick={copy}
                        className="flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 text-xs font-semibold">
                        <Copy size={14} />
                        {copied ? 'Copied' : 'Copy report'}
                    </button>
                </>
            )}
        </section>
    );
};

export default DesktopOfflineVideoExportCard;
