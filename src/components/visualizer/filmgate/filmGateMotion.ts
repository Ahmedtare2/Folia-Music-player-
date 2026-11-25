// src/components/visualizer/filmgate/filmGateMotion.ts
// FILMGATE's motion as pure functions of song time: how a word is lit, how a line enters and leaves like a shot change,
// and how the gate moves. Nothing here reads a clock or random numbers, so a paused or exported frame is exactly the
// frame the player showed.

export const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);
export const easeOut = (value: number) => 1 - (1 - clamp01(value)) ** 3;
export const easeInOut = (value: number) => {
    const x = clamp01(value);
    return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};

/** Brightness an upcoming word sits at, and the level a finished word settles to. */
export const WORD_UPCOMING = 0.2;
export const WORD_SETTLED = 0.58;
/** How long before its start a word begins to emerge, and how long a finished word takes to settle. */
export const WORD_LEAD = 0.3;
export const WORD_SETTLE = 1.5;
const MIN_ACTIVE = 0.14;

export interface WordLight {
    /** 0..1 brightness of the word. */
    exposure: number;
    /** 0..1 position of the warm light sweep across the word, in reading direction. */
    sweep: number;
    /** 0..1 glow around the edges. */
    glow: number;
    /** Rise of the word into place: 0 = fully risen. In em. */
    rise: number;
    /** 0.96..1 scale as the word settles. */
    scale: number;
}

export const wordLight = (time: number, start: number, end: number): WordLight => {
    const finish = Math.max(end, start + MIN_ACTIVE);
    const duration = finish - start;
    if (time < start - WORD_LEAD) return { exposure: WORD_UPCOMING, sweep: 0, glow: 0, rise: 0.06, scale: 0.97 };
    if (time < start) {
        const k = easeOut((time - (start - WORD_LEAD)) / WORD_LEAD);
        return { exposure: WORD_UPCOMING + (0.42 - WORD_UPCOMING) * k, sweep: 0, glow: 0, rise: 0.06 * (1 - k), scale: 0.97 + 0.02 * k };
    }
    if (time <= finish) {
        const p = (time - start) / duration;
        const settle = easeOut((time - start) / Math.min(0.35, duration));
        return {
            exposure: 0.42 + 0.58 * easeOut(Math.min(1, p * 1.6)),
            sweep: p,
            glow: 0.55 + 0.45 * Math.sin(Math.min(1, p) * Math.PI * 0.5),
            rise: 0,
            scale: 0.99 + 0.01 * settle,
        };
    }
    const after = time - finish;
    const k = easeInOut(after / WORD_SETTLE);
    return { exposure: 1 - (1 - WORD_SETTLED) * k, sweep: 1, glow: Math.max(0, 1 - after / 0.9) * 0.8, rise: 0, scale: 1 };
};

export type ShotKind = 'push' | 'pull' | 'advance' | 'focus' | 'leak' | 'dissolve';
const SHOT_KINDS: readonly ShotKind[] = ['push', 'dissolve', 'advance', 'focus', 'pull', 'leak'];

/** Deterministic shot for a line: the same line always gets the same cut, and neighbours differ. */
export const shotKindFor = (lineIndex: number): ShotKind => SHOT_KINDS[((lineIndex % SHOT_KINDS.length) + SHOT_KINDS.length) % SHOT_KINDS.length]!;

export const SHOT_IN = 0.45;
export const SHOT_OUT_HOLD = 0.5;
export const SHOT_OUT = 0.7;

export interface ShotFrame {
    visible: boolean;
    alpha: number;
    scale: number;
    /** Vertical offset as a fraction of the stage height. */
    dy: number;
    /** Optical defocus in CSS px at a 1000px stage. */
    blur: number;
    /** 0..1 light-leak flare tied to this cut. */
    leak: number;
}

/** A line's shot at `time`. The line is on screen from SHOT_IN before it starts until it has been out for SHOT_OUT. */
export const shotFrame = (time: number, lineStart: number, lineEnd: number, kind: ShotKind, nextCutAt?: number): ShotFrame => {
    const inStart = lineStart - SHOT_IN;
    // When the next line is already coming the old one leaves earlier and quicker, so two lines are never both full on screen.
    const outStart = nextCutAt === undefined ? lineEnd + SHOT_OUT_HOLD : Math.max(lineStart, Math.min(lineEnd + SHOT_OUT_HOLD, nextCutAt - 0.2));
    const outSpan = nextCutAt === undefined ? SHOT_OUT : Math.min(SHOT_OUT, Math.max(0.25, nextCutAt + 0.1 - outStart));
    if (time < inStart || time > outStart + outSpan) return { visible: false, alpha: 0, scale: 1, dy: 0, blur: 0, leak: 0 };
    const enter = easeInOut((time - inStart) / SHOT_IN);
    const exit = easeInOut((time - outStart) / outSpan);
    const span = Math.max(0.5, lineEnd - lineStart);
    const drift = clamp01((time - lineStart) / span);
    let alpha = enter * (1 - exit);
    let scale = 1;
    let dy = 0;
    let blur = 0;
    let leak = 0;
    switch (kind) {
        case 'push': scale = 0.965 + 0.035 * enter + 0.03 * drift + 0.03 * exit; break;
        case 'pull': scale = 1.05 - 0.05 * enter + 0.01 * drift - 0.02 * exit; break;
        case 'advance': dy = (1 - enter) * 0.045 - exit * 0.045; scale = 1 + 0.015 * drift; break;
        case 'focus': blur = (1 - enter) * 7 + exit * 4; scale = 1.01 + 0.015 * drift; break;
        case 'leak': scale = 0.985 + 0.015 * enter + 0.015 * drift; leak = Math.sin(Math.min(1, enter) * Math.PI) * (1 - exit); break;
        case 'dissolve': scale = 1 + 0.012 * drift; alpha = enter * (1 - exit) ** 1.4; break;
    }
    dy -= exit * 0.03;
    return { visible: alpha > 0.002, alpha, scale, dy, blur, leak };
};

export interface GateOffset {
    dx: number;
    dy: number;
    rotation: number;
    /** 1 = at rest, below 1 = the gate compressed by a kick. */
    squeeze: number;
}

/** The gate's slow mechanical wander plus the kick's impact, as fractions of the stage size. `motion` is gateMotion * reduced-motion factor. */
export const gateOffset = (clock: number, motion: number, kick: number, impact: number, lowMid: number): GateOffset => {
    const m = Math.max(0, motion);
    const amp = (0.0016 + 0.0016 * clamp01(lowMid)) * m;
    return {
        dx: amp * (Math.sin(clock * 0.61) + 0.5 * Math.sin(clock * 1.7 + 1.3)),
        dy: amp * (Math.sin(clock * 0.47 + 0.4) + 0.5 * Math.sin(clock * 2.1)) + 0.006 * clamp01(kick) * impact * (m > 0 ? 1 : 0.4),
        rotation: 0.0016 * m * Math.sin(clock * 0.37),
        squeeze: 1 - 0.012 * clamp01(kick) * impact,
    };
};
