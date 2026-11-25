// src/components/visualizer/filmgate/types.ts
// FILMGATE's tuning: its shape, its defaults and the clamp every stored, imported or dragged value goes through.

export interface FilmgateTuning {
    /** Analog grain amount, 0 = none. */
    grain: number;
    /** Light leaks and exposure sweeps, 0 = none. */
    lightLeaks: number;
    /** Mechanical gate movement and camera drift, 0 = still. */
    gateMotion: number;
    /** How hard bass kicks hit the frame, 0 = no impact. */
    impact: number;
    /** Active-word exposure and glow, 0 = flat lyrics. */
    illumination: number;
    /** Film-frame decorations (corner marks, guides, sprocket holes). */
    frame: boolean;
}

export const DEFAULT_FILMGATE_TUNING: FilmgateTuning = {
    grain: 1,
    lightLeaks: 1,
    gateMotion: 1,
    impact: 1,
    illumination: 1,
    frame: true,
};

const amount = (value: unknown, fallback: number) => (
    typeof value === 'number' && Number.isFinite(value) ? Math.min(2, Math.max(0, value)) : fallback
);

/** Any stored value into a complete, legal tuning: missing fields take the default, out-of-range values are clamped. */
export const normalizeFilmgateTuning = (raw: unknown): FilmgateTuning => {
    const input = raw && typeof raw === 'object' ? raw as Partial<FilmgateTuning> : {};
    const d = DEFAULT_FILMGATE_TUNING;
    return {
        grain: amount(input.grain, d.grain),
        lightLeaks: amount(input.lightLeaks, d.lightLeaks),
        gateMotion: amount(input.gateMotion, d.gateMotion),
        impact: amount(input.impact, d.impact),
        illumination: amount(input.illumination, d.illumination),
        frame: typeof input.frame === 'boolean' ? input.frame : d.frame,
    };
};
