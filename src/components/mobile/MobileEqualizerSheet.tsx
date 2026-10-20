import React, { useEffect, useMemo, useState } from 'react';
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    RotateCcw,
    Sliders,
    Sparkles,
    X,
} from 'lucide-react';
import {
    AUDIO_EQUALIZER_BANDS,
    AUDIO_EQUALIZER_CUSTOM_SLOT_IDS,
    AUDIO_EQUALIZER_MAX_GAIN_DB,
    AUDIO_EQUALIZER_MIN_GAIN_DB,
    AUDIO_EQUALIZER_PRESET_LABELS,
    getAudioEqualizerCustomSlotIndex,
    isAudioEqualizerCustomSlotId,
    isAudioEqualizerFlat,
    resetAudioEqualizerToFlat,
    type AudioEqualizerCustomSlotId,
    type AudioEqualizerModeId,
    type AudioEqualizerSettings,
} from '../../utils/audioEqualizer';
import { AUDIO_SOUND_PRESETS, AUDIO_SOUND_PRESET_IDS } from '../../utils/audioPresets';
import {
    createNeutralAudioEffects,
    type AudioEffectId,
    type AudioEffectSettings,
} from '../../utils/audioEffects';
import {
    computeEqualizerFrequencyResponseDb,
    getAudioEqualizerRuntimeStatus,
    subscribeAudioEqualizerRuntime,
} from '../../services/audioEqualizerGraph';
import { useAudioSettingsStore } from '../../stores/useAudioSettingsStore';

// src/components/mobile/MobileEqualizerSheet.tsx
// Mobile-first 10-band Audio Equalizer & Effects panel connected directly to the live
// Web Audio BiquadFilterNode playback chain via useAudioSettingsStore.

interface MobileEqualizerSheetProps {
    accentColor: string;
    onClose: () => void;
    onOpenFullDesktopEqualizer?: () => void;
}

const ALL_PRESET_IDS: readonly AudioEqualizerModeId[] = [
    ...AUDIO_SOUND_PRESET_IDS,
    ...AUDIO_EQUALIZER_CUSTOM_SLOT_IDS,
];

const formatSignedDb = (val: number): string => {
    const rounded = Math.round(val * 10) / 10;
    if (rounded > 0) return `+${rounded} dB`;
    if (rounded < 0) return `${rounded} dB`;
    return '0 dB';
};

const formatFrequencyLabel = (hz: number): string => (
    hz >= 1000 ? `${hz / 1000} kHz` : `${hz} Hz`
);

