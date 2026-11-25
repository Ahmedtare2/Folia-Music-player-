// src/components/visualizer/astral/astralSceneLayout.ts
// ASTRAL's one shared world: where everything stands, the points the camera looks at, and the keep-out volumes
// the camera must never enter. Pure data and pure functions (no three.js), so the camera tests run without WebGL.
// The hall runs along -z. The orrery stands at the origin, the camera's hero position is on the central axis
// at +z. Zone A (orrery chamber) is z in [-3, 22]; the Astral Gate is the ring on the backdrop panel at z = GATE.z;
// Zone B (orbital passage) runs from the gate down to z = -52; Zone C (celestial gallery) lies beyond it.

export interface Vec3 { x: number; y: number; z: number }

export const HALL_HALF_WIDTH = 13;
export const COLONNADE_X = 10.6;
export const HALL_FRONT_Z = 30;
export const VAULT_SPRING_Y = 9;
export const VAULT_RADIUS = 10.9;

export const ORRERY_CENTER: Vec3 = { x: 0, y: 3.6, z: 0 };
export const STAR_POS: Vec3 = { x: 0, y: 6.1, z: 0 };
export const PANEL_Z = -3.4;
export const GATE: Vec3 = { x: 0, y: 6.4, z: -3.0 };
export const GATE_OUTER_RADIUS = 4.6;
export const GATE_HOLE_RADIUS = 3.2;
export const PASSAGE_END_Z = -58;
export const GALLERY_CENTER: Vec3 = { x: 0, y: 8, z: -84 };

export const HERO_POSITION: Vec3 = { x: 0, y: 2.6, z: 19.5 };
export const HERO_TARGET: Vec3 = { x: 0, y: 6.9, z: 0 };

export interface PlanetSpec {
    id: string;
    kind: 'ice' | 'gas' | 'ringed' | 'mars' | 'moon' | 'dark' | 'amber' | 'tiny';
    position: Vec3;
    radius: number;
    /** Drift amplitude (world units) and period (seconds). */
    bob: number;
    period: number;
    seedOffset: number;
}

export const PLANETS: readonly PlanetSpec[] = [
    { id: 'neptune', kind: 'ice', position: { x: -6.4, y: 11.6, z: 1.2 }, radius: 3.0, bob: 0.25, period: 23, seedOffset: 0.1 },
    { id: 'jupiter', kind: 'gas', position: { x: 2.8, y: 16.8, z: -2 }, radius: 1.9, bob: 0.2, period: 29, seedOffset: 0.3 },
    { id: 'saturn', kind: 'ringed', position: { x: 7.0, y: 9.6, z: 0.8 }, radius: 1.8, bob: 0.22, period: 31, seedOffset: 0.5 },
    { id: 'mars', kind: 'mars', position: { x: -2.9, y: 2.5, z: 10.5 }, radius: 0.95, bob: 0.12, period: 19, seedOffset: 0.7 },
    { id: 'moon', kind: 'moon', position: { x: -7.8, y: 3.6, z: 5.2 }, radius: 1.15, bob: 0.2, period: 17, seedOffset: 0.9 },
    { id: 'colossus', kind: 'dark', position: { x: 21, y: 3.4, z: -3 }, radius: 6, bob: 0.3, period: 41, seedOffset: 0.2 },
    { id: 'amber', kind: 'amber', position: { x: -10.5, y: 17.5, z: 6 }, radius: 1.5, bob: 0.2, period: 27, seedOffset: 0.4 },
    { id: 'tiny1', kind: 'tiny', position: { x: -2.6, y: 8.6, z: 2.4 }, radius: 0.45, bob: 0.1, period: 13, seedOffset: 0.6 },
    { id: 'tiny2', kind: 'tiny', position: { x: 3.4, y: 3.0, z: 3.4 }, radius: 0.32, bob: 0.1, period: 11, seedOffset: 0.8 },
    { id: 'tiny3', kind: 'tiny', position: { x: 5.8, y: 14.5, z: -1 }, radius: 0.5, bob: 0.15, period: 15, seedOffset: 0.15 },
    // Beyond the gate (zone B and C), seen on the flythrough.
    { id: 'passageA', kind: 'ice', position: { x: -9, y: 7, z: -24 }, radius: 2.6, bob: 0.3, period: 25, seedOffset: 0.35 },
    { id: 'passageB', kind: 'gas', position: { x: 10, y: 11, z: -38 }, radius: 3.4, bob: 0.3, period: 33, seedOffset: 0.55 },
    { id: 'galleryA', kind: 'ringed', position: { x: -22, y: 18, z: -80 }, radius: 7.5, bob: 0.4, period: 45, seedOffset: 0.65 },
    { id: 'galleryB', kind: 'dark', position: { x: 26, y: 12, z: -92 }, radius: 9, bob: 0.4, period: 47, seedOffset: 0.85 },
];

