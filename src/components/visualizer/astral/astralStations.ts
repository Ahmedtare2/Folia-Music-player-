import { isInsideKeepOut, keepCameraOut, PLANETS, type Vec3 } from './astralSceneLayout';

// src/components/visualizer/astral/astralStations.ts
// "Line stations": named figures of the hall. Each sung line is given one station and the camera travels to it in a curved
// approach, arrives as the line starts and then drifts slowly. Pure data and maths, no clock and no three.js.

export interface Station {
    id: string;
    focus: Vec3;
    /** Radius of the glow ring that marks the station while its line is sung. */
    ring: number;
    /** Camera distance from the focus at arrival. */
    distance: number;
    /** Where the camera stands, in degrees away from straight in front (+z); positive is towards +x. */
    azimuth: number;
    /** Camera height relative to the focus. */
    lift: number;
}

const planet = (id: string, distance: number, azimuth: number, lift: number): Station => {
    const p = PLANETS.find(item => item.id === id)!;
    return { id, focus: { ...p.position }, ring: p.radius * 1.35, distance: p.radius * 2.6 + distance, azimuth, lift };
};

/** The new procedural figures live here so the world and the camera agree on where they stand. */
export const FIGURES = {
    telescope: { x: 9.8, z: 15 },
    statueLeft: { x: -4.6, z: 14 },
    statueRight: { x: 4.6, z: 14 },
    constellation: { x: -5.5, y: 8.5, z: 6 },
} as const;

export const STATIONS: readonly Station[] = [
    { id: 'orrery', focus: { x: 0, y: 6.4, z: 0 }, ring: 4.2, distance: 17, azimuth: 0, lift: -3.4 },
    { id: 'armillary', focus: { x: 0, y: 6.1, z: 0 }, ring: 2.6, distance: 9.5, azimuth: 24, lift: 1.4 },
    { id: 'gate', focus: { x: 0, y: 6.4, z: -3 }, ring: 4.6, distance: 15, azimuth: -10, lift: -2.2 },
    { id: 'oculus', focus: { x: 0, y: 13.4, z: -2.7 }, ring: 1.3, distance: 11, azimuth: 14, lift: -9 },
    planet('neptune', 3, -18, 0),
    planet('saturn', 3, 22, 0.5),
    planet('jupiter', 4, -8, -4),
    planet('mars', 3, 30, 1),
    planet('moon', 3, -35, 0.6),
    planet('amber', 4, 15, -6),
    planet('colossus', 1, -30, 1),
    { id: 'miniLeft', focus: { x: -6.2, y: 6.6, z: -1.4 }, ring: 1.3, distance: 6.5, azimuth: -20, lift: 0.6 },
    { id: 'miniRight', focus: { x: 6.2, y: 6.6, z: -1.4 }, ring: 1.3, distance: 6.5, azimuth: 20, lift: 0.6 },
    { id: 'telescope', focus: { x: FIGURES.telescope.x, y: 3.6, z: FIGURES.telescope.z }, ring: 2.4, distance: 8.5, azimuth: -28, lift: 0.4 },
    { id: 'statueLeft', focus: { x: FIGURES.statueLeft.x, y: 3.6, z: FIGURES.statueLeft.z }, ring: 2.2, distance: 8, azimuth: 28, lift: 0.2 },
    { id: 'statueRight', focus: { x: FIGURES.statueRight.x, y: 3.6, z: FIGURES.statueRight.z }, ring: 2.2, distance: 8, azimuth: -28, lift: 0.2 },
    { id: 'constellation', focus: { ...FIGURES.constellation }, ring: 2.3, distance: 8.5, azimuth: 32, lift: -0.6 },
];

export const HOME_STATION = 'orrery';

export const stationById = (id: string | undefined): Station => STATIONS.find(s => s.id === id) ?? STATIONS[0]!;

const rad = (deg: number) => (deg * Math.PI) / 180;
/** Push a camera spot out of every solid; if the pushes fight each other, slide it towards the open middle of the hall. */
const settle = (p: Vec3): Vec3 => {
    let q = { ...p };
    for (let i = 0; i < 12 && isInsideKeepOut(q, false); i += 1) {
        q = keepCameraOut(q, false);
        if (isInsideKeepOut(q, false)) q = { x: q.x * 0.8, y: q.y, z: q.z + (21 - q.z) * 0.15 };
    }
    return q;
};
const around = (s: Station, azimuthDeg: number, scale: number, lift: number): Vec3 => {
    const a = rad(azimuthDeg);
    // Keep the whole approach inside the middle of the hall, so the camera never hugs a wall or a figure beside it.
    const x = s.focus.x + Math.sin(a) * s.distance * scale;
    const z = s.focus.z + Math.cos(a) * s.distance * scale;
    return settle({ x: Math.min(7, Math.max(-7, x)), y: Math.min(17, Math.max(1.6, s.focus.y + lift)), z: Math.min(26, z) });
};

export interface StationKey { p: Vec3; t: Vec3 }

/** Camera keys of a station shot: a wide curved approach from one side, the arrival framing, then a slow drift on the other side. */
export const stationKeys = (id: string | undefined, side: 1 | -1, variation: number): StationKey[] => {
    const s = stationById(id);
    const az = s.azimuth * (variation > 0.5 ? 1 : -1) * 0.8;
    const t = s.focus;
    const wobble = (variation - 0.5) * 6;
    return [
        { p: around(s, az + side * 55, 1.55, s.lift + 2.8), t: { x: t.x, y: t.y, z: t.z } },
        { p: around(s, az + side * 28, 1.22, s.lift + 1.2), t },
        { p: around(s, az, 1, s.lift + wobble * 0.1), t },
        { p: around(s, az - side * 6, 0.93, s.lift - 0.2), t },
        { p: around(s, az - side * 10, 0.9, s.lift - 0.35), t },
    ];
};

/** The shot's focus marker: where the glow ring sits while the station's line is sung. */
export const stationFocus = (id: string | undefined) => {
    const s = stationById(id);
    return { x: s.focus.x, y: s.focus.y, z: s.focus.z, r: s.ring };
};

/** Pick a station for a segment: never one of the last three, preferring a different neighbourhood than the previous one. */
export const pickStation = (hash: number, recent: readonly string[], isHome: boolean): string => {
    if (isHome) return HOME_STATION;
    const pool = STATIONS.filter(s => s.id !== HOME_STATION && !recent.includes(s.id));
    return pool[hash % pool.length]!.id;
};
