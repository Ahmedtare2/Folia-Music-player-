import { describe, expect, it } from 'vitest';
import type { Line } from '@/types';
import { hashSeed, planSegments, segmentAt, sectionOf, virtualSegment } from '@/components/visualizer/astral/astralShotPlanner';

const line = (start: number, end: number, extra: Partial<Line> = {}): Line => ({
    fullText: `line ${start}`, startTime: start, endTime: end,
    words: [{ text: 'line', startTime: start, endTime: end }], ...extra,
});
const song = (): Line[] => [
    line(2, 6), line(6, 10), line(10, 14, { songPart: 'Pre-Chorus' }), line(14, 22, { isChorus: true }),
    line(22, 26), line(40, 48, { isChorus: true }), line(48, 52, { songPart: 'Bridge' }), line(52, 56),
];

describe('ASTRAL shot planner', () => {
    it('is deterministic for a seed and differs between seeds', () => {
        const a = planSegments({ lines: song(), seed: 'song-a' });
        const b = planSegments({ lines: song(), seed: 'song-a' });
        const c = planSegments({ lines: song(), seed: 'song-b' });
        expect(a).toEqual(b);
        expect(a.map(s => s.shot.kind)).not.toEqual(c.map(s => s.shot.kind));
        expect(hashSeed('x')).toBe(hashSeed('x'));
    });

    it('covers time without overlap and never repeats a shot back to back', () => {
        const plan = planSegments({ lines: song(), seed: 7 });
        for (let i = 1; i < plan.length; i += 1) {
            expect(plan[i]!.start).toBeGreaterThanOrEqual(plan[i - 1]!.start);
            expect(plan[i]!.shot.kind === 'hold' && plan[i - 1]!.shot.kind === 'hold').toBe(false);
        }
        expect(plan[0]!.index).toBe(0);
    });

    it('classifies sections from the line metadata', () => {
        expect(sectionOf(line(0, 1, { isChorus: true }), 3, 10)).toBe('chorus');
        expect(sectionOf(line(0, 1, { songPart: 'Bridge' }), 3, 10)).toBe('bridge');
        expect(sectionOf(line(0, 1, { songPart: 'Pre-Chorus' }), 3, 10)).toBe('prechorus');
        expect(sectionOf(undefined, 0, 0)).toBe('gap');
    });

    it('puts the gate at the first long chorus line', () => {
        const plan = planSegments({ lines: song(), seed: 'g' });
        const gates = plan.filter(s => s.shot.kind === 'gate');
        expect(gates.length).toBeGreaterThanOrEqual(1);
        expect(gates[0]!.section).toBe('chorus');
    });

    it('gives long instrumental gaps camera-only segments with no line', () => {
        const plan = planSegments({ lines: song(), seed: 'g' });
        const gap = plan.filter(s => s.lineIndex === -1);
        expect(gap.length).toBeGreaterThan(0);
        for (const g of gap) expect(g.end - g.start).toBeLessThanOrEqual(8.001);
    });

    it('plans a song with no lyrics as endless camera-only segments', () => {
        expect(planSegments({ lines: [], seed: 'none' }).every(s => s.lineIndex === -1)).toBe(true);
        const v = virtualSegment('none', 3);
        expect(v.lineIndex).toBe(-1);
        expect(segmentAt([], 'none', 40).lineIndex).toBe(-1);
    });

    it('finds the segment for any time, including before the first line', () => {
        const plan = planSegments({ lines: song(), seed: 'g' });
        expect(segmentAt(plan, 'g', 0)).toBeTruthy();
        const s = segmentAt(plan, 'g', 15);
        expect(s.start).toBeLessThanOrEqual(15);
        expect(s.end).toBeGreaterThan(15);
    });
});
