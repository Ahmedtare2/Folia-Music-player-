// src/utils/skipTimings.ts
// Per-track-change timing log. Each time a local song starts (tap, next, previous, auto-advance) we record how many
// milliseconds each stage took, up to the moment the audio element actually fires "playing". The last runs are kept
// (memory + localStorage) and shown in Settings so a slow skip can be copied and sent for diagnosis.

export type SkipTimingMark = { stage: string; ms: number };
export type SkipTimingRun = { id: number; at: number; label: string; totalMs: number | null; marks: SkipTimingMark[] };

const STORAGE_KEY = 'folia_skip_timings_v1';
const MAX_RUNS = 40;

let runs: SkipTimingRun[] = [];
let snapshot: SkipTimingRun[] = [];
let active: { run: SkipTimingRun; t0: number } | null = null;
let nextId = 1;
let listening = false;
const listeners = new Set<() => void>();

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const load = () => {
    if (runs.length > 0 || typeof localStorage === 'undefined') return;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            runs = parsed.filter(item => item && typeof item === 'object').slice(-MAX_RUNS);
            nextId = runs.reduce((max, run) => Math.max(max, Number(run.id) || 0), 0) + 1;
        }
    } catch {
        runs = [];
    }
};

const save = () => {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(runs.slice(-MAX_RUNS)));
    } catch {
        // storage full or blocked: the in-memory log still works
    }
};

const emit = () => {
    snapshot = runs.slice();
    listeners.forEach(listener => listener());
};

const finish = (stage: string) => {
    if (!active) return;
    const { run, t0 } = active;
    const ms = Math.round(now() - t0);
    run.marks.push({ stage, ms });
    run.totalMs = ms;
    active = null;
    save();
    emit();
};

const installAudioListeners = () => {
    if (listening || typeof document === 'undefined') return;
    listening = true;
    // Media events do not bubble, but a capture listener on the document still sees them from any <audio>.
    document.addEventListener('loadedmetadata', event => {
        if (active && event.target instanceof HTMLMediaElement) markSkipTiming('audio loadedmetadata');
    }, true);
    document.addEventListener('playing', event => {
        if (active && event.target instanceof HTMLMediaElement) finish('audio playing (sound starts)');
    }, true);
};

/** Starts a new timing run, replacing any run still open (it never reached "playing"). */
export const beginSkipTiming = (label: string) => {
    try {
        load();
        installAudioListeners();
        if (active) {
            active.run.label += ' (never reached playing)';
            active = null;
        }
        const run: SkipTimingRun = { id: nextId++, at: Date.now(), label, totalMs: null, marks: [] };
        runs.push(run);
        if (runs.length > MAX_RUNS) runs = runs.slice(-MAX_RUNS);
        active = { run, t0: now() };
        emit();
    } catch {
        // timing must never break playback
    }
};

/** Starts a run only when none is open (a direct call that was not preceded by a skip). */
export const ensureSkipTiming = (label: string) => {
    if (!active) beginSkipTiming(label);
};

export const markSkipTiming = (stage: string) => {
    if (!active) return;
    active.run.marks.push({ stage, ms: Math.round(now() - active.t0) });
};

export const getSkipTimingRuns = (): SkipTimingRun[] => {
    if (snapshot.length === 0 && runs.length === 0) {
        load();
        if (runs.length > 0) snapshot = runs.slice();
    }
    return snapshot;
};

export const clearSkipTimings = () => {
    runs = [];
    active = null;
    save();
    emit();
};

export const subscribeSkipTimings = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
};

export const formatSkipTimingReport = (list: SkipTimingRun[] = getSkipTimingRuns()): string => {
    if (list.length === 0) return 'No track changes recorded yet.';
    return list.map(run => {
        const head = `#${run.id} ${new Date(run.at).toLocaleTimeString()} ${run.label} total=${run.totalMs === null ? 'n/a' : `${run.totalMs}ms`}`;
        const steps = run.marks.map(mark => `  ${mark.ms}ms ${mark.stage}`).join('\n');
        return steps ? `${head}\n${steps}` : head;
    }).join('\n');
};
