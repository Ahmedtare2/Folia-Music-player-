import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Line } from '@/types';
import { buildAstralWords, layoutAstralLine } from '@/components/visualizer/astral/astralLyricLayout';
import { createAstralRasterCache, rasterAstralWord } from '@/components/visualizer/astral/astralTextRaster';

const line = (fullText: string, words: Array<[string, number, number]>, start = 0, end = 4): Line => ({
    fullText, startTime: start, endTime: end, words: words.map(([text, startTime, endTime]) => ({ text, startTime, endTime })),
});

interface Call { text: string; fillStyle: string; direction: string; shadowOffsetX: number }
const calls: Call[] = [];
class FakeCanvas {
    width = 300;
    height = 150;
    getContext() {
        const state = { font: '700 96px serif', fillStyle: '', direction: 'ltr', shadowOffsetX: 0, shadowColor: '', shadowBlur: 0, textAlign: '', textBaseline: '', globalCompositeOperation: '' };
        return Object.assign(state, {
            fillRect() {},
            measureText(text: string) { return { width: Array.from(text).length * 50 }; },
            fillText(text: string) { calls.push({ text, fillStyle: state.fillStyle, direction: state.direction, shadowOffsetX: state.shadowOffsetX }); },
        });
    }
}

describe('ASTRAL whole-word Arabic', () => {
    afterEach(() => { vi.unstubAllGlobals(); calls.length = 0; });
    const arabic = line('أنا بحبك قوي', [['أنا ', 0, 1], ['بحبك ', 1, 2.5], ['قوي', 2.5, 4]]);

    it('keeps each Arabic word as one unit with its own timestamps', () => {
        const words = buildAstralWords(arabic);
        expect(words.map(w => w.text)).toEqual(['أنا', 'بحبك', 'قوي']);
        expect(words.map(w => [w.start, w.end])).toEqual([[0, 1], [1, 2.5], [2.5, 4]]);
        expect(words.every(w => w.dir === 'rtl')).toBe(true);
        expect(words.every(w => Array.from(w.text).length > 1)).toBe(true);
    });

    it('merges contiguous Arabic pieces of one word into a single word', () => {
        const words = buildAstralWords(line('مرحبا', [['مر', 0, 0.5], ['حبا', 0.5, 1]], 0, 1));
        expect(words).toHaveLength(1);
        expect(words[0]!.text).toBe('مرحبا');
        expect([words[0]!.start, words[0]!.end]).toEqual([0, 1]);
    });

    it('the rasterizer draws a whole word with ONE ink fillText and never splits it into letters', () => {
        vi.stubGlobal('document', { createElement: (tag: string) => (tag === 'canvas' ? new FakeCanvas() : {}) });
        const word = 'السَّلام';
        rasterAstralWord(word, 'serif', 700);
        const ink = calls.filter(c => c.fillStyle === '#ff0000');
        expect(ink).toHaveLength(1);
        expect(ink[0]!.text).toBe(word);
        expect(ink[0]!.direction).toBe('rtl');
        // Every fillText of the word (ink and halo passes) carries the entire word.
        expect(calls.every(c => c.text === word)).toBe(true);
    });

    it('one raster per whole word through the cache (no per-letter textures)', () => {
        vi.stubGlobal('document', { createElement: (tag: string) => (tag === 'canvas' ? new FakeCanvas() : {}) });
        const cache = createAstralRasterCache(8);
        const words = buildAstralWords(arabic);
        for (const w of words) cache.get(w.text, 'serif', 700);
        for (const w of words) cache.get(w.text, 'serif', 700);
        expect(cache.size).toBe(words.length);
        expect(new Set(calls.filter(c => c.fillStyle === '#ff0000').map(c => c.text))).toEqual(new Set(words.map(w => w.text)));
    });

    it('lays out Arabic words as whole units right to left and the layout holds the same words', () => {
        const l = layoutAstralLine({ words: buildAstralWords(arabic), direction: 'rtl', maxWidth: 1000, spaceWidth: 4, lineHeight: 20, measure: t => Array.from(t).length * 10 });
        expect(l.rows[0]!.words.map(p => p.word.text).sort()).toEqual(['أنا', 'بحبك', 'قوي'].sort());
    });
});