/** Volumes the camera cannot enter. `r` is a sphere radius, a cylinder radius or the half-size of a box. */
export type KeepOut =
    | { kind: 'sphere'; c: Vec3; r: number }
    | { kind: 'cylinderY'; x: number; z: number; r: number; y0: number; y1: number }
    | { kind: 'box'; min: Vec3; max: Vec3 };

export const COLUMN_Z_STEP = 3.4;
export const COLUMN_Z_FIRST = 22;
export const COLUMN_COUNT = 9;
export const columnZ = (index: number) => COLUMN_Z_FIRST - index * COLUMN_Z_STEP;

const CAMERA_MARGIN = 0.9;

export const KEEP_OUTS: readonly KeepOut[] = [
    // The orrery: pedestal, columns and armillary.
    { kind: 'cylinderY', x: 0, z: 0, r: 3.9 + CAMERA_MARGIN * 0.3, y0: 0, y1: 8.4 },
    // Flanking mini orrery pillars.
    { kind: 'cylinderY', x: -6.2, z: -1.4, r: 1.3 + CAMERA_MARGIN, y0: 0, y1: 9 },
    { kind: 'cylinderY', x: 6.2, z: -1.4, r: 1.3 + CAMERA_MARGIN, y0: 0, y1: 9 },
    // The backdrop panel (the gate hole is a gap in it, see GATE_HOLE_RADIUS: the camera passes through the hole only).
    // Planets.
    ...PLANETS.map(p => ({ kind: 'sphere', c: p.position, r: p.radius + CAMERA_MARGIN } as const)),
    // Figures: hall telescope, the astronomer pair and the constellation ring.
    { kind: 'cylinderY', x: 9.8, z: 15, r: 1.5 + CAMERA_MARGIN * 0.4, y0: 0, y1: 6 },
    { kind: 'cylinderY', x: -4.6, z: 14, r: 1.1 + CAMERA_MARGIN * 0.4, y0: 0, y1: 6 },
    { kind: 'cylinderY', x: 4.6, z: 14, r: 1.1 + CAMERA_MARGIN * 0.4, y0: 0, y1: 6 },
    { kind: 'sphere', c: { x: -5.5, y: 8.5, z: 6 }, r: 2.1 + CAMERA_MARGIN },
];

const clampFloorY = 0.9;
export const CAMERA_MIN_Y = clampFloorY;
export const CAMERA_MAX_Y = 19.5;

const inGateHole = (p: Vec3) => {
    const dx = p.x - GATE.x;
    const dy = p.y - GATE.y;
    return dx * dx + dy * dy < (GATE_HOLE_RADIUS - 0.5) * (GATE_HOLE_RADIUS - 0.5);
};

/** The camera must stay inside the hall: between the colonnades, under the vault, in front of the panel unless it flies through the gate. */
export const hallBounds = (p: Vec3, gateOpen: boolean) => {
    const behindPanel = p.z < PANEL_Z + 0.9;
    if (behindPanel) {
        if (gateOpen) {
            // Past the gate the passage is its own tunnel, narrower.
            const half = p.z > -4 ? GATE_HOLE_RADIUS - 0.6 : 9;
            return { minX: -half, maxX: half, minZ: PASSAGE_END_Z, maxZ: HALL_FRONT_Z };
        }
    }
    return { minX: -(COLONNADE_X - 1.4), maxX: COLONNADE_X - 1.4, minZ: gateOpen ? PASSAGE_END_Z : PANEL_Z + 1.6, maxZ: HALL_FRONT_Z };
};

