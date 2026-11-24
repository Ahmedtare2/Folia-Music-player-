import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Clapperboard, Copy, Gauge, Timer, Trash2 } from 'lucide-react';
import { useVisualizerSettingsStore } from '../../stores/useVisualizerSettingsStore';
import { runDevicePerformanceTest, type PerformanceTestResult } from '../../utils/devicePerformanceTest';
import { runVideoExportProbe } from '../../utils/videoExportProbe';
import {
    clearSkipTimings,
    formatSkipTimingReport,
    getSkipTimingRuns,
    subscribeSkipTimings,
} from '../../utils/skipTimings';

// src/components/mobile/MobileLibraryExtras.tsx
// Three small mobile pieces: the A-Z letter rail beside the song list, the performance self-test card and the
// track-change timing log card (both live in Settings).

type LetterRailProps = {
    letters: readonly string[];
    accentColor: string;
    onSelect: (letter: string) => void;
};

/** Vertical A-Z (then Arabic, then #) index. Tap or drag along it to jump; only letters that exist are listed. */
export const MobileLetterRail: React.FC<LetterRailProps> = ({ letters, accentColor, onSelect }) => {
    const railRef = useRef<HTMLDivElement>(null);
    const [activeLetter, setActiveLetter] = useState<string | null>(null);
    const lastSent = useRef<string | null>(null);

    if (letters.length === 0) return null;

    const pick = (clientY: number) => {
        const el = railRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.height <= 0) return;
        const ratio = Math.min(0.999, Math.max(0, (clientY - rect.top) / rect.height));
        const letter = letters[Math.floor(ratio * letters.length)];
        if (!letter) return;
        setActiveLetter(letter);
        if (lastSent.current !== letter) {
            lastSent.current = letter;
            onSelect(letter);
        }
    };

    const end = () => {
        lastSent.current = null;
        setActiveLetter(null);
    };

    return (
        <>
            {activeLetter && (
                <div
                    className="pointer-events-none absolute right-10 top-1/2 z-20 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-2xl bg-black/80 text-2xl font-bold text-white shadow-lg"
                    style={{ border: `1px solid ${accentColor}` }}
                    aria-hidden="true"
                >
                    {activeLetter}
                </div>
            )}
            <div
                ref={railRef}
                data-testid="mobile-letter-rail"
                role="listbox"
                aria-label="Jump to letter"
                className="absolute bottom-2 right-0 top-2 z-10 flex w-6 select-none flex-col items-center justify-between rounded-full py-1"
                style={{ touchAction: 'none' }}
                onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                    pick(event.clientY);
                }}
                onPointerMove={(event) => {
                    if (event.buttons > 0 || event.pointerType === 'touch') pick(event.clientY);
                }}
                onPointerUp={end}
                onPointerCancel={end}
            >
                {letters.map(letter => (
                    <span
                        key={letter}
                        role="option"
                        aria-selected={activeLetter === letter}
                        className="flex-1 text-center text-[9px] font-semibold leading-none text-zinc-400"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            color: activeLetter === letter ? accentColor : undefined,
                        }}
                    >
                        {letter}
                    </span>
                ))}
            </div>
        </>
    );
};

type CardProps = { accentColor: string };

