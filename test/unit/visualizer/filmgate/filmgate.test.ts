import { describe, expect, it } from 'vitest';
import { motionValue } from 'framer-motion';
import type { Line } from '@/types';
import { buildFilmWords, layoutFilmLine } from '@/components/visualizer/filmgate/filmGateLayout';
import { gateOffset, shotFrame, shotKindFor, wordLight, WORD_SETTLED, WORD_UPCOMING } from '@/components/visualizer/filmgate/filmGateMotion';
import { createFilmGateAudioSampler } from '@/components/visualizer/filmgate/filmGateAudio';
import { DEFAULT_FILMGATE_TUNING, normalizeFilmgateTuning } from '@/components/visualizer/filmgate/types';

const line = (fullText: string, words: Array<[string, number, number]>, start = 0, end = 4): Line => ({
    fullText, startTime: start, endTime: end,
    words: words.map(([text, startTime, endTime]) => ({ text, startTime, endTime })),
});
// One unit of width per code point: enough to test wrapping and ordering without a canvas.
const measure = (text: string) => Array.from(text).length * 10;
const layout = (l: Line, maxWidth = 1000, direction: 'ltr' | 'rtl' = 'ltr') => layoutFilmLine({
    words: buildFilmWords(l), direction, maxWidth, spaceWidth: 4, lineHeight: 20, measure,
});

describe('FILMGATE whole-word Arabic', () => {
    const arabic = line('أنا بحبك قوي', [['أنا ', 0, 1], ['بحبك ', 1, 2.5], ['قوي', 2.5, 4]]);

    it('keeps each Arabic word as one unit with its own timestamps', () => {
        const words = buildFilmWords(arabic);
        expect(words.map(w => w.text)).toEqual(['أنا', 'بحبك', 'قوي']);
        expect(words.map(w => [w.start, w.end])).toEqual([[0, 1], [1, 2.5], [2.5, 4]]);
        expect(words.every(w => w.dir === 'rtl')).toBe(true);
        // No word was cut into letters.
        expect(words.every(w => Array.from(w.text).length > 1)).toBe(true);
    });

    it('places the first word of an RTL line at the right', () => {
        const l = layout(arabic, 1000, 'rtl');
        const placed = l.rows[0]!.words;
        const xs = Object.fromEntries(placed.map(p => [p.word.text, p.x]));
        expect(xs['أنا']).toBeGreaterThan(xs['بحبك']!);
        expect(xs['بحبك']).toBeGreaterThan(xs['قوي']!);
    });

    it('merges contiguous Arabic pieces of one word into a single word', () => {
        const pieces = line('مرحبا', [['مر', 0, 0.5], ['حبا', 0.5, 1]], 0, 1);
        const words = buildFilmWords(pieces);
        expect(words).toHaveLength(1);
        expect(words[0]!.text).toBe('مرحبا');
        expect([words[0]!.start, words[0]!.end]).toEqual([0, 1]);
    });

    it('keeps diacritics and punctuation attached to the word', () => {
        const l = line('مَرْحَبًا، يا صاحبي!', [['مَرْحَبًا، ', 0, 1], ['يا ', 1, 1.5], ['صاحبي!', 1.5, 3]], 0, 3);
        const words = buildFilmWords(l);
        expect(words[0]!.text).toBe('مَرْحَبًا،');
        expect(words[2]!.text).toBe('صاحبي!');
    });

    it('keeps an embedded English word in reading order inside an Arabic line', () => {
        const l = line('بحبك love you قوي', [['بحبك ', 0, 1], ['love ', 1, 2], ['you ', 2, 3], ['قوي', 3, 4]]);
        const placed = layout(l, 1000, 'rtl').rows[0]!.words;
        const xs = Object.fromEntries(placed.map(p => [p.word.text, p.x]));
        // The Latin run stays left to right, and the whole run sits left of the first Arabic word.
        expect(xs['love']).toBeLessThan(xs['you']!);
        expect(xs['بحبك']).toBeGreaterThan(xs['you']!);
        expect(xs['قوي']).toBeLessThan(xs['love']!);
    });

    it('spreads line-timed lyrics over whole words, never letters', () => {
        const l = line('يا قلبي سامحني', [], 10, 14);
        const words = buildFilmWords(l);
        expect(words.map(w => w.text)).toEqual(['يا', 'قلبي', 'سامحني']);
        expect(words[0]!.start).toBe(10);
        expect(words[2]!.end).toBeCloseTo(14, 5);
    });
});