/** Push a camera position out of every keep-out volume and back inside the hall. Continuous in `p`, so a smooth path stays smooth. */
export const keepCameraOut = (position: Vec3, gateOpen: boolean, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 => {
    out.x = position.x;
    out.y = position.y;
    out.z = position.z;
    const bounds = hallBounds(out, gateOpen);
    out.x = Math.min(bounds.maxX, Math.max(bounds.minX, out.x));
    out.z = Math.min(bounds.maxZ, Math.max(bounds.minZ, out.z));
    out.y = Math.min(CAMERA_MAX_Y, Math.max(CAMERA_MIN_Y, out.y));
    for (const volume of KEEP_OUTS) {
        if (volume.kind === 'sphere') {
            const dx = out.x - volume.c.x;
            const dy = out.y - volume.c.y;
            const dz = out.z - volume.c.z;
            const d = Math.hypot(dx, dy, dz);
            if (d < volume.r) {
                const k = d > 1e-5 ? volume.r / d : 1;
                if (d > 1e-5) {
                    const nx = volume.c.x + dx * k;
                    if (nx < bounds.minX || nx > bounds.maxX) {
                        // The way straight out would leave the hall: slide along the wall instead, round the sphere.
                        out.x = Math.min(bounds.maxX, Math.max(bounds.minX, nx));
                        const rest = volume.r * volume.r - (out.x - volume.c.x) ** 2 - dy * dy;
                        out.z = volume.c.z + (dz >= 0 ? 1 : -1) * Math.sqrt(Math.max(0, rest));
                    } else {
                        out.x = nx;
                        out.y = volume.c.y + dy * k;
                        out.z = volume.c.z + dz * k;
                    }
                } else {
                    out.z = volume.c.z + volume.r;
                }
            }
        } else if (volume.kind === 'cylinderY') {
            if (out.y >= volume.y0 && out.y <= volume.y1) {
                const dx = out.x - volume.x;
                const dz = out.z - volume.z;
                const d = Math.hypot(dx, dz);
                if (d < volume.r) {
                    if (d > 1e-5) {
                        out.x = volume.x + (dx / d) * volume.r;
                        out.z = volume.z + (dz / d) * volume.r;
                    } else {
                        out.z = volume.z + volume.r;
                    }
                }
            }
        }
    }
    // The panel: a wall from the floor to the top with the gate hole. Not enterable unless the gate is open and the camera is in the hole.
    const panelHalfW = 5.2;
    if (Math.abs(out.x) < panelHalfW + 0.3 && Math.abs(out.z - PANEL_Z) < 0.9) {
        if (!(gateOpen && inGateHole(out))) {
            out.z = out.z >= PANEL_Z ? PANEL_Z + 0.9 : PANEL_Z - 0.9;
            if (!gateOpen) out.z = PANEL_Z + 0.9;
        }
    }
    return out;
};

export const isInsideKeepOut = (p: Vec3, gateOpen = false): boolean => {
    const b = hallBounds(p, gateOpen);
    if (p.x < b.minX - 1e-6 || p.x > b.maxX + 1e-6 || p.z < b.minZ - 1e-6 || p.z > b.maxZ + 1e-6) return true;
    if (p.y < CAMERA_MIN_Y - 1e-6 || p.y > CAMERA_MAX_Y + 1e-6) return true;
    for (const volume of KEEP_OUTS) {
        if (volume.kind === 'sphere') {
            if (Math.hypot(p.x - volume.c.x, p.y - volume.c.y, p.z - volume.c.z) < volume.r - 1e-6) return true;
        } else if (volume.kind === 'cylinderY') {
            if (p.y >= volume.y0 && p.y <= volume.y1 && Math.hypot(p.x - volume.x, p.z - volume.z) < volume.r - 1e-6) return true;
        }
    }
    return false;
};