/** Runs the lyric-render self-test and offers to apply its recommendation to the global render quality settings. */
export const MobilePerformanceCard: React.FC<CardProps> = ({ accentColor }) => {
    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState('');
    const [result, setResult] = useState<PerformanceTestResult | null>(null);
    const [applied, setApplied] = useState(false);
    const mounted = useRef(true);
    useEffect(() => () => { mounted.current = false; }, []);

    const run = async () => {
        setRunning(true);
        setApplied(false);
        setResult(null);
        try {
            const next = await runDevicePerformanceTest(text => { if (mounted.current) setProgress(text); });
            if (mounted.current) setResult(next);
        } catch (error) {
            if (mounted.current) setProgress(`Test failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            if (mounted.current) setRunning(false);
        }
    };

    const apply = () => {
        if (!result) return;
        const store = useVisualizerSettingsStore.getState();
        store.handleSetLyricRenderQuality({ scale: result.scale, antialias: result.antialias });
        store.handleSetVisualizerFrameRate(result.frameRate);
        setApplied(true);
    };

    return (
        <section
            data-testid="mobile-settings-performance-card"
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 space-y-3"
        >
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h3 className="text-sm font-bold text-white">Performance self-test</h3>
                    <p className="text-xs text-zinc-400">
                        Tests lyric drawing on this phone for a few seconds and suggests a resolution, antialiasing and frame cap.
                    </p>
                </div>
                <Gauge size={18} className="shrink-0" style={{ color: accentColor }} />
            </div>
            <button
                type="button"
                disabled={running}
                onClick={run}
                className="flex h-11 w-full items-center justify-center rounded-2xl bg-white text-xs font-semibold text-zinc-950 active:scale-95 disabled:opacity-60"
            >
                {running ? progress || 'Testing...' : result ? 'Run again' : 'Run test'}
            </button>
            {!running && !result && progress && <p className="text-xs text-zinc-400">{progress}</p>}
            {result && (
                <div className="space-y-2.5">
                    <p className="text-xs leading-relaxed text-zinc-200">{result.summary}</p>
                    <p className="text-[11px] text-zinc-500">
                        {result.steps.map(step => `${step.scale}x: ${step.fps} fps ${step.passed ? 'ok' : 'too slow'}`).join(' · ')}
                    </p>
                    <button
                        type="button"
                        onClick={apply}
                        disabled={applied}
                        className="flex h-10 w-full items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] text-xs font-semibold text-white active:scale-95 disabled:opacity-60"
                    >
                        {applied ? 'Applied' : 'Apply these settings'}
                    </button>
                </div>
            )}
        </section>
    );
};

/** The last track changes with milliseconds per stage, copyable for diagnosis. */
export const MobilePlaybackTimingCard: React.FC<CardProps> = ({ accentColor }) => {
    const runs = useSyncExternalStore(subscribeSkipTimings, getSkipTimingRuns, getSkipTimingRuns);
    const [copied, setCopied] = useState(false);
    const recent = runs.slice(-6).reverse();
    const finished = runs.filter(run => run.totalMs !== null);
    const average = finished.length > 0
        ? Math.round(finished.reduce((sum, run) => sum + (run.totalMs ?? 0), 0) / finished.length)
        : null;

    const copy = async () => {
        const text = formatSkipTimingReport(runs);
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    };

    return (
        <section
            data-testid="mobile-settings-timing-card"
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 space-y-3"
        >
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h3 className="text-sm font-bold text-white">Track change timing</h3>
                    <p className="text-xs text-zinc-400">
                        {average === null
                            ? 'Skip a few songs, then copy this log to see which step is slow.'
                            : `Average time to sound: ${average} ms over ${finished.length} changes.`}
                    </p>
                </div>
                <Timer size={18} className="shrink-0" style={{ color: accentColor }} />
            </div>
            {recent.length > 0 && (
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-2xl bg-black/30 p-3 text-[10px] leading-snug text-zinc-300">
                    {formatSkipTimingReport(recent)}
                </pre>
            )}
            <div className="grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={copy}
                    className="flex h-10 items-center justify-center gap-1.5 rounded-2xl bg-white text-xs font-semibold text-zinc-950 active:scale-95"
                >
                    <Copy size={14} />
                    <span>{copied ? 'Copied' : 'Copy log'}</span>
                </button>
                <button
                    type="button"
                    onClick={clearSkipTimings}
                    className="flex h-10 items-center justify-center gap-1.5 rounded-2xl border border-white/15 bg-white/[0.06] text-xs font-semibold text-white active:scale-95"
                >
                    <Trash2 size={14} />
                    <span>Clear</span>
                </button>
            </div>
        </section>
    );
};

/** Stage 0 of the 4K video export: tests what this phone can encode and draw at 4K and shows a copyable report. */
export const MobileVideoExportCheckCard: React.FC<CardProps> = ({ accentColor }) => {
    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState('');
    const [report, setReport] = useState('');
    const [copied, setCopied] = useState(false);
    const mounted = useRef(true);
    useEffect(() => () => { mounted.current = false; }, []);

    const run = async () => {
        setRunning(true);
        setReport('');
        try {
            const text = await runVideoExportProbe(next => { if (mounted.current) setProgress(next); });
            if (mounted.current) setReport(text);
        } catch (error) {
            if (mounted.current) setReport(`Check failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
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
            data-testid="mobile-settings-video-export-check-card"
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 space-y-3"
        >
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h3 className="text-sm font-bold text-white">4K video export check</h3>
                    <p className="text-xs text-zinc-400">
                        Checks whether this phone can encode 4K video and how fast it draws 4K frames. Takes about 10 seconds. Changes nothing.
                    </p>
                </div>
                <Clapperboard size={18} className="shrink-0" style={{ color: accentColor }} />
            </div>
            <button
                type="button"
                disabled={running}
                onClick={run}
                className="flex h-11 w-full items-center justify-center rounded-2xl bg-white text-xs font-semibold text-zinc-950 active:scale-95 disabled:opacity-60"
            >
                {running ? progress || 'Checking...' : report ? 'Run again' : 'Run check'}
            </button>
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