describe('FILMGATE layout', () => {
    it('wraps long English lines and orders left to right', () => {
        const l = line('one two three four five six', [['one ', 0, 1], ['two ', 1, 2], ['three ', 2, 3], ['four ', 3, 4], ['five ', 4, 5], ['six', 5, 6]], 0, 6);
        const result = layout(l, 90);
        expect(result.rows.length).toBeGreaterThan(1);
        for (const row of result.rows) {
            expect(row.width).toBeLessThanOrEqual(90);
            const xs = row.words.map(p => p.x);
            expect([...xs].sort((a, b) => a - b)).toEqual(xs);
        }
    });

    it('never drops or repeats a word', () => {
        const l = line('a b c d e f g', 'abcdefg'.split('').map((c, i) => [c, i, i + 1] as [string, number, number]), 0, 7);
        const out = layout(l, 25).rows.flatMap(r => r.words.map(p => p.word.text));
        expect(out.sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    });
});

describe('FILMGATE word light and shots', () => {
    it('lights a word up while it is sung and settles it, never to black', () => {
        expect(wordLight(-5, 1, 2).exposure).toBe(WORD_UPCOMING);
        const during = wordLight(1.5, 1, 2);
        expect(during.sweep).toBeCloseTo(0.5, 5);
        expect(during.glow).toBeGreaterThan(0.5);
        expect(wordLight(1.99, 1, 2).exposure).toBeGreaterThan(0.9);
        expect(wordLight(30, 1, 2).exposure).toBeCloseTo(WORD_SETTLED, 5);
        // Exposure only falls after the word, smoothly.
        let previous = wordLight(2, 1, 2).exposure;
        for (let t = 2; t < 4; t += 0.05) {
            const e = wordLight(t, 1, 2).exposure;
            expect(e).toBeLessThanOrEqual(previous + 1e-9);
            expect(previous - e).toBeLessThan(0.08);
            previous = e;
        }
    });

    it('handles a zero-length word', () => {
        const light = wordLight(5, 5, 5);
        expect(Number.isFinite(light.exposure)).toBe(true);
        expect(light.exposure).toBeGreaterThan(0.4);
    });

    it('is deterministic and gives neighbours different shots', () => {
        expect(shotKindFor(7)).toBe(shotKindFor(7));
        expect(shotKindFor(3)).not.toBe(shotKindFor(4));
        expect(shotFrame(5, 4, 8, 'push', 9)).toEqual(shotFrame(5, 4, 8, 'push', 9));
    });

    it('dissolves a line in and out without a jump', () => {
        let last = 0;
        for (let t = 3; t < 10; t += 0.02) {
            const a = shotFrame(t, 4, 8, 'dissolve').alpha;
            expect(Math.abs(a - last)).toBeLessThan(0.15);
            last = a;
        }
        expect(shotFrame(0, 4, 8, 'push').visible).toBe(false);
        expect(shotFrame(6, 4, 8, 'push').alpha).toBeCloseTo(1, 1);
    });

    it('lets the old line leave before the next one is full', () => {
        // Next line starts at 8.2: by then the old one is gone.
        expect(shotFrame(8.2, 4, 8, 'push', 8.2 - 0.45).alpha).toBeLessThan(0.05);
    });

    it('keeps the gate still with no motion and no kick', () => {
        const gate = gateOffset(12.3, 0, 0, 1, 0);
        expect(gate.dx).toBeCloseTo(0, 9);
        expect(gate.rotation).toBeCloseTo(0, 9);
        expect(gate.squeeze).toBe(1);
    });

    it('keeps the gate move small even at full kick', () => {
        const gate = gateOffset(3, 2, 1, 2, 1);
        expect(Math.abs(gate.dx)).toBeLessThan(0.02);
        expect(Math.abs(gate.dy)).toBeLessThan(0.04);
        expect(gate.squeeze).toBeGreaterThan(0.95);
    });
});

describe('FILMGATE audio', () => {
    const bands = (v: number) => ({ bass: motionValue(v), lowMid: motionValue(v), mid: motionValue(v), vocal: motionValue(v), treble: motionValue(v) });

    it('reads a 0..1 source and a 0..255 source to the same range', () => {
        const a = createFilmGateAudioSampler({ audioPower: motionValue(0.5), audioBands: bands(0.5) });
        const b = createFilmGateAudioSampler({ audioPower: motionValue(127.5), audioBands: bands(127.5) });
        for (let i = 0; i < 80; i += 1) { a.sample(0.05, false); b.sample(0.05, false); }
        expect(a.frame.bass).toBeCloseTo(b.frame.bass, 2);
        expect(a.frame.bass).toBeGreaterThan(0.4);
    });

    it('stays within 0..1 and reads silence when paused', () => {
        const s = createFilmGateAudioSampler({ audioPower: motionValue(900), audioBands: bands(900) });
        for (let i = 0; i < 40; i += 1) s.sample(0.05, false);
        for (const v of Object.values(s.frame)) { expect(v).toBeLessThanOrEqual(1); expect(v).toBeGreaterThanOrEqual(0); }
        s.sample(0.05, true);
        expect(s.frame.power).toBe(0);
        expect(s.frame.bass).toBe(0);
    });

    it('derives bands from the overall level when only that is known (video export)', () => {
        const s = createFilmGateAudioSampler({ audioPower: motionValue(0.8), audioBands: bands(0) });
        for (let i = 0; i < 60; i += 1) s.sample(0.05, false);
        expect(s.frame.bass).toBeGreaterThan(0.4);
    });

    it('fires a kick on a sudden bass rise and lets it decay', () => {
        const bass = motionValue(0.05);
        const s = createFilmGateAudioSampler({ audioPower: motionValue(0.3), audioBands: { ...bands(0.05), bass } });
        for (let i = 0; i < 40; i += 1) s.sample(0.016, false);
        bass.set(0.95);
        s.sample(0.016, false);
        expect(s.frame.kick).toBeGreaterThan(0.5);
        for (let i = 0; i < 80; i += 1) s.sample(0.016, false);
        expect(s.frame.kick).toBeLessThan(0.1);
    });

    it('does not kick on a steady loud bass', () => {
        const s = createFilmGateAudioSampler({ audioPower: motionValue(0.8), audioBands: bands(0.9) });
        for (let i = 0; i < 400; i += 1) s.sample(0.016, false);
        expect(s.frame.kick).toBeLessThan(0.1);
    });
});

describe('FILMGATE tuning', () => {
    it('fills missing fields and clamps', () => {
        expect(normalizeFilmgateTuning(undefined)).toEqual(DEFAULT_FILMGATE_TUNING);
        expect(normalizeFilmgateTuning('nope')).toEqual(DEFAULT_FILMGATE_TUNING);
        const t = normalizeFilmgateTuning({ grain: 9, lightLeaks: -3, gateMotion: Number.NaN, frame: 'x' });
        expect(t.grain).toBe(2);
        expect(t.lightLeaks).toBe(0);
        expect(t.gateMotion).toBe(DEFAULT_FILMGATE_TUNING.gateMotion);
        expect(t.frame).toBe(true);
    });
});
