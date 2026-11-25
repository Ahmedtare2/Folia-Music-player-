import {
    CAMERA_MAX_Y, GATE, HERO_POSITION, HERO_TARGET, keepCameraOut, ORRERY_CENTER, PLANETS, STAR_POS, type Vec3,
} from './astralSceneLayout';

// src/components/visualizer/astral/astralCameraPath.ts
// ASTRAL's camera language. Every shot is a short list of keyframes (a camera position and a look-at point) run through a
// Catmull-Rom spline, so a shot is one smooth curve whatever its kind. A shot is a pure function of its own progress
// p in [0, 1]: nothing here reads a clock, which is why a seek or a pause can never leave the camera in a wrong place.
// The camera always looks at a point with the world's up axis fixed, so it can never roll and the lyric plane, which is
// carried in camera space, can never turn upside down.

export type ShotKind =
    | 'hold' | 'push' | 'pull' | 'orbit' | 'track' | 'crane' | 'flythrough' | 'spiral' | 'pan' | 'reveal' | 'gate';

export interface Shot {
    kind: ShotKind;
    /** -1 or 1: which side the move happens on. */
    side: 1 | -1;
    /** Small deterministic variation 0..1 (distance, height, which planet to follow). */
    variation: number;
}

export interface Pose {
    px: number; py: number; pz: number;
    tx: number; ty: number; tz: number;
}

export const createPose = (): Pose => ({ px: 0, py: 0, pz: 0, tx: 0, ty: 0, tz: 0 });

/** Longest and shortest time a shot takes to play out. A line shorter than the minimum gets a cut-off (blended) shot. */
export const SHOT_MIN_SECONDS: Record<ShotKind, number> = {
    hold: 4, push: 5, pull: 5, orbit: 7, track: 6, crane: 6, flythrough: 8, spiral: 8, pan: 5, reveal: 7, gate: 11,
};
export const SHOT_MAX_SECONDS = 18;

interface Key { p: Vec3; t: Vec3 }

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const key = (px: number, py: number, pz: number, tx: number, ty: number, tz: number): Key => ({ p: v(px, py, pz), t: v(tx, ty, tz) });
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};
export const easeInOut = (t: number) => {
    const c = Math.min(1, Math.max(0, t));
    return c * c * c * (c * (c * 6 - 15) + 10);
};

const catmull = (a: number, b: number, c: number, d: number, t: number) => {
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
};

const sampleKeys = (keys: readonly Key[], u: number, out: Pose) => {
    const n = keys.length - 1;
    const f = Math.min(Math.max(u, 0), 1) * n;
    const i = Math.min(n - 1, Math.floor(f));
    const t = f - i;
    const k0 = keys[Math.max(0, i - 1)]!;
    const k1 = keys[i]!;
    const k2 = keys[i + 1]!;
    const k3 = keys[Math.min(n, i + 2)]!;
    out.px = catmull(k0.p.x, k1.p.x, k2.p.x, k3.p.x, t);
    out.py = catmull(k0.p.y, k1.p.y, k2.p.y, k3.p.y, t);
    out.pz = catmull(k0.p.z, k1.p.z, k2.p.z, k3.p.z, t);
    out.tx = catmull(k0.t.x, k1.t.x, k2.t.x, k3.t.x, t);
    out.ty = catmull(k0.t.y, k1.t.y, k2.t.y, k3.t.y, t);
    out.tz = catmull(k0.t.z, k1.t.z, k2.t.z, k3.t.z, t);
};

const FOLLOW_PLANETS = ['neptune', 'saturn', 'jupiter', 'moon', 'mars'] as const;
const planetById = (id: string) => PLANETS.find(p => p.id === id)!;

const orbitPoint = (angle: number, radius: number, y: number): Vec3 => v(Math.sin(angle) * radius, y, Math.cos(angle) * radius);

