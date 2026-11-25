// src/components/visualizer/astral/types.ts
// ASTRAL's tuning: its shape, its defaults and the clamp every stored, imported or dragged value goes through.

export type AstralQualityLevel = 'economy' | 'balanced' | 'high';
export const ASTRAL_QUALITY_LEVELS: readonly AstralQualityLevel[] = ['economy', 'balanced', 'high'];

export interface AstralTuning {
    /** How far the camera travels from the hero composition, 0 = it stays on the hero frame. */
    cameraMotion: number;
    /** Playback speed of camera shots. */
    cameraSpeed: number;
    /** How busy the orrery and the orbits are. */
    orbitalActivity: number;
    /** Fog, dust, stars and light shafts. */
    atmosphere: number;
    /** How strongly the hall answers the music, 0 = it ignores the audio. */
    audioReactivity: number;
    /** Active-word light and glow, 0 = flat lyrics. */
    lyricIllumination: number;
    /** Detail level of the hall. */
    quality: AstralQualityLevel;
}

export const DEFAULT_ASTRAL_TUNING: AstralTuning = {
    cameraMotion: 1,
    cameraSpeed: 1,
    orbitalActivity: 1,
    atmosphere: 1,
    audioReactivity: 1,
    lyricIllumination: 1,
    quality: 'balanced',
};

const amount = (value: unknown, fallback: number, max = 2) => (
    typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : fallback
);

/** Any stored value into a complete, legal tuning: missing fields take the default, out-of-range values are clamped. */
export const normalizeAstralTuning = (raw: unknown): AstralTuning => {
    const input = raw && typeof raw === 'object' ? raw as Partial<AstralTuning> : {};
    const d = DEFAULT_ASTRAL_TUNING;
    return {
        cameraMotion: amount(input.cameraMotion, d.cameraMotion),
        cameraSpeed: Math.max(0.25, amount(input.cameraSpeed, d.cameraSpeed)),
        orbitalActivity: amount(input.orbitalActivity, d.orbitalActivity),
        atmosphere: amount(input.atmosphere, d.atmosphere),
        audioReactivity: amount(input.audioReactivity, d.audioReactivity),
        lyricIllumination: amount(input.lyricIllumination, d.lyricIllumination),
        quality: ASTRAL_QUALITY_LEVELS.includes(input.quality as AstralQualityLevel) ? input.quality as AstralQualityLevel : d.quality,
    };
};
