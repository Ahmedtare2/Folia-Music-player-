import { describe, expect, it } from 'vitest';
import type { Line } from '@/types';
import { createConductor, type ConductorInput } from '@/components/visualizer/astral/astralSequencer';
import { isInsideKeepOut } from '@/components/visualizer/astral/astralSceneLayout';

const line = (start: number, end: number, extra: Partial<Line> = {}): Line => ({
    fullText: `line ${start}`, startTime: start, endTime: end, words: [{ text: 'line', startTime: start, endTime: end }], ...extra,
});
const lines = (): Line[] => [line(2, 6), line(6, 10), line(10, 20, { isChorus: true }), line(20, 24), line(60, 66)];
const input = (time: number, extra: Partial<ConductorInput> = {}): ConductorInput => ({
    time, dt: 1 / 60, paused: false, aspect: 16 / 9, intensity: 1, speed: 1, still: false, ...extra,
});
const run = (c: ReturnType<typeof createConductor>, from: number, to: number, step = 1 / 30) => {
    const poses: Array<{ x: number; y: number; z: number; open: number }> = [];
    for (let t = from; t <= to; t += step) {
        const o = c.step(input(t, { dt: step }));
        poses.push({ x: o.pose.px, y: o.pose.py, z: o.pose.pz, open: o.gateOpen });
    }
    return poses;
};
const maxJump = (poses: Array<{ x: number; y: number; z: number }>) => {
    let m = 0;
    for (let i = 1; i < poses.length; i += 1) m = Math.max(m, Math.hypot(poses[i]!.x - poses[i - 1]!.x, poses[i]!.y - poses[i - 1]!.y, poses[i]!.z - poses[i - 1]!.z));
    return m;
};

describe('ASTRAL sequencer', () => {
    it('gives the same camera for the same song and time (deterministic)', () => {
        const a = run(createConductor({ lines: lines(), seed: 's' }), 0, 30);
        const b = run(createConductor({ lines: lines(), seed: 's' }), 0, 30);
        expect(a).toEqual(b);
    });

    it('moves smoothly: no cut between shots, even at a section change', () => {
        const poses = run(createConductor({ lines: lines(), seed: 'smooth' }), 0, 40);
        // At 30 samples/s a jump this big would be a visible cut.
        expect(maxJump(poses)).toBeLessThan(1.2);
    });

    it('stays out of every keep-out volume through a whole song', () => {
        const c = createConductor({ lines: lines(), seed: 'bounds' });
        for (let t = 0; t < 70; t += 1 / 20) {
            const o = c.step(input(t, { dt: 1 / 20 }));
            expect(isInsideKeepOut({ x: o.pose.px, y: o.pose.py, z: o.pose.pz }, o.gateOpen > 0.02 || o.shot.kind === 'gate')).toBe(false);
        }
    });

    it('opens the gate at the first chorus line and closes it again', () => {
        const c = createConductor({ lines: lines(), seed: 'gate' });
        const poses = run(c, 0, 26);
        expect(Math.max(...poses.map(p => p.open))).toBeGreaterThan(0.9);
        expect(poses[poses.length - 1]!.open).toBeLessThan(0.2);
    });

    it('freezes while paused and resumes from the same place', () => {
        const c = createConductor({ lines: lines(), seed: 'pause' });
        run(c, 0, 8);
        const a = c.step(input(8, { paused: true }));
        const pa = { ...a.pose };
        for (let i = 0; i < 30; i += 1) c.step(input(8, { paused: true }));
        const b = c.step(input(8, { paused: true }));
        expect(b.pose.px).toBeCloseTo(pa.px, 6);
        expect(b.pose.pz).toBeCloseTo(pa.pz, 6);
    });

    it('a seek blends from the actual camera pose instead of cutting', () => {
        const c = createConductor({ lines: lines(), seed: 'seek' });
        const before = run(c, 0, 12).at(-1)!;
        const after = c.step(input(50, { dt: 1 / 30 }));
        expect(Math.hypot(after.pose.px - before.x, after.pose.py - before.y, after.pose.pz - before.z)).toBeLessThan(1.5);
    });

    it('a loop (time jumps back to the start) plays a gate return', () => {
        const c = createConductor({ lines: lines(), seed: 'loop' });
        run(c, 0, 30);
        let started = false;
        let open = 0;
        for (let t = 0.5; t < 4; t += 1 / 30) {
            const o = c.step(input(t, { dt: 1 / 30 }));
            started = started || o.startedReturn;
            open = Math.max(open, o.gateOpen);
        }
        expect(started).toBe(true);
        expect(open).toBeGreaterThan(0.5);
    });

    it('a song change opens through the gate, and the first song does not', () => {
        const c = createConductor({ lines: lines(), seed: 'one' });
        expect(c.step(input(0)).startedReturn).toBe(false);
        c.setSong({ lines: lines(), seed: 'two' }, true);
        expect(c.step(input(0)).startedReturn).toBe(true);
    });

    it('instrumental sections and songs without lyrics keep a moving camera and invent no lines', () => {
        const none = createConductor({ lines: [], seed: 'inst' });
        expect(none.segments.every(s => s.lineIndex === -1)).toBe(true);
        const poses = run(none, 0, 40);
        expect(Math.max(...poses.map(p => p.z)) - Math.min(...poses.map(p => p.z))).toBeGreaterThan(0.5);
        // The gap between the lines at 24s and 60s is covered by camera-only segments.
        const gap = createConductor({ lines: lines(), seed: 'gap' }).segments.filter(s => s.start >= 24 && s.end <= 60);
        expect(gap.length).toBeGreaterThan(0);
        expect(gap.every(s => s.lineIndex === -1)).toBe(true);
    });

    it('static mode is the hero frame', () => {
        const c = createConductor({ lines: lines(), seed: 'still' });
        const a = c.step(input(5, { still: true }));
        const b = c.step(input(40, { still: true }));
        expect(a.pose.pz).toBeCloseTo(b.pose.pz);
        expect(a.gateOpen).toBe(0);
    });
});
