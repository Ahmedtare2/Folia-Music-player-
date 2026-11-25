import { describe, expect, it } from 'vitest';
import type { Line } from '@/types';
import { activeLineIndexAt, buildAstralWords, layoutAstralLine, wordProgress } from '@/components/visualizer/astral/astralLyricLayout';

const line = (fullText: string, words: Array<[string, number, number]>, start = 0, end = 4): Line => ({
    fullText, startTime: start, endTime: end, words: words.map(([text, startTime, endTime]) => ({ text, startTime, endTime })),
});
const measure = (text: string) => Array.from(text).length * 10;
const layout = (l: Line, maxWidth = 1000, direction: 'ltr' | 'rtl' = 'ltr') => layoutAstralLine({
    words: buildAstralWords(l), direction, maxWidth, spaceWidth: 4, lineHeight: 20, measure,
});

describe('ASTRAL lyric layout', () => {
    const en = line('hold the light', [['hold ', 0, 1], ['the ', 1, 2], ['light', 2, 4]]);

    it('uses the real word timing exactly', () => {
        expect(buildAstralWords(en).map(w => [w.text, w.start, w.end])).toEqual([['hold', 0, 1], ['the', 1, 2], ['light', 2, 4]]);
    });

    it('falls back to the line span, spread by letters, when a line has no word timing', () => {
        const plain = line('one three', [], 10, 14);
        const words = buildAstralWords(plain);
        expect(words.map(w => w.text)).toEqual(['one', 'three']);
        expect(words[0]!.start).toBe(10);
        expect(words[1]!.end).toBeCloseTo(14);
        expect(words[0]!.end).toBeCloseTo(words[1]!.start);
    });

    it('lays an LTR line left to right in one row', () => {
        const l = layout(en);
        expect(l.rows).toHaveLength(1);
        const xs = l.rows[0]!.words.map(p => p.x);
        expect(xs).toEqual([...xs].sort((a, b) => a - b));
    });

    it('wraps a long line into rows that fit the width', () => {
        const long = line('aaaa bbbb cccc dddd eeee ffff', ['aaaa', 'bbbb', 'cccc', 'dddd', 'eeee', 'ffff'].map((t, i) => [t, i, i + 1] as [string, number, number]));
        const l = layout(long, 100);
        expect(l.rows.length).toBeGreaterThan(1);
        for (const row of l.rows) expect(row.width).toBeLessThanOrEqual(100 + 1e-6);
        expect(l.rows.flatMap(r => r.words).map(p => p.word.text)).toEqual(['aaaa', 'bbbb', 'cccc', 'dddd', 'eeee', 'ffff']);
    });

    it('lays an RTL line right to left', () => {
        const ar = line('أنا بحبك قوي', [['أنا ', 0, 1], ['بحبك ', 1, 2.5], ['قوي', 2.5, 4]]);
        const placed = layout(ar, 1000, 'rtl').rows[0]!.words;
        const x = Object.fromEntries(placed.map(p => [p.word.text, p.x]));
        expect(x['أنا']).toBeGreaterThan(x['بحبك']!);
        expect(x['بحبك']).toBeGreaterThan(x['قوي']!);
    });

    it('word progress: before, during, after, and instant words', () => {
        expect(wordProgress({ start: 2, end: 4 }, 1)).toBe(-1);
        expect(wordProgress({ start: 2, end: 4 }, 3)).toBeCloseTo(0.5);
        expect(wordProgress({ start: 2, end: 4 }, 4)).toBe(2);
        expect(wordProgress({ start: 2, end: 2 }, 2)).toBe(2);
    });

    it('finds the active line by playback time, including seeks backward', () => {
        const lines = [line('a', [['a', 1, 2]], 1, 2), line('b', [['b', 3, 4]], 3, 4), line('c', [['c', 6, 7]], 6, 7)];
        expect(activeLineIndexAt(lines, 0)).toBe(-1);
        expect(activeLineIndexAt(lines, 3.5)).toBe(1);
        expect(activeLineIndexAt(lines, 100)).toBe(2);
        expect(activeLineIndexAt(lines, 1.2)).toBe(0);
    });
});