export const MobileEqualizerSheet: React.FC<MobileEqualizerSheetProps> = ({
    accentColor,
    onClose,
    onOpenFullDesktopEqualizer,
}) => {
    const settings = useAudioSettingsStore(state => state.audioEqualizerSettings);
    const setSettings = useAudioSettingsStore(state => state.handleSetAudioEqualizerSettings);
    const applyPresetInStore = useAudioSettingsStore(state => state.handleApplyAudioSoundPreset);
    const [showEffects, setShowEffects] = useState(false);
    const [runtimeStatus, setRuntimeStatus] = useState(() => getAudioEqualizerRuntimeStatus());

    useEffect(() => {
        setRuntimeStatus(getAudioEqualizerRuntimeStatus());
        return subscribeAudioEqualizerRuntime(() => {
            setRuntimeStatus(getAudioEqualizerRuntimeStatus());
        });
    }, [settings]);

    const responseCurveDb = useMemo(
        () => computeEqualizerFrequencyResponseDb(settings, AUDIO_EQUALIZER_BANDS.map(b => b.frequency), runtimeStatus.sampleRate ?? 48_000),
        [runtimeStatus.sampleRate, settings],
    );

    const svgPath = useMemo(() => {
        const points = AUDIO_EQUALIZER_BANDS.map((_, index) => {
            const x = (index / (AUDIO_EQUALIZER_BANDS.length - 1)) * 100;
            const gain = settings.enabled ? (settings.gains[index] ?? 0) : 0;
            const normalized = (AUDIO_EQUALIZER_MAX_GAIN_DB - gain) / (AUDIO_EQUALIZER_MAX_GAIN_DB - AUDIO_EQUALIZER_MIN_GAIN_DB);
            const y = Math.max(4, Math.min(96, normalized * 100));
            return [x, y] as const;
        });
        return points.slice(1).reduce((acc, [x, y], idx) => {
            const [prevX, prevY] = points[idx]!;
            const midX = (prevX + x) / 2;
            return `${acc} C ${midX.toFixed(1)},${prevY.toFixed(1)} ${midX.toFixed(1)},${y.toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`;
        }, `M ${points[0]![0].toFixed(1)},${points[0]![1].toFixed(1)}`);
    }, [settings.enabled, settings.gains]);

    const handleToggleEnabled = () => {
        setSettings({
            ...settings,
            enabled: !settings.enabled,
        });
    };

    const handleSelectPreset = (presetId: AudioEqualizerModeId) => {
        applyPresetInStore(presetId);
    };

    const writeCustomBandOrEffect = (nextGains: number[], nextEffects: AudioEffectSettings) => {
        const slotId: AudioEqualizerCustomSlotId = isAudioEqualizerCustomSlotId(settings.preset)
            ? settings.preset
            : AUDIO_EQUALIZER_CUSTOM_SLOT_IDS[0];
        const slotIndex = getAudioEqualizerCustomSlotIndex(slotId);
        const next: AudioEqualizerSettings = {
            ...settings,
            enabled: true,
            preset: slotId,
            gains: nextGains,
            effects: nextEffects,
            customSlots: settings.customSlots.map((slot, index) => (
                index === slotIndex ? { gains: [...nextGains], effects: { ...nextEffects } } : slot
            )),
        };
        setSettings(next);
    };

    const handleBandChange = (bandIndex: number, gainDb: number) => {
        const nextGains = [...settings.gains];
        nextGains[bandIndex] = gainDb;
        writeCustomBandOrEffect(nextGains, { ...settings.effects });
    };

    const handleEffectChange = (effectId: AudioEffectId, value: number) => {
        writeCustomBandOrEffect([...settings.gains], {
            ...settings.effects,
            [effectId]: value,
        });
    };

    const handleResetToFlat = () => {
        setSettings(resetAudioEqualizerToFlat(settings));
    };

    const handleResetEffectsOnly = () => {
        writeCustomBandOrEffect([...settings.gains], createNeutralAudioEffects());
    };

    const canReset = !isAudioEqualizerFlat(settings) || isAudioEqualizerCustomSlotId(settings.preset);

    return (
        <div
            data-testid="mobile-equalizer-sheet"
            className="flex flex-col max-h-[84dvh] overflow-hidden rounded-t-3xl border-t border-white/15 bg-[#0b0b11]/98 text-zinc-100 shadow-2xl backdrop-blur-2xl"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
        >
            {/* Header Bar */}
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3.5">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06]"
                        style={{ color: settings.enabled ? accentColor : '#a1a1aa' }}
                    >
                        <Sliders size={18} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="truncate text-base font-bold text-white">Audio Equalizer & Effects</h3>
                        <p className="truncate text-[11px] text-zinc-400">
                            10-Band Parametric/Shelf EQ ({AUDIO_EQUALIZER_MIN_GAIN_DB} dB to +{AUDIO_EQUALIZER_MAX_GAIN_DB} dB)
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {/* On/Off Toggle Pill */}
                    <button
                        type="button"
                        role="switch"
                        aria-checked={settings.enabled}
                        data-testid="mobile-equalizer-toggle"
                        onClick={handleToggleEnabled}
                        className={`flex h-9 items-center gap-2 rounded-full border px-3.5 text-xs font-semibold transition-all active:scale-95 ${
                            settings.enabled
                                ? 'border-white/30 bg-white text-zinc-950 shadow-sm'
                                : 'border-white/15 bg-white/[0.06] text-zinc-300'
                        }`}
                    >
                        <span
                            className={`h-2 w-2 rounded-full ${
                                settings.enabled ? 'bg-emerald-500' : 'bg-zinc-500'
                            }`}
                        />
                        <span>{settings.enabled ? 'On' : 'Off'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-zinc-300 active:scale-95"
                        aria-label="Close equalizer"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">
                {/* Real-Time Audio Engine Status Banner */}
                <div
                    data-testid="mobile-equalizer-engine-status"
                    className={`flex items-center justify-between gap-2.5 rounded-2xl border px-3.5 py-2.5 text-xs ${
                        !runtimeStatus.supported
                            ? 'border-amber-400/30 bg-amber-500/10 text-amber-200'
                            : runtimeStatus.connected
                                ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200'
                                : 'border-white/10 bg-white/[0.04] text-zinc-300'
                    }`}
                >
                    <div className="flex items-center gap-2 min-w-0">
                        {!runtimeStatus.supported ? (
                            <AlertTriangle size={15} className="shrink-0 text-amber-400" />
                        ) : runtimeStatus.connected ? (
                            <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
                        ) : (
                            <Activity size={15} className="shrink-0 text-zinc-400" />
                        )}
                        <span className="truncate font-medium">
                            {!runtimeStatus.supported
                                ? (runtimeStatus.reason || 'Audio effects unsupported in this environment')
                                : runtimeStatus.connected
                                    ? `Live Web Audio 10-Band Biquad DSP Active${runtimeStatus.sampleRate ? ` (${Math.round(runtimeStatus.sampleRate / 100) / 10} kHz)` : ''}`
                                    : 'Web Audio 10-Band Biquad DSP Ready — engages automatically on playback'}
                        </span>
                    </div>
                    {onOpenFullDesktopEqualizer && (
                        <button
                            type="button"
                            onClick={onOpenFullDesktopEqualizer}
                            className="shrink-0 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white"
                        >
                            Studio View
                        </button>
                    )}
                </div>

                {/* Preset Chips + Reset to Flat */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                            Sound Presets
                        </span>
                        <button
                            type="button"
                            data-testid="mobile-equalizer-reset-flat"
                            disabled={!canReset}
                            onClick={handleResetToFlat}
                            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-zinc-200 disabled:opacity-40 active:scale-95 transition-all"
                        >
                            <RotateCcw size={12} />
                            <span>Reset to Flat</span>
                        </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                        {ALL_PRESET_IDS.map((presetId) => {
                            const active = settings.preset === presetId;
                            return (
                                <button
                                    key={presetId}
                                    type="button"
                                    data-testid={`eq-preset-${presetId}`}
                                    onClick={() => handleSelectPreset(presetId)}
                                    className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                                        active
                                            ? 'border-white bg-white text-zinc-950 shadow-sm'
                                            : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]'
                                    }`}
                                >
                                    {AUDIO_EQUALIZER_PRESET_LABELS[presetId] ?? presetId}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Live Frequency Response Curve Preview */}
                <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
                    <div className="mb-1.5 flex items-center justify-between text-[11px] font-mono text-zinc-400">
                        <span>+{AUDIO_EQUALIZER_MAX_GAIN_DB} dB</span>
                        <span className="text-zinc-300">
                            {AUDIO_EQUALIZER_PRESET_LABELS[settings.preset] ?? settings.preset}
                            {settings.enabled ? '' : ' (Bypassed)'}
                        </span>
                        <span>{AUDIO_EQUALIZER_MIN_GAIN_DB} dB</span>
                    </div>
                    <div className="relative h-16 w-full">
                        <svg
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                            className="h-full w-full overflow-visible"
                            aria-label="Equalizer frequency response curve"
                        >
                            <line
                                x1={0}
                                x2={100}
                                y1={50}
                                y2={50}
                                stroke="rgba(255,255,255,0.16)"
                                strokeDasharray="2,2"
                                strokeWidth={1}
                                vectorEffect="non-scaling-stroke"
                            />
                            <path
                                d={svgPath}
                                fill="none"
                                stroke={settings.enabled ? accentColor : '#71717a'}
                                strokeWidth={2.2}
                                vectorEffect="non-scaling-stroke"
                            />
                        </svg>
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] font-mono text-zinc-500">
                        {AUDIO_EQUALIZER_BANDS.map((band, idx) => (
                            <span key={band.frequency} title={`Composite response: ${formatSignedDb(responseCurveDb[idx] ?? 0)}`}>
                                {band.label}
                            </span>
                        ))}
                    </div>
                </div>

                {/* 10 Frequency Band Sliders with Actual Center Frequencies & Gain Ranges */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold uppercase tracking-wider text-zinc-400">
                            Frequency Bands (31 Hz – 16 kHz)
                        </span>
                        <span className="font-mono text-[11px] text-zinc-400">
                            Range: {AUDIO_EQUALIZER_MIN_GAIN_DB} dB to +{AUDIO_EQUALIZER_MAX_GAIN_DB} dB
                        </span>
                    </div>

                    <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                        {AUDIO_EQUALIZER_BANDS.map((band, index) => {
                            const gain = settings.gains[index] ?? 0;
                            const filterKind = index === 0 ? 'Low Shelf' : index === AUDIO_EQUALIZER_BANDS.length - 1 ? 'High Shelf' : 'Peaking';
                            return (
                                <div
                                    key={band.frequency}
                                    className="flex items-center gap-3 py-1"
                                >
                                    <div className="w-20 shrink-0">
                                        <div className="font-mono text-xs font-semibold text-zinc-100">
                                            {formatFrequencyLabel(band.frequency)}
                                        </div>
                                        <div className="text-[10px] text-zinc-500">{filterKind}</div>
                                    </div>

                                    <div className="relative flex-1 flex items-center">
                                        <input
                                            type="range"
                                            min={AUDIO_EQUALIZER_MIN_GAIN_DB}
                                            max={AUDIO_EQUALIZER_MAX_GAIN_DB}
                                            step={0.5}
                                            value={gain}
                                            aria-label={`${formatFrequencyLabel(band.frequency)} gain`}
                                            data-testid={`eq-band-slider-${band.frequency}`}
                                            onChange={(e) => handleBandChange(index, Number(e.target.value))}
                                            className="w-full accent-white cursor-pointer"
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleBandChange(index, 0)}
                                        title="Tap to reset this band to 0 dB"
                                        className={`w-16 shrink-0 rounded-lg border px-1.5 py-1 text-right font-mono text-xs font-semibold transition-colors ${
                                            Math.abs(gain) > 0.01
                                                ? 'border-white/20 bg-white/10 text-white'
                                                : 'border-white/5 bg-white/[0.02] text-zinc-400'
                                        }`}
                                    >
                                        {formatSignedDb(gain)}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Optional Post-EQ Audio Effects Section */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => setShowEffects(prev => !prev)}
                            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300"
                        >
                            <Sparkles size={14} style={{ color: accentColor }} />
                            <span>Post-EQ Audio Effect Chain {showEffects ? '▾' : '▸'}</span>
                        </button>
                        {showEffects && (
                            <button
                                type="button"
                                onClick={handleResetEffectsOnly}
                                className="text-[11px] font-medium text-zinc-400 underline hover:text-white"
                            >
                                Reset Effects
                            </button>
                        )}
                    </div>

                    {showEffects && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            {([
                                { id: 'punch' as const, label: 'Dynamic Punch (Compressor)', min: 0, max: 1, step: 0.05, fmt: (v: number) => `${Math.round(v * 100)}%` },
                                { id: 'width' as const, label: 'Stereo Width', min: 0, max: 2, step: 0.05, fmt: (v: number) => `${Math.round(v * 100)}%` },
                                { id: 'space' as const, label: 'Reverb Space', min: 0, max: 1, step: 0.05, fmt: (v: number) => `${Math.round(v * 100)}%` },
                                { id: 'drive' as const, label: 'Warmth / Saturation', min: 0, max: 1, step: 0.05, fmt: (v: number) => `${Math.round(v * 100)}%` },
                            ]).map(ctrl => {
                                const val = settings.effects[ctrl.id];
                                return (
                                    <div key={ctrl.id} className="space-y-1 rounded-xl border border-white/10 bg-black/30 p-2.5">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-medium text-zinc-200">{ctrl.label}</span>
                                            <span className="font-mono text-zinc-400">{ctrl.fmt(val)}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={ctrl.min}
                                            max={ctrl.max}
                                            step={ctrl.step}
                                            value={val}
                                            onChange={(e) => handleEffectChange(ctrl.id, Number(e.target.value))}
                                            className="w-full accent-white"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default React.memo(MobileEqualizerSheet);