/** The keyframes of a shot. Built per call from constants only (cheap: at most a dozen small objects, and only on a shot change). */
export const shotKeys = (shot: Shot): readonly Key[] => {
    const s = shot.side;
    const q = shot.variation;
    const hp = HERO_POSITION;
    const ht = HERO_TARGET;
    switch (shot.kind) {
        case 'hold':
            return [key(hp.x + s * 0.4, hp.y, hp.z, ht.x, ht.y, ht.z), key(hp.x - s * 0.4, hp.y + 0.25, hp.z - 0.8, ht.x, ht.y + 0.1, ht.z)];
        case 'push':
            return [
                key(s * 1.2, 2.8, 20.5, 0, 6.6, 0),
                key(s * lerp(1.5, 3.2, q), 4.2, 14.5, 0, 6.3, 0),
                key(s * lerp(1.2, 3.6, q), 5.4, 10.2, 0, STAR_POS.y + 0.1, 0),
            ];
        case 'pull':
            return [
                key(s * 3.4, 5.4, 10.6, 0, 6.2, 0),
                key(s * 1.6, 4.0, 16, 0, 6.6, 0),
                key(0, 2.8, 21.8, ht.x, ht.y, ht.z),
            ];
        case 'orbit': {
            const a0 = s * -1.05;
            const a1 = s * 1.05;
            const r = lerp(10, 12.5, q);
            const keys: Key[] = [];
            for (let i = 0; i <= 4; i += 1) {
                const a = lerp(a0, a1, i / 4);
                const p = orbitPoint(a, r + Math.sin((i / 4) * Math.PI) * 1.5, lerp(3.6, 5.2, Math.sin((i / 4) * Math.PI)));
                keys.push(key(p.x, p.y, p.z, 0, ORRERY_CENTER.y + 2.2, 0));
            }
            return keys;
        }
        case 'track': {
            const planet = planetById(FOLLOW_PLANETS[Math.floor(q * FOLLOW_PLANETS.length) % FOLLOW_PLANETS.length]!);
            const c = planet.position;
            const dist = planet.radius * 3.2 + 4.5;
            return [
                key(c.x * 0.4 + s * 2.5, c.y * 0.6 + 1.2, c.z + dist + 5, c.x, c.y, c.z),
                key(c.x * 0.6 + s * 0.8, c.y * 0.75 + 1.4, c.z + dist, c.x, c.y, c.z),
                key(c.x * 0.7 - s * 1.8, c.y * 0.8 + 1.8, c.z + dist - 1.2, c.x * 0.8, c.y * 0.9, c.z),
            ];
        }
        case 'crane':
            return [
                key(s * 4.4, 1.8, 11.5, 0, 4.0, 0),
                key(s * 3.4, 4.6, 10, 0, 5.6, 0),
                key(s * 2.2, 8.9, 10.4, 0, 7.2, 0),
            ];
        case 'flythrough':
            // Between the right (or left) colonnade and the orrery, towards the gate wall, then a little way out of the hall.
            return [
                key(s * 7.6, 3.4, 26, s * 1.5, 6.6, 0),
                key(s * 7.0, 4.4, 15, s * 2.0, 6.6, 0),
                key(s * 7.4, 5.0, 6.5, 0, 6.8, 0),
                key(s * 6.2, 5.6, 1.6, 0, 7.0, 0),
            ];
        case 'spiral': {
            const keys: Key[] = [];
            for (let i = 0; i <= 5; i += 1) {
                const u = i / 5;
                const p = orbitPoint(s * lerp(-1.2, 1.2, u), lerp(14, 8.2, u), lerp(2.4, 8.4, u));
                keys.push(key(p.x, p.y, p.z, 0, lerp(6.0, 6.8, u), 0));
            }
            return keys;
        }
        case 'pan':
            return [
                key(s * 3, 3.6, 16, -s * 7, 8, 0),
                key(s * 3, 3.8, 16, 0, 7, 0),
                key(s * 3, 3.6, 16, s * 6.5, 8.5, 0),
            ];
        case 'reveal':
            return [
                key(0, 10.5, 12, 0, 6.5, 0),
                key(0, 7, 18, 0, 8, 0),
                key(hp.x, hp.y + 0.6, hp.z + 4, ht.x, ht.y + 0.6, ht.z),
            ];
        case 'gate': {
            // Over the orrery, in through the ring, a look at the passage, then back out the way it came: a round trip.
            const g = GATE;
            return [
                key(0, 3.4, 19, 0, 7.0, 0),
                key(0, 8.4, 9.5, g.x, g.y + 1.2, g.z),
                key(0, 9.0, 1.2, g.x, g.y + 0.6, g.z - 8),
                key(0, 8.8, g.z - 1.0, 0, 7.4, g.z - 18),
                key(0, 7.8, -12, 0, 7.0, -34),
                key(0, 7.2, -16, 0, 6.6, -38),
                key(0, 8.2, -9, 0, 7.4, 3),
                key(0, 9.0, 1.0, 0, 6.8, 6),
                key(0, 6.0, 13.5, 0, 6.8, 0),
                key(0, 3.2, 21, ht.x, ht.y, ht.z),
            ];
        }
        default:
            return [key(hp.x, hp.y, hp.z, ht.x, ht.y, ht.z), key(hp.x, hp.y, hp.z, ht.x, ht.y, ht.z)];
    }
};

