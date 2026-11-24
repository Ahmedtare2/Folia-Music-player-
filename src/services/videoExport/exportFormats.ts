// src/services/videoExport/exportFormats.ts
// Aspect ratio choices for the video export. Each quality tier (2K / 4K) has a pixel budget and a long-edge cap taken from
// its 16:9 size, so every aspect ratio costs the encoder about the same work as 16:9 does. Sizes are multiples of 16.

export type ExportAspectId = '16:9' | '9:16' | '1:1' | '4:5' | '4:3' | '21:9';

export type ExportAspect = { id: ExportAspectId; label: string; hint: string; ratio: number };

export const EXPORT_ASPECTS: readonly ExportAspect[] = [
    { id: '16:9', label: '16:9', hint: 'YouTube, TV', ratio: 16 / 9 },
    { id: '9:16', label: '9:16', hint: 'Shorts, Reels, TikTok', ratio: 9 / 16 },
    { id: '1:1', label: '1:1', hint: 'Square', ratio: 1 },
    { id: '4:5', label: '4:5', hint: 'Instagram feed', ratio: 4 / 5 },
    { id: '4:3', label: '4:3', hint: 'Classic', ratio: 4 / 3 },
    { id: '21:9', label: '21:9', hint: 'Ultrawide', ratio: 21 / 9 },
];

export type ExportSize = {
    width: number;
    height: number;
    /** Size of the hidden layout host in CSS pixels (short edge 720, so the look matches the 16:9 one). */
    hostCssWidth: number;
    hostCssHeight: number;
};

const roundTo16 = (value: number) => Math.max(16, Math.round(value / 16) * 16);

export const resolveExportSize = (base16x9: { width: number; height: number }, aspect: ExportAspect): ExportSize => {
    const budget = base16x9.width * base16x9.height;
    const longCap = Math.max(base16x9.width, base16x9.height);
    let height = Math.sqrt(budget / aspect.ratio);
    let width = height * aspect.ratio;
    const longEdge = Math.max(width, height);
    if (longEdge > longCap) {
        const scale = longCap / longEdge;
        width *= scale;
        height *= scale;
    }
    const w = roundTo16(width);
    const h = roundTo16(height);
    const short = 720;
    const hostCssWidth = w >= h ? Math.round(short * w / h) : short;
    const hostCssHeight = w >= h ? short : Math.round(short * h / w);
    return { width: w, height: h, hostCssWidth, hostCssHeight };
};
