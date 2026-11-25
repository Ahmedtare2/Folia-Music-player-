import type { Line } from '../../../types';
import { isInterludeLine } from '../../../utils/lyrics/parserCore';
import { pickStation } from './astralStations';
import type { Shot, ShotKind } from './astralCameraPath';

// src/components/visualizer/astral/astralShotPlanner.ts
// One camera shot for every stretch of the song. The stretches are the lyric lines plus camera-only stretches that fill
// the gaps (intro, interludes, instrumental breaks, and a pure-music song), so the camera keeps travelling where nothing is
// sung and no fake lyric is ever invented. Shots follow the song's own section data when a line carries it and a fixed
// rotation when it does not; the song's seed makes the choice the same every time the song is played.

export type SectionKind = 'intro' | 'verse' | 'prechorus' | 'chorus' | 'bridge' | 'outro' | 'gap';

export interface Segment {
    index: number;
    start: number;
    end: number;
    /** Index into `lines`, or -1 for a camera-only stretch. */
    lineIndex: number;
    section: SectionKind;
    shot: Shot;
}

export const GAP_CHUNK_SECONDS = 8;
/** A silence shorter than this is not given its own camera segment: the previous line's shot just keeps running. */
export const MIN_GAP_SECONDS = 3.5;

const TABLES: Record<SectionKind, readonly ShotKind[]> = {
    verse: ['push', 'orbit', 'hold', 'crane', 'track', 'pan', 'push', 'orbit'],
    prechorus: ['crane', 'spiral', 'push', 'reveal', 'crane'],
    chorus: ['pull', 'flythrough', 'spiral', 'orbit', 'reveal', 'track', 'flythrough', 'pull'],
    bridge: ['spiral', 'crane', 'pan', 'flythrough', 'track', 'reveal'],
    outro: ['pull', 'hold', 'reveal', 'hold'],
    intro: ['reveal', 'hold', 'pull'],
    gap: ['reveal', 'orbit', 'pull', 'track', 'spiral', 'crane'],
};

/** 32-bit string hash, so a song's seed (an id or a title) gives the same plan on every run. */
export const hashSeed = (seed: string | number | undefined): number => {
    const text = String(seed ?? 'astral');
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
};

