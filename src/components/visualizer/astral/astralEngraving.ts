import * as THREE from 'three';

// src/components/visualizer/astral/astralEngraving.ts
// The hall's small engraved details, drawn once with Canvas 2D into a few small textures: the Roman-numeral ring of the
// Astral Gate, the glyph bands of the enamel drums, the clock dial, planet ring stripes and the soft glow sprite.
// They are decoration only (no lyric text goes through here), cached for the life of the scene and disposed with it.
// Glyphs are drawn as paths, not font characters, so they look the same on every phone whatever fonts it has.

const NUMERALS = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
const BRASS = '#d9b46a';
const BRASS_DARK = '#7a5a26';

const makeCanvas = (w: number, h: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    return { canvas, ctx: canvas.getContext('2d')! };
};

const toTexture = (canvas: HTMLCanvasElement, srgb = true) => {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.anisotropy = 4;
    texture.generateMipmaps = true;
    return texture;
};

/** Square texture for a flat ring: numerals around an annulus, tick marks on its inner and outer edge. */
export const createNumeralRingTexture = (size: number, innerRatio: number): THREE.CanvasTexture => {
    const { canvas, ctx } = makeCanvas(size, size);
    const c = size / 2;
    const g = ctx.createRadialGradient(c, c, c * innerRatio, c, c, c);
    g.addColorStop(0, '#8a6a30');
    g.addColorStop(0.5, '#c9a352');
    g.addColorStop(1, '#8a6a30');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const mid = c * (1 + innerRatio) / 2;
    const band = c * (1 - innerRatio);
    ctx.fillStyle = '#2a1d08';
    ctx.strokeStyle = '#2a1d08';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.round(band * 0.36)}px Georgia, 'Times New Roman', serif`;
    NUMERALS.forEach((numeral, i) => {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        ctx.save();
        ctx.translate(c + Math.cos(a) * mid, c + Math.sin(a) * mid);
        ctx.rotate(a + Math.PI / 2);
        ctx.fillText(numeral, 0, 0);
        ctx.restore();
    });
    ctx.lineWidth = Math.max(1, size / 700);
    for (let i = 0; i < 120; i += 1) {
        const a = (i / 120) * Math.PI * 2;
        const long = i % 10 === 0;
        const r0 = c * innerRatio + band * 0.04;
        const r1 = r0 + band * (long ? 0.14 : 0.07);
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
        ctx.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);
        ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(c, c, c * innerRatio + band * 0.2, 0, Math.PI * 2);
    ctx.arc(c, c, c - band * 0.08, 0, Math.PI * 2);
    ctx.stroke();
    return toTexture(canvas);
};

const glyphPath = (ctx: CanvasRenderingContext2D, kind: number, x: number, y: number, s: number) => {
    ctx.beginPath();
    switch (kind % 8) {
        case 0: ctx.arc(x, y, s * 0.42, 0, Math.PI * 2); ctx.moveTo(x + s * 0.06, y); ctx.arc(x, y, s * 0.06, 0, Math.PI * 2); break;
        case 1: ctx.arc(x - s * 0.1, y, s * 0.42, -1.2, 1.2); ctx.arc(x + s * 0.08, y, s * 0.34, 1.2, -1.2, true); break;
        case 2: ctx.moveTo(x - s * 0.4, y + s * 0.35); ctx.lineTo(x, y - s * 0.4); ctx.lineTo(x + s * 0.4, y + s * 0.35); ctx.closePath(); break;
        case 3: ctx.moveTo(x, y - s * 0.45); ctx.lineTo(x, y + s * 0.45); ctx.moveTo(x - s * 0.3, y - s * 0.12); ctx.lineTo(x + s * 0.3, y - s * 0.12); break;
        case 4: ctx.moveTo(x - s * 0.4, y - s * 0.1); ctx.quadraticCurveTo(x - s * 0.2, y - s * 0.5, x, y - s * 0.1); ctx.quadraticCurveTo(x + s * 0.2, y + s * 0.3, x + s * 0.4, y - s * 0.1); break;
        case 5: ctx.rect(x - s * 0.32, y - s * 0.32, s * 0.64, s * 0.64); break;
        case 6: ctx.moveTo(x, y - s * 0.45); ctx.lineTo(x + s * 0.3, y); ctx.lineTo(x, y + s * 0.45); ctx.lineTo(x - s * 0.3, y); ctx.closePath(); break;
        default: ctx.moveTo(x - s * 0.4, y); ctx.lineTo(x + s * 0.4, y); ctx.moveTo(x, y - s * 0.4); ctx.lineTo(x, y + s * 0.4); break;
    }
    ctx.stroke();
};

/** A strip of twelve engraved glyphs on deep enamel blue. Wrapping once around a drum, it also serves as its own emissive map. */
export const createGlyphBandTexture = (w: number, h: number): { map: THREE.CanvasTexture; emissive: THREE.CanvasTexture } => {
    const base = makeCanvas(w, h);
    base.ctx.fillStyle = '#10347a';
    base.ctx.fillRect(0, 0, w, h);
    const gloss = base.ctx.createLinearGradient(0, 0, 0, h);
    gloss.addColorStop(0, 'rgba(120,170,255,0.35)');
    gloss.addColorStop(0.5, 'rgba(0,0,0,0)');
    gloss.addColorStop(1, 'rgba(0,0,0,0.35)');
    base.ctx.fillStyle = gloss;
    base.ctx.fillRect(0, 0, w, h);
    const glow = makeCanvas(w, h);
    glow.ctx.fillStyle = '#0a1d46';
    glow.ctx.fillRect(0, 0, w, h);
    for (const ctx of [base.ctx, glow.ctx]) {
        ctx.strokeStyle = ctx === base.ctx ? BRASS : '#9fc4ff';
        ctx.lineWidth = Math.max(1.5, h / 28);
        ctx.lineCap = 'round';
        for (let i = 0; i < 12; i += 1) glyphPath(ctx, i, ((i + 0.5) / 12) * w, h / 2, h * 0.5);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, h * 0.1); ctx.lineTo(w, h * 0.1); ctx.moveTo(0, h * 0.9); ctx.lineTo(w, h * 0.9);
        ctx.stroke();
    }
    const map = toTexture(base.canvas);
    const emissive = toTexture(glow.canvas);
    map.wrapS = emissive.wrapS = THREE.RepeatWrapping;
    return { map, emissive };
};

/** The clock dial: ivory-slate face, fine ticks, hour marks, a few concentric engraved circles. */
export const createDialTexture = (size: number): THREE.CanvasTexture => {
    const { canvas, ctx } = makeCanvas(size, size);
    const c = size / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, '#2b3350');
    g.addColorStop(1, '#161b2e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = BRASS;
    for (let i = 0; i < 120; i += 1) {
        const a = (i / 120) * Math.PI * 2;
        const long = i % 10 === 0;
        ctx.lineWidth = long ? size / 150 : size / 420;
        const r0 = c * (long ? 0.74 : 0.8);
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
        ctx.lineTo(c + Math.cos(a) * c * 0.88, c + Math.sin(a) * c * 0.88);
        ctx.stroke();
    }
    ctx.lineWidth = size / 400;
    for (const r of [0.92, 0.7, 0.5, 0.3, 0.1]) {
        ctx.beginPath();
        ctx.arc(c, c, c * r, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.lineWidth = size / 300;
    ctx.beginPath();
    ctx.moveTo(c, c); ctx.lineTo(c, c - c * 0.62);
    ctx.moveTo(c, c); ctx.lineTo(c + c * 0.32, c + c * 0.1);
    ctx.stroke();
    for (let i = 0; i < 12; i += 1) glyphPath(ctx, i, c + Math.cos((i / 12) * Math.PI * 2) * c * 0.6, c + Math.sin((i / 12) * Math.PI * 2) * c * 0.6, size * 0.05);
    return toTexture(canvas);
};

/** Stripes for a planet ring, read radially: u runs across the ring from inner to outer edge. */
export const createRingStripeTexture = (): THREE.CanvasTexture => {
    const { canvas, ctx } = makeCanvas(256, 4);
    const g = ctx.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, 'rgba(210,180,130,0)');
    g.addColorStop(0.08, 'rgba(210,180,130,0.55)');
    g.addColorStop(0.3, 'rgba(160,130,90,0.25)');
    g.addColorStop(0.42, 'rgba(230,200,150,0.7)');
    g.addColorStop(0.7, 'rgba(190,160,110,0.45)');
    g.addColorStop(1, 'rgba(210,180,130,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 4);
    return toTexture(canvas);
};

/** A soft round glow, white, for additive sprites. */
export const createGlowTexture = (size = 128): THREE.CanvasTexture => {
    const { canvas, ctx } = makeCanvas(size, size);
    const c = size / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.18, 'rgba(255,240,210,0.7)');
    g.addColorStop(0.5, 'rgba(255,220,160,0.18)');
    g.addColorStop(1, 'rgba(255,220,160,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return toTexture(canvas);
};

export const ENGRAVING_COLORS = { brass: BRASS, brassDark: BRASS_DARK };