/** 0..1, how open the Astral Gate is at progress p of a shot. Only the gate shot opens it. */
export const gateOpenAt = (kind: ShotKind, p: number): number => {
    if (kind !== 'gate') return 0;
    return smoothstep(0.14, 0.3, p) * (1 - smoothstep(0.72, 0.88, p));
};

const sampleCache = new Map<string, readonly Key[]>();
const keysFor = (shot: Shot) => {
    const id = `${shot.kind}|${shot.side}|${shot.variation.toFixed(2)}`;
    let keys = sampleCache.get(id);
    if (!keys) {
        keys = shotKeys(shot);
        if (sampleCache.size > 64) sampleCache.clear();
        sampleCache.set(id, keys);
    }
    return keys;
};

/** The pose of `shot` at progress p, with a very small breathing on top. */
export const shotPose = (shot: Shot, p: number, breath: number, out: Pose): Pose => {
    sampleKeys(keysFor(shot), shot.kind === 'gate' ? p : easeInOut(Math.min(1, Math.max(0, p))), out);
    // Camera breathing: a slow, tiny sway of the position (never of the look-at point, so the picture keeps its aim).
    out.px += Math.sin(breath * 0.55) * 0.07;
    out.py += Math.sin(breath * 0.41 + 1.3) * 0.05;
    return out;
};

const heroPose = createPose();
heroPose.px = HERO_POSITION.x; heroPose.py = HERO_POSITION.y; heroPose.pz = HERO_POSITION.z;
heroPose.tx = HERO_TARGET.x; heroPose.ty = HERO_TARGET.y; heroPose.tz = HERO_TARGET.z;
export const HERO_POSE: Readonly<Pose> = heroPose;

/** Scale a pose's travel: 0 is the hero composition, 1 is the shot as designed, above 1 exaggerates it. */
export const applyIntensity = (pose: Pose, intensity: number): Pose => {
    if (intensity === 1) return pose;
    pose.px = HERO_POSE.px + (pose.px - HERO_POSE.px) * intensity;
    pose.py = HERO_POSE.py + (pose.py - HERO_POSE.py) * intensity;
    pose.pz = HERO_POSE.pz + (pose.pz - HERO_POSE.pz) * intensity;
    pose.tx = HERO_POSE.tx + (pose.tx - HERO_POSE.tx) * intensity;
    pose.ty = HERO_POSE.ty + (pose.ty - HERO_POSE.ty) * intensity;
    pose.tz = HERO_POSE.tz + (pose.tz - HERO_POSE.tz) * intensity;
    return pose;
};

/** A tall narrow screen sees less of the hall sideways: pull the camera back from its target to compensate. */
export const applyAspect = (pose: Pose, aspect: number): Pose => {
    if (aspect >= 1) return pose;
    const k = 1 + (1 / aspect - 1) * 0.32;
    pose.px = pose.tx + (pose.px - pose.tx) * k;
    pose.py = pose.ty + (pose.py - pose.ty) * k;
    pose.pz = pose.tz + (pose.pz - pose.tz) * k;
    return pose;
};

const tmpOut: Vec3 = { x: 0, y: 0, z: 0 };
const tmpIn: Vec3 = { x: 0, y: 0, z: 0 };
/** Keep the camera out of everything solid; the look-at point is left alone. */
export const constrainPose = (pose: Pose, gateOpen: boolean): Pose => {
    tmpIn.x = pose.px; tmpIn.y = pose.py; tmpIn.z = pose.pz;
    keepCameraOut(tmpIn, gateOpen, tmpOut);
    pose.px = tmpOut.x; pose.py = Math.min(CAMERA_MAX_Y, tmpOut.y); pose.pz = tmpOut.z;
    return pose;
};

export const copyPose = (from: Pose, to: Pose): Pose => {
    to.px = from.px; to.py = from.py; to.pz = from.pz; to.tx = from.tx; to.ty = from.ty; to.tz = from.tz;
    return to;
};

export const blendPose = (a: Pose, b: Pose, w: number, out: Pose): Pose => {
    out.px = lerp(a.px, b.px, w); out.py = lerp(a.py, b.py, w); out.pz = lerp(a.pz, b.pz, w);
    out.tx = lerp(a.tx, b.tx, w); out.ty = lerp(a.ty, b.ty, w); out.tz = lerp(a.tz, b.tz, w);
    return out;
};