const mix = (a: number, b: number) => {
    let h = (a ^ Math.imul(b + 0x9e3779b9, 0x85ebca6b)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
    return (h ^ (h >>> 15)) >>> 0;
};

export const sectionOf = (line: Line | undefined, index: number, total: number): SectionKind => {
    if (!line) return 'gap';
    const part = (line.songPart ?? '').toLowerCase();
    if (line.isChorus || part.includes('chorus') && !part.includes('pre')) return 'chorus';
    if (part.includes('pre')) return 'prechorus';
    if (part.includes('bridge')) return 'bridge';
    if (part.includes('outro')) return 'outro';
    if (part.includes('intro')) return 'intro';
    if (total > 4 && index >= total - 2) return 'outro';
    return 'verse';
};

export interface PlanInput {
    lines: readonly Line[];
    seed: string | number | undefined;
}

interface Slot { start: number; end: number; lineIndex: number; section: SectionKind }

const buildSlots = (lines: readonly Line[]): Slot[] => {
    const slots: Slot[] = [];
    const total = lines.length;
    let cursor = 0;
    const fillGap = (from: number, to: number, section: SectionKind) => {
        if (to - from < MIN_GAP_SECONDS) return;
        let at = from;
        while (to - at > 0.01) {
            const end = to - at < GAP_CHUNK_SECONDS * 1.5 ? to : at + GAP_CHUNK_SECONDS;
            slots.push({ start: at, end, lineIndex: -1, section });
            at = end;
        }
    };
    lines.forEach((line, index) => {
        if (isInterludeLine(line)) return;
        if (!Number.isFinite(line.startTime) || !Number.isFinite(line.endTime)) return;
        fillGap(cursor, line.startTime, slots.length === 0 ? 'intro' : 'gap');
        const start = Math.max(cursor, line.startTime);
        const end = Math.max(start + 0.05, line.endTime);
        slots.push({ start, end, lineIndex: index, section: sectionOf(line, index, total) });
        cursor = end;
    });
    return slots;
};

/** Build the whole song's shot plan. The last slot is open-ended in practice: `segmentAt` extends past it with camera-only stretches. */
export const planSegments = ({ lines, seed }: PlanInput): Segment[] => {
    const base = hashSeed(seed);
    const slots = buildSlots(lines);
    const segments: Segment[] = [];
    let previous: ShotKind | null = null;
    let before: ShotKind | null = null;
    let chorusRun = 0;
    const recentStations: string[] = [];
    slots.forEach((slot, i) => {
        const table = TABLES[slot.section];
        const h = mix(base, i * 7919 + slot.lineIndex);
        const duration = slot.end - slot.start;
        if (slot.section === 'chorus') chorusRun = segments[i - 1]?.section === 'chorus' ? chorusRun + 1 : 0;
        else chorusRun = 0;
        let kind: ShotKind;
        if (i === 0 && slot.section !== 'gap') {
            kind = 'hold';
        } else if (slot.section === 'chorus' && chorusRun === 0 && duration >= 5.5 && i > 0) {
            kind = 'gate';
        } else {
            let pick = table[h % table.length]!;
            for (let tries = 0; tries < table.length && (pick === previous || pick === before || (pick === 'gate' && duration < 6)); tries += 1) {
                pick = table[(h + tries + 1) % table.length]!;
            }
            kind = pick;
        }
        // Very short lines cannot carry a long flight: they get a gentle move.
        if (duration < 2 && (kind === 'flythrough' || kind === 'spiral' || kind === 'gate')) kind = 'push';
        const side: 1 | -1 = (h >>> 5) % 2 === 0 ? 1 : -1;
        const variation = ((h >>> 9) % 1000) / 1000;
        let station: string | undefined;
        if (kind !== 'gate' && !(i === 0 && slot.section !== 'gap')) {
            // Every other stretch visits a figure of the hall; a chorus line starting a new chorus returns home.
            station = pickStation(h >>> 3, recentStations.slice(-3), slot.section === 'chorus' && chorusRun === 0 && i > 0);
            kind = 'station';
            recentStations.push(station);
        }
        const shot: Shot = station ? { kind, side, variation, station } : { kind, side, variation };
        segments.push({ index: i, start: slot.start, end: slot.end, lineIndex: slot.lineIndex, section: slot.section, shot });
        before = previous;
        previous = kind;
    });
    return segments;
};

/** The camera-only stretch k of a song with nothing left to sing (or no lyrics at all). */
export const virtualSegment = (seed: string | number | undefined, k: number, startAt = 0, salt = 0): Segment => {
    const h = mix(hashSeed(seed), 90000 + k + salt * 131);
    const table = TABLES.gap;
    const kind = k === 0 && salt === 0 ? 'reveal' : table[h % table.length]!;
    const prev = k > 0 ? table[mix(hashSeed(seed), 90000 + k - 1 + salt * 131) % table.length]! : null;
    const pick = kind === prev ? table[(h + 1) % table.length]! : kind;
    return {
        index: 100000 + salt * 1000 + k, start: startAt + k * GAP_CHUNK_SECONDS, end: startAt + (k + 1) * GAP_CHUNK_SECONDS, lineIndex: -1, section: 'gap',
        shot: { kind: pick, side: (h >>> 5) % 2 === 0 ? 1 : -1, variation: ((h >>> 9) % 1000) / 1000 },
    };
};

/** The segment playing at time t. Before the first or past the last stretch, camera-only stretches continue the journey. */
export const segmentAt = (segments: readonly Segment[], seed: string | number | undefined, t: number): Segment => {
    const last = segments[segments.length - 1];
    if (!last) return virtualSegment(seed, Math.max(0, Math.floor(t / GAP_CHUNK_SECONDS)));
    if (t >= last.end) {
        const k = Math.floor((t - last.end) / GAP_CHUNK_SECONDS);
        return virtualSegment(seed, k, last.end, last.index + 1);
    }
    let lo = 0;
    let hi = segments.length - 1;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (segments[mid]!.start <= t) lo = mid; else hi = mid - 1;
    }
    const found = segments[lo]!;
    if (t < found.start) return found;
    // Between the end of a line and the next (a short silence), the line's own shot simply keeps running.
    return found;
};
