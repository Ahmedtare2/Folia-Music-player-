import { STATIONS } from '@/components/visualizer/astral/astralStations';
import { describe, expect, it } from 'vitest';
import {
    applyAspect, applyIntensity, blendPose, constrainPose, copyPose, createPose, gateOpenAt, HERO_POSE, shotPose, SHOT_MIN_SECONDS, type ShotKind,
} from '@/components/visualizer/astral/astralCameraPath';
import { isInsideKeepOut } from '@/components/visualizer/astral/astralSceneLayout';

const KINDS = Object.keys(SHOT_MIN_SECONDS) as ShotKind[];

describe('ASTRAL camera path', () => {
    it('has the ten movement types plus gate and station', () => {
        // Ten camera movements, plus the gate round trip.
        expect(KINDS.filter(k => k !== 'gate' && k !== 'station')).toHaveLength(10);
        expect(KINDS).toContain('gate');
    });

    it('never puts the camera inside a keep-out volume, for every shot at every progress', () => {
        for (const kind of KINDS) {
            for (const side of [1, -1] as const) {
                for (const variation of [0, 0.5, 1]) {
                    for (let i = 0; i <= 40; i += 1) {
                        const p = i / 40;
                        const pose = shotPose({ kind, side, variation, station: STATIONS[Math.floor(variation * 2 * (STATIONS.length - 1) + i) % STATIONS.length]!.id }, p, i, createPose());
                        constrainPose(pose, kind === 'gate' || kind === 'flythrough');
                        expect(Number.isFinite(pose.px + pose.py + pose.pz + pose.tx + pose.ty + pose.tz)).toBe(true);
                        expect(isInsideKeepOut({ x: pose.px, y: pose.py, z: pose.pz }, kind === 'gate' || kind === 'flythrough')).toBe(false);
                    }
                }
            }
        }
    });

    it('the gate shot is a round trip: closed at both ends and open in the middle', () => {
        expect(gateOpenAt('gate', 0)).toBeLessThan(0.05);
        expect(gateOpenAt('gate', 1)).toBeLessThan(0.05);
        expect(gateOpenAt('gate', 0.5)).toBeGreaterThan(0.9);
        const start = shotPose({ kind: 'gate', side: 1, variation: 0.5 }, 0, 0, createPose());
        const end = shotPose({ kind: 'gate', side: 1, variation: 0.5 }, 1, 0, createPose());
        expect(Math.hypot(start.px - end.px, start.py - end.py, start.pz - end.pz)).toBeLessThan(6);
    });

    it('intensity 0 stays on the hero composition and the camera is never rolled (position and target only)', () => {
        const pose = shotPose({ kind: 'orbit', side: 1, variation: 0.3 }, 0.5, 0, createPose());
        applyIntensity(pose, 0);
        expect(pose.px).toBeCloseTo(HERO_POSE.px);
        expect(pose.pz).toBeCloseTo(HERO_POSE.pz);
        expect(pose.tz).toBeCloseTo(HERO_POSE.tz);
        expect(Object.keys(pose).sort()).toEqual(['px', 'py', 'pz', 'tx', 'ty', 'tz']);
    });

    it('a portrait screen pulls the camera back from its target, a landscape one does not', () => {
        const a = copyPose(HERO_POSE, createPose());
        const b = copyPose(HERO_POSE, createPose());
        applyAspect(a, 16 / 9);
        applyAspect(b, 9 / 16);
        expect(a.pz).toBeCloseTo(HERO_POSE.pz);
        expect(b.pz - b.tz).toBeGreaterThan(a.pz - a.tz);
    });

    it('blending starts from the actual pose and ends on the new one', () => {
        const from = shotPose({ kind: 'push', side: 1, variation: 0 }, 0.7, 0, createPose());
        const to = shotPose({ kind: 'pull', side: -1, variation: 1 }, 0.1, 0, createPose());
        const out = createPose();
        blendPose(from, to, 0, out);
        expect(out).toEqual(from);
        blendPose(from, to, 1, out);
        expect(out).toEqual(to);
        blendPose(from, to, 0.5, out);
        expect(out.px).toBeCloseTo((from.px + to.px) / 2);
    });
});
