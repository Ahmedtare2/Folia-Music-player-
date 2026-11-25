import * as THREE from 'three';
import {
    COLONNADE_X, COLUMN_COUNT, columnZ, GATE, GATE_HOLE_RADIUS, GATE_OUTER_RADIUS, PANEL_Z, PASSAGE_END_Z, PLANETS,
    STAR_POS, VAULT_RADIUS, VAULT_SPRING_Y, GALLERY_CENTER, type PlanetSpec,
} from './astralSceneLayout';
import {
    createDialTexture, createGlowTexture, createGlyphBandTexture, createNumeralRingTexture, createRingStripeTexture,
} from './astralEngraving';
import { FIGURES } from './astralStations';
import { createPlanetMaterials, type PlanetMaterials } from './astralPlanetMaterials';

// src/components/visualizer/astral/astralWorld.ts
// The Grand Orrery Hall as one imperative three.js scene graph: built once for a quality level, then moved by update().
// Everything is original procedural geometry (lathe, cylinder, torus, box, instanced meshes, line segments, points). It
// never reads React state and never allocates inside update(). The React wrapper only mounts `root` and calls update().

export type AstralQuality = 'economy' | 'balanced' | 'high';

export interface AstralWorldOptions {
    quality: AstralQuality;
    /** A small preview builds only zone A. */
    preview: boolean;
}

export interface AstralAudioFrame {
    bass: number; lowMid: number; mid: number; vocal: number; treble: number; power: number;
    /** 0..1 pulse that jumps on a bass hit and falls away. */
    kick: number;
    /** 0..1 pulse from the Smart Beat orbital pulse effect (0 when it is off). */
    beat: number;
}

export interface AstralWorldFrame {
    /** Playback seconds. All procedural motion is a function of it, so a pause stops the hall and a seek moves it. */
    time: number;
    dt: number;
    audio: AstralAudioFrame;
    camera: { x: number; y: number; z: number };
    /** 0 closed .. 1 fully open. */
    gateOpen: number;
    orbitalActivity: number;
    atmosphere: number;
    reactivity: number;
    /** Static mode: hero composition, nothing animates. */
    still: boolean;
    /** The station whose line is sung: a glow ring locks onto it. Strength 0 hides it. */
    cameraQuaternion?: THREE.Quaternion;
    focus?: { x: number; y: number; z: number; r: number; strength: number };
}

interface Detail {
    radial: number; tubular: number; columns: boolean; fans: number; stars: number; dust: number; planetDetail: number;
    ribs: number; teeth: number; extraOrrery: boolean; passageRings: number; lights: boolean;
}

const DETAIL: Record<AstralQuality, Detail> = {
    economy: { radial: 20, tubular: 40, columns: false, fans: 0, stars: 500, dust: 50, planetDetail: 3, ribs: 9, teeth: 20, extraOrrery: false, passageRings: 8, lights: false },
    balanced: { radial: 36, tubular: 72, columns: true, fans: 30, stars: 1100, dust: 110, planetDetail: 4, ribs: 14, teeth: 32, extraOrrery: false, passageRings: 12, lights: true },
    high: { radial: 56, tubular: 110, columns: true, fans: 60, stars: 2000, dust: 220, planetDetail: 5, ribs: 18, teeth: 48, extraOrrery: true, passageRings: 16, lights: true },
};

export interface AstralWorld {
    root: THREE.Group;
    update: (frame: AstralWorldFrame) => void;
    /** Build the environment map from the renderer once (small, one time). */
    init: (renderer: THREE.WebGLRenderer) => void;
    dispose: () => void;
    readonly stats: { meshes: number; drawCallsEstimate: number };
}

const rand = (seed: number) => {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
};

const UP = new THREE.Vector3(0, 1, 0);

export const createAstralWorld = (options: AstralWorldOptions): AstralWorld => {
    const d = DETAIL[options.quality];
    const root = new THREE.Group();
    root.name = 'astral-world';
    const disposables: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(item: T): T => { disposables.push(item); return item; };
    let meshCount = 0;
    const addMesh = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[]) => {
        const mesh = new THREE.Mesh(geometry, material);
        parent.add(mesh);
        meshCount += 1;
        return mesh;
    };

    // ── Materials ───────────────────────────────────────────────────────────────────────────────
    const brass = track(new THREE.MeshStandardMaterial({ color: '#b08a4a', metalness: 0.92, roughness: 0.36 }));
    const brassBright = track(new THREE.MeshStandardMaterial({ color: '#cfae6e', metalness: 0.95, roughness: 0.28, emissive: '#2a1a04', emissiveIntensity: 0.35 }));
    const slate = track(new THREE.MeshStandardMaterial({ color: '#2f3547', metalness: 0.15, roughness: 0.78 }));
    const slateBlue = track(new THREE.MeshStandardMaterial({ color: '#121a33', metalness: 0.2, roughness: 0.62 }));
    const darkStone = track(new THREE.MeshStandardMaterial({ color: '#0a0e1a', metalness: 0.55, roughness: 0.32 }));
    const glow = createGlowTexture();
    disposables.push(glow);
    const bandTex = createGlyphBandTexture(1024, 96);
    disposables.push(bandTex.map, bandTex.emissive);
    const enamelLower = track(new THREE.MeshStandardMaterial({ color: '#ffffff', map: bandTex.map, emissiveMap: bandTex.emissive, emissive: '#ffffff', emissiveIntensity: 0.9, metalness: 0.35, roughness: 0.28 }));
    const enamelUpper = enamelLower.clone();
    track(enamelUpper);
    const starMaterial = track(new THREE.MeshBasicMaterial({ color: '#fff4d6' }));
    const glowSprite = (color: string, scale: number, opacity: number) => {
        const sprite = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glow, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
        sprite.scale.set(scale, scale, 1);
        return sprite;
    };

    // ── Light ───────────────────────────────────────────────────────────────────────────────────
    const hemi = new THREE.HemisphereLight('#3a58a0', '#04060c', 0.32);
    root.add(hemi);
    const key = new THREE.DirectionalLight('#ffe2b8', 1.5);
    key.position.set(-5, 15, 22);
    root.add(key, key.target);
    const rim = new THREE.DirectionalLight('#6f9cff', 1.1);
    rim.position.set(8, 8, -12);
    root.add(rim);
    const starLight = new THREE.PointLight('#ffe8b8', 120, 26, 2);
    starLight.position.set(STAR_POS.x, STAR_POS.y, STAR_POS.z);
    root.add(starLight);
    const fillLight = d.lights ? new THREE.PointLight('#8ab0ff', 22, 24, 2) : null;
    if (fillLight) { fillLight.position.set(0, 9, 13); root.add(fillLight); }

    let constellation: THREE.Group | null = null;
    const fog = new THREE.FogExp2('#030612', 0.013);

    // ── Backdrop dome (deep navy gradient) ──────────────────────────────────────────────────────
    const domeMaterial = track(new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'varying vec3 vP; void main(){ float h = vP.y*0.5+0.5; vec3 lo = vec3(0.0015,0.003,0.009); vec3 mid = vec3(0.004,0.009,0.028); vec3 hi = vec3(0.0015,0.003,0.01); vec3 c = mix(lo, mid, smoothstep(0.1,0.55,h)); c = mix(c, hi, smoothstep(0.55,1.0,h)); gl_FragColor = vec4(c,1.0); \n#include <colorspace_fragment>\n\n}',
    }));
    const dome = addMesh(root, track(new THREE.SphereGeometry(180, 24, 16)), domeMaterial);
    dome.renderOrder = -10;

    // ── Zone A: floor, plinth ───────────────────────────────────────────────────────────────────
    const zoneA = new THREE.Group();
    zoneA.name = 'zone-a';
    root.add(zoneA);
    const floor = addMesh(zoneA, track(new THREE.PlaneGeometry(60, 90)), darkStone);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -6);
    const stepGeo = track(new THREE.BoxGeometry(1, 1, 1));
    const addStep = (w: number, h: number, z: number, depth: number, y: number, mat: THREE.Material) => {
        const s = addMesh(zoneA, stepGeo, mat);
        s.scale.set(w, h, depth);
        s.position.set(0, y + h / 2, z);
        return s;
    };
    addStep(19, 0.22, 4.2, 18, 0, darkStone);
    addStep(15, 0.22, 3.4, 13, 0.22, slateBlue);
    addStep(11.5, 0.2, 0.6, 9.5, 0.44, slate);
    // Brass inlay lines in the floor, running down the axis.
    for (const x of [-0.9, 0.9]) {
        const inlay = addMesh(zoneA, stepGeo, brass);
        inlay.scale.set(0.05, 0.02, 50);
        inlay.position.set(x, 0.02, 8);
    }

    // ── Colonnades and vault ────────────────────────────────────────────────────────────────────
    const shaftGeo = track(new THREE.CylinderGeometry(0.34, 0.4, VAULT_SPRING_Y, d.columns ? 20 : 10));
    const baseGeo = track(new THREE.BoxGeometry(1.2, 1.1, 1.2));
    const capGeo = track(new THREE.BoxGeometry(1.0, 0.5, 1.0));
    const colCount = COLUMN_COUNT * 2;
    const shafts = new THREE.InstancedMesh(shaftGeo, brass, colCount);
    const bases = new THREE.InstancedMesh(baseGeo, slate, colCount);
    const caps = new THREE.InstancedMesh(capGeo, brassBright, colCount);
    const tmp = new THREE.Object3D();
    let ci = 0;
    for (const side of [-1, 1]) {
        for (let i = 0; i < COLUMN_COUNT; i += 1) {
            const x = side * COLONNADE_X;
            const z = columnZ(i);
            tmp.rotation.set(0, 0, 0);
            tmp.scale.set(1, 1, 1);
            tmp.position.set(x, VAULT_SPRING_Y / 2 + 0.6, z); tmp.updateMatrix(); shafts.setMatrixAt(ci, tmp.matrix);
            tmp.position.set(x, 0.55, z); tmp.updateMatrix(); bases.setMatrixAt(ci, tmp.matrix);
            tmp.position.set(x, VAULT_SPRING_Y + 0.85, z); tmp.updateMatrix(); caps.setMatrixAt(ci, tmp.matrix);
            ci += 1;
        }
    }
    zoneA.add(shafts, bases, caps);
    meshCount += 3;
    for (const side of [-1, 1]) {
        const entablature = addMesh(zoneA, stepGeo, slate);
        entablature.scale.set(1.5, 1.3, 34);
        entablature.position.set(side * COLONNADE_X, VAULT_SPRING_Y + 1.8, 11);
        const trim = addMesh(zoneA, stepGeo, brass);
        trim.scale.set(1.7, 0.18, 34.4);
        trim.position.set(side * COLONNADE_X, VAULT_SPRING_Y + 2.55, 11);
        const baseRail = addMesh(zoneA, stepGeo, slate);
        baseRail.scale.set(0.5, 0.5, 34);
        baseRail.position.set(side * (COLONNADE_X - 0.3), 0.25, 11);
    }
    // Barrel vault: concentric golden arch ribs receding into the dark.
    const ribGeo = track(new THREE.TorusGeometry(VAULT_RADIUS, 0.2, 6, d.tubular, Math.PI));
    const ribs = new THREE.InstancedMesh(ribGeo, brass, d.ribs);
    for (let i = 0; i < d.ribs; i += 1) {
        tmp.position.set(0, VAULT_SPRING_Y, 25 - i * (30 / d.ribs));
        tmp.rotation.set(0, 0, 0);
        const shrink = 1 - 0.015 * i;
        tmp.scale.set(shrink, shrink, 1);
        tmp.updateMatrix();
        ribs.setMatrixAt(i, tmp.matrix);
    }
    zoneA.add(ribs);
    meshCount += 1;
    // Cornice frieze across the top centre.
    const frieze = addMesh(zoneA, stepGeo, slate);
    frieze.scale.set(9.6, 0.9, 1.0);
    frieze.position.set(0, 16.1, PANEL_Z + 0.2);
    const friezeTrim = addMesh(zoneA, stepGeo, brass);
    friezeTrim.scale.set(10.0, 0.15, 1.2);
    friezeTrim.position.set(0, 16.65, PANEL_Z + 0.2);
    const dentilGeo = track(new THREE.BoxGeometry(0.16, 0.28, 0.3));
    const dentils = new THREE.InstancedMesh(dentilGeo, brass, 36);
    for (let i = 0; i < 36; i += 1) {
        tmp.position.set(-4.4 + i * (8.8 / 35), 15.55, PANEL_Z + 0.78);
        tmp.rotation.set(0, 0, 0); tmp.scale.set(1, 1, 1); tmp.updateMatrix();
        dentils.setMatrixAt(i, tmp.matrix);
    }
    zoneA.add(dentils);

    // ── Backdrop panel with the gate hole ───────────────────────────────────────────────────────
    const panelShape = new THREE.Shape();
    const PW = 5.2;
    const PH = 15.4;
    panelShape.moveTo(-PW, 0); panelShape.lineTo(PW, 0); panelShape.lineTo(PW, PH); panelShape.lineTo(-PW, PH); panelShape.closePath();
    const hole = new THREE.Path();
    hole.absarc(GATE.x, GATE.y, GATE_HOLE_RADIUS, 0, Math.PI * 2, true);
    panelShape.holes.push(hole);
    const panelGeo = track(new THREE.ExtrudeGeometry(panelShape, { depth: 0.7, bevelEnabled: false, curveSegments: d.radial }));
    const panelMaterial = track(new THREE.MeshStandardMaterial({ color: '#4a5066', metalness: 0.08, roughness: 0.86 }));
    const panel = addMesh(zoneA, panelGeo, panelMaterial);
    panel.position.set(0, 0, PANEL_Z);
    const panelTrim = addMesh(zoneA, stepGeo, brass);
    panelTrim.scale.set(PW * 2 + 0.3, 0.22, 0.95);
    panelTrim.position.set(0, 0.5, PANEL_Z + 0.35);
    const panelFoot = addMesh(zoneA, stepGeo, darkStone);
    panelFoot.scale.set(PW * 2, 0.5, 0.9);
    panelFoot.position.set(0, 0.25, PANEL_Z + 0.35);
    // The portal: what fills the hole while the gate is closed. It is the same slate as the panel, with a luminous centre.
    const portalMaterial = track(new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uOpen: { value: 0 }, uPulse: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `varying vec2 vUv; uniform float uOpen; uniform float uPulse;
        void main(){ vec2 p = vUv - 0.5; float r = length(p) * 2.0;
            vec3 slateC = vec3(0.085, 0.095, 0.135);
            vec3 core = vec3(1.0, 0.86, 0.55);
            vec3 c = mix(slateC, core, smoothstep(0.9, 0.0, r) * (0.1 + 0.9 * uOpen) + uPulse * 0.08);
            float a = (1.0 - smoothstep(0.55, 1.0, uOpen)) * step(r, 1.0);
            gl_FragColor = vec4(c, a); \n#include <colorspace_fragment>\n }`,
    }));
    const portal = addMesh(zoneA, track(new THREE.CircleGeometry(GATE_HOLE_RADIUS + 0.02, d.radial)), portalMaterial);
    portal.position.set(GATE.x, GATE.y, PANEL_Z + 0.35);
    portal.renderOrder = 2;
    // Oculus above the gate.
    const oculusRing = addMesh(zoneA, track(new THREE.TorusGeometry(0.85, 0.09, 10, d.radial)), brass);
    oculusRing.position.set(0, 13.4, PANEL_Z + 0.72);
    const oculusDisc = addMesh(zoneA, track(new THREE.CircleGeometry(0.78, d.radial)), track(new THREE.MeshStandardMaterial({ color: '#05070d', roughness: 0.4, metalness: 0.5 })));
    oculusDisc.position.set(0, 13.4, PANEL_Z + 0.73);
    const oculusStar = glowSprite('#cfe0ff', 0.9, 0.7);
    oculusStar.position.set(0, 13.4, PANEL_Z + 0.8);
    zoneA.add(oculusStar);

    // ── Astral Gate: concentric mechanical rings ────────────────────────────────────────────────
    const gate = new THREE.Group();
    gate.position.set(GATE.x, GATE.y, PANEL_Z + 0.72);
    zoneA.add(gate);
    const numeralTex = createNumeralRingTexture(1024, GATE_HOLE_RADIUS / GATE_OUTER_RADIUS);
    disposables.push(numeralTex);
    const numeralMat = track(new THREE.MeshStandardMaterial({ map: numeralTex, color: '#ffffff', metalness: 0.7, roughness: 0.42, side: THREE.DoubleSide }));
    const numeralRing = addMesh(gate, track(new THREE.RingGeometry(GATE_HOLE_RADIUS, GATE_OUTER_RADIUS, d.radial * 2, 1)), numeralMat);
    // RingGeometry UVs are planar (u,v from x,y), exactly what the square annulus texture expects.
    const innerToothed = new THREE.Group();
    gate.add(innerToothed);
    innerToothed.position.z = 0.1;
    addMesh(innerToothed, track(new THREE.TorusGeometry(GATE_HOLE_RADIUS - 0.18, 0.1, 8, d.radial * 2)), brassBright);
    const toothGeo = track(new THREE.BoxGeometry(0.16, 0.3, 0.14));
    const teeth = new THREE.InstancedMesh(toothGeo, brass, d.teeth);
    for (let i = 0; i < d.teeth; i += 1) {
        const a = (i / d.teeth) * Math.PI * 2;
        tmp.position.set(Math.cos(a) * (GATE_HOLE_RADIUS - 0.42), Math.sin(a) * (GATE_HOLE_RADIUS - 0.42), 0);
        tmp.rotation.set(0, 0, a + Math.PI / 2); tmp.scale.set(1, 1, 1); tmp.updateMatrix();
        teeth.setMatrixAt(i, tmp.matrix);
    }
    innerToothed.add(teeth);
    const counterRing = new THREE.Group();
    gate.add(counterRing);
    counterRing.position.z = 0.16;
    addMesh(counterRing, track(new THREE.TorusGeometry(GATE_HOLE_RADIUS - 0.7, 0.045, 6, d.radial * 2)), brassBright);
    const spokeGeo = track(new THREE.BoxGeometry(0.05, GATE_HOLE_RADIUS * 0.45, 0.04));
    for (let i = 0; i < 4; i += 1) {
        const spoke = addMesh(counterRing, spokeGeo, brass);
        spoke.rotation.z = (i / 4) * Math.PI * 2;
        spoke.position.set(-Math.sin(spoke.rotation.z) * (GATE_HOLE_RADIUS - 0.7 - GATE_HOLE_RADIUS * 0.22), Math.cos(spoke.rotation.z) * (GATE_HOLE_RADIUS - 0.7 - GATE_HOLE_RADIUS * 0.22), 0);
    }
    const outerEdge = addMesh(gate, track(new THREE.TorusGeometry(GATE_OUTER_RADIUS, 0.12, 8, d.radial * 2)), brassBright);
    outerEdge.position.z = 0.04;
    const innerEdge = addMesh(gate, track(new THREE.TorusGeometry(GATE_HOLE_RADIUS, 0.08, 8, d.radial * 2)), brass);
    innerEdge.position.z = 0.04;
    const gateGlow = glowSprite('#ffe3a8', GATE_OUTER_RADIUS * 2.4, 0.0);
    gateGlow.position.z = 0.3;
    gate.add(gateGlow);

    // ── Sunburst fans ───────────────────────────────────────────────────────────────────────────
    let fanMaterial: THREE.LineBasicMaterial | null = null;
    if (d.fans > 0) {
        fanMaterial = track(new THREE.LineBasicMaterial({ color: '#b9c8e6', transparent: true, opacity: 0.5, fog: false }));
        for (const side of [-1, 1]) {
            const positions: number[] = [];
            for (let i = 0; i < d.fans; i += 1) {
                const t = i / (d.fans - 1);
                const a = (-0.5 + t) * Math.PI * 0.78;
                const dirX = Math.cos(a) * side;
                const dirY = Math.sin(a);
                const r0 = 0.5 + (i % 2) * 0.5;
                const r1 = 6.5 + ((i * 7) % 5) * 0.6;
                positions.push(dirX * r0, dirY * r0, 0, dirX * r1, dirY * r1, 0);
            }
            const geo = track(new THREE.BufferGeometry());
            geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            const lines = new THREE.LineSegments(geo, fanMaterial);
            lines.position.set(side * (PW + 0.6), 7.4, PANEL_Z - 0.2);
            zoneA.add(lines);
            meshCount += 1;
        }
    }

    // ── The orrery ──────────────────────────────────────────────────────────────────────────────
    const orrery = new THREE.Group();
    zoneA.add(orrery);
    const lathe = (points: [number, number][], segments: number, material: THREE.Material) => addMesh(orrery, track(new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments)), material);
    const baseDrums = new THREE.Group();
    orrery.add(baseDrums);
    const addLathe = (target: THREE.Group, points: [number, number][], material: THREE.Material) => addMesh(target, track(new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), d.radial)), material);
    addLathe(baseDrums, [[0, 0.64], [3.15, 0.64], [3.15, 0.8], [3.0, 0.86], [3.0, 1.2], [3.2, 1.24], [3.2, 1.36], [2.9, 1.4], [2.9, 1.55], [0, 1.55]], brass);
    // Lower enamel band wraps the lower drum.
    const lowerBand = addMesh(baseDrums, track(new THREE.CylinderGeometry(2.62, 2.62, 0.54, d.radial * 2, 1, true)), enamelLower);
    lowerBand.position.y = 1.7;
    addLathe(baseDrums, [[0, 1.98], [2.7, 1.98], [2.78, 2.04], [2.78, 2.1], [2.5, 2.16], [2.5, 2.4], [0, 2.4]], brassBright);
    lathe([[0.001, 0.2], [3.7, 0.2], [3.7, 0.4], [3.45, 0.46], [3.45, 0.64]], d.radial, brass).position.y = 0;
    void lathe;
    // Central shaft and dial.
    const shaft = addMesh(orrery, track(new THREE.CylinderGeometry(0.16, 0.16, 4.2, 14)), brassBright);
    shaft.position.y = 4.4;
    const dialTex = createDialTexture(512);
    disposables.push(dialTex);
    const dialGroup = new THREE.Group();
    dialGroup.position.set(0, 3.2, 0.55);
    orrery.add(dialGroup);
    const dialFace = addMesh(dialGroup, track(new THREE.CircleGeometry(1.2, d.radial)), track(new THREE.MeshStandardMaterial({ map: dialTex, metalness: 0.3, roughness: 0.5, emissive: '#1a2240', emissiveIntensity: 0.4, emissiveMap: dialTex })));
    const dialRim = addMesh(dialGroup, track(new THREE.TorusGeometry(1.2, 0.1, 10, d.radial)), brassBright);
    dialRim.position.z = 0.02;
    const dialHand = addMesh(dialGroup, track(new THREE.BoxGeometry(0.035, 0.8, 0.02)), brassBright);
    dialHand.position.set(0, 0.3, 0.03);
    const dialHandPivot = new THREE.Group();
    dialGroup.add(dialHandPivot);
    dialHandPivot.add(dialHand);
    dialFace.position.z = 0.01;
    // Six columns on a hexagon, each on a small square slate base.
    const colGeo = track(new THREE.CylinderGeometry(0.12, 0.12, 2.65, 12));
    const colBase = track(new THREE.BoxGeometry(0.5, 0.36, 0.5));
    const colCap = track(new THREE.BoxGeometry(0.34, 0.14, 0.34));
    for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const x = Math.cos(a) * 1.95;
        const z = Math.sin(a) * 1.95;
        const col = addMesh(orrery, colGeo, brassBright); col.position.set(x, 3.7, z);
        const b = addMesh(orrery, colBase, slateBlue); b.position.set(x, 2.58, z);
        const c = addMesh(orrery, colCap, brass); c.position.set(x, 5.1, z);
    }
    // Upper platform with its own glyph band.
    const upper = new THREE.Group();
    orrery.add(upper);
    addLathe(upper, [[0, 5.12], [2.45, 5.12], [2.55, 5.2], [2.55, 5.26], [2.3, 5.32], [2.3, 5.5], [0, 5.5]], brassBright);
    const upperBand = addMesh(upper, track(new THREE.CylinderGeometry(2.5, 2.5, 0.34, d.radial * 2, 1, true)), enamelUpper);
    upperBand.position.y = 5.22;
    addLathe(upper, [[0, 5.5], [1.2, 5.5], [1.0, 5.62], [0.3, 5.7], [0, 5.7]], brass);
    // Armillary sphere: tilted rings, a white-gold star, small planets on thin arms.
    const armillary = new THREE.Group();
    armillary.position.set(STAR_POS.x, STAR_POS.y, STAR_POS.z);
    orrery.add(armillary);
    const ringTilts: [number, number, number][] = [[Math.PI / 2, 0, 0], [0.4, 0, 0.5], [-0.55, 0.9, 0.2], [0.2, 0, -1.0], [Math.PI / 2, 0, 0]];
    const ringRadii = [1.55, 1.38, 1.22, 1.05, 0.7];
    const armRings: THREE.Mesh[] = [];
    ringTilts.forEach((tilt, i) => {
        const ring = addMesh(armillary, track(new THREE.TorusGeometry(ringRadii[i]!, i === 0 ? 0.045 : 0.03, 8, d.radial * 2)), i % 2 === 0 ? brassBright : brass);
        ring.rotation.set(tilt[0], tilt[1], tilt[2]);
        armRings.push(ring);
    });
    const starMesh = addMesh(armillary, track(new THREE.SphereGeometry(0.3, 24, 16)), starMaterial);
    const starGlow = glowSprite('#fff0c8', 2.6, 0.85);
    armillary.add(starGlow);
    const orbiters = new THREE.Group();
    armillary.add(orbiters);
    const orbiterSpecs: { r: number; size: number; color: string; speed: number; phase: number }[] = [
        { r: 0.62, size: 0.1, color: '#ccd2dc', speed: 1.7, phase: 0 },
        { r: 0.88, size: 0.14, color: '#c46a44', speed: 1.1, phase: 2.0 },
        { r: 1.12, size: 0.2, color: '#d6b480', speed: 0.7, phase: 4.1 },
        { r: 1.34, size: 0.12, color: '#6f98e8', speed: 0.45, phase: 1.1 },
    ];
    const orbiterMeshes: THREE.Mesh[] = [];
    const orbiterGeo = track(new THREE.SphereGeometry(1, 14, 10));
    orbiterSpecs.forEach(spec => {
        const m = addMesh(orbiters, orbiterGeo, track(new THREE.MeshStandardMaterial({ color: spec.color, metalness: 0.2, roughness: 0.55, emissive: spec.color, emissiveIntensity: 0.18 })));
        m.scale.setScalar(spec.size);
        orbiterMeshes.push(m);
        const armGeo = track(new THREE.CylinderGeometry(0.01, 0.01, 1, 4));
        armGeo.translate(0, 0.5, 0);
        const arm = addMesh(orbiters, armGeo, brass);
        orbiterMeshes.push(arm);
    });

    // ── Flanking mini orreries ──────────────────────────────────────────────────────────────────
    const miniSpheres: THREE.Group[] = [];
    const pillarGeo = track(new THREE.BoxGeometry(1.0, 5.2, 1.0));
    const pillarBase = track(new THREE.BoxGeometry(1.7, 0.6, 1.7));
    const miniRingGeo = track(new THREE.TorusGeometry(0.62, 0.025, 6, 30));
    const miniStar = track(new THREE.SphereGeometry(0.11, 12, 8));
    for (const side of [-1, 1]) {
        const g = new THREE.Group();
        g.position.set(side * 6.2, 0, -1.4);
        zoneA.add(g);
        const pillar = addMesh(g, pillarGeo, slateBlue); pillar.position.y = 3.4;
        const pb = addMesh(g, pillarBase, slate); pb.position.y = 0.55;
        const cap = addMesh(g, track(new THREE.CylinderGeometry(0.7, 0.55, 0.3, 14)), brassBright); cap.position.y = 6.15;
        const lamp = new THREE.Group();
        lamp.position.y = 7.0;
        g.add(lamp);
        [[0, 0, 0], [Math.PI / 2, 0, 0], [0.7, 0.8, 0]].forEach(r => {
            const ring = addMesh(lamp, miniRingGeo, brassBright);
            ring.rotation.set(r[0]!, r[1]!, r[2]!);
        });
        addMesh(lamp, miniStar, starMaterial);
        const lampGlow = glowSprite('#fff0c8', 2.0, 0.8);
        lamp.add(lampGlow);
        miniSpheres.push(lamp);
        const stand = addMesh(g, track(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6)), brass); stand.position.y = 6.5;
    }

    // ── Planets ─────────────────────────────────────────────────────────────────────────────────
    const planetMaterials: PlanetMaterials = createPlanetMaterials(d.planetDetail);
    disposables.push(planetMaterials);
    const sphereHi = track(new THREE.SphereGeometry(1, d.radial + 8, d.radial));
    const sphereLo = track(new THREE.SphereGeometry(1, 16, 12));
    const planetMeshes: { mesh: THREE.Mesh; spec: PlanetSpec; zone: 'a' | 'b' | 'c' }[] = [];
    const zoneB = new THREE.Group();
    zoneB.name = 'zone-b';
    const zoneC = new THREE.Group();
    zoneC.name = 'zone-c';
    root.add(zoneB, zoneC);
    const ringStripe = createRingStripeTexture();
    disposables.push(ringStripe);
    PLANETS.forEach(spec => {
        const zone: 'a' | 'b' | 'c' = spec.position.z < -70 ? 'c' : spec.position.z < -6 ? 'b' : 'a';
        if (options.preview && zone !== 'a') return;
        const parent = zone === 'a' ? zoneA : zone === 'b' ? zoneB : zoneC;
        const mesh = addMesh(parent, spec.radius > 1.5 ? sphereHi : sphereLo, planetMaterials.byKind.get(spec.kind)!);
        mesh.scale.setScalar(spec.radius);
        mesh.position.set(spec.position.x, spec.position.y, spec.position.z);
        mesh.rotation.set(0.3, spec.seedOffset * 6, 0.15);
        if (spec.kind === 'ringed') {
            const ring = addMesh(mesh, track(new THREE.RingGeometry(1.45, 2.4, 72, 1)), track(new THREE.MeshBasicMaterial({ map: ringStripe, transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.9, fog: false })));
            // Radial stripe mapping: u from the distance to the centre.
            const uv = ring.geometry.attributes.uv!;
            const pos = ring.geometry.attributes.position!;
            for (let i = 0; i < uv.count; i += 1) {
                const r = Math.hypot(pos.getX(i), pos.getY(i));
                uv.setXY(i, (r - 1.45) / (2.4 - 1.45), 0.5);
            }
            ring.rotation.x = Math.PI / 2 - 0.1;
            ring.rotation.z = 0.25;
        }
        planetMeshes.push({ mesh, spec, zone });
    });

    // ── Stars and dust ──────────────────────────────────────────────────────────────────────────
    const r = rand(20260);
    const starPos = new Float32Array(d.stars * 3);
    const starSize = new Float32Array(d.stars);
    for (let i = 0; i < d.stars; i += 1) {
        const u = r() * 2 - 1;
        const a = r() * Math.PI * 2;
        const rad = 90 + r() * 70;
        const s = Math.sqrt(1 - u * u);
        starPos[i * 3] = Math.cos(a) * s * rad;
        starPos[i * 3 + 1] = u * rad;
        starPos[i * 3 + 2] = Math.sin(a) * s * rad;
        starSize[i] = 0.5 + r() * r() * 2.2;
    }
    const starGeo = track(new THREE.BufferGeometry());
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSize, 1));
    const starPoints = track(new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uTreble: { value: 0 }, uScale: { value: 1 } },
        vertexShader: 'attribute float aSize; uniform float uTime; uniform float uTreble; uniform float uScale; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); float tw = 0.75 + 0.25*sin(uTime*1.3 + position.x*0.37 + position.y*0.91); vA = tw * (0.55 + uTreble * 0.9); gl_PointSize = aSize * uScale * (1.0 + uTreble*0.6); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'varying float vA; void main(){ vec2 p = gl_PointCoord - 0.5; float d = length(p); float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(vec3(0.78,0.86,1.0) * a, a); \n#include <colorspace_fragment>\n\n}',
    }));
    const stars = new THREE.Points(starGeo, starPoints);
    stars.frustumCulled = false;
    root.add(stars);
    const dustPos = new Float32Array(d.dust * 3);
    const dustSeed = new Float32Array(d.dust);
    for (let i = 0; i < d.dust; i += 1) {
        dustPos[i * 3] = (r() * 2 - 1) * 11;
        dustPos[i * 3 + 1] = r() * 17;
        dustPos[i * 3 + 2] = -3 + r() * 24;
        dustSeed[i] = r();
    }
    const dustGeo = track(new THREE.BufferGeometry());
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dustSeed, 1));
    const dustMaterial = track(new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uTreble: { value: 0 }, uAmount: { value: 1 }, uScale: { value: 1 } },
        vertexShader: 'attribute float aSeed; uniform float uTime; uniform float uTreble; uniform float uAmount; uniform float uScale; varying float vA; void main(){ vec3 p = position; p.y = mod(p.y + uTime*(0.05 + aSeed*0.07), 17.0); p.x += sin(uTime*0.2 + aSeed*40.0)*0.5; vec4 mv = modelViewMatrix * vec4(p,1.0); float on = step(aSeed, uAmount); vA = on * (0.25 + 0.5*abs(sin(uTime*0.6 + aSeed*30.0)) + uTreble*0.8); gl_PointSize = (2.0 + aSeed*3.5) * uScale * (14.0 / max(6.0, -mv.z)) ; gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'varying float vA; void main(){ vec2 p = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(p)) * vA * 0.7; gl_FragColor = vec4(vec3(1.0,0.86,0.58) * a, a); \n#include <colorspace_fragment>\n\n}',
    }));
    const dust = new THREE.Points(dustGeo, dustMaterial);
    dust.frustumCulled = false;
    zoneA.add(dust);

    // ── Pressure waves ──────────────────────────────────────────────────────────────────────────
    const waveGeo = track(new THREE.RingGeometry(0.96, 1.0, 64, 1));
    const waves: { mesh: THREE.Mesh; age: number; strength: number }[] = [];
    for (let i = 0; i < 3; i += 1) {
        const mesh = addMesh(zoneA, waveGeo, track(new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })));
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(0, 0.7, 0);
        mesh.visible = false;
        waves.push({ mesh, age: 99, strength: 0 });
    }

    // ── Zone B: the orbital passage ─────────────────────────────────────────────────────────────
    if (!options.preview) {
        const passageRibGeo = track(new THREE.TorusGeometry(5.4, 0.13, 6, d.tubular));
        const passageRibs = new THREE.InstancedMesh(passageRibGeo, brassBright, d.passageRings);
        for (let i = 0; i < d.passageRings; i += 1) {
            tmp.position.set(0, 6.4, -6.5 - i * ((-PASSAGE_END_Z - 8) / d.passageRings));
            tmp.rotation.set(0, 0, 0); tmp.scale.set(1, 1, 1); tmp.updateMatrix();
            passageRibs.setMatrixAt(i, tmp.matrix);
        }
        zoneB.add(passageRibs);
        // Orbital trajectories: thin glowing ellipses.
        const orbitMat = track(new THREE.LineBasicMaterial({ color: '#8fb4ff', transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, fog: false }));
        for (let i = 0; i < 5; i += 1) {
            const pts: number[] = [];
            const rx = 6 + i * 1.6; const rz = 12 + i * 3;
            for (let k = 0; k <= 96; k += 1) {
                const a = (k / 96) * Math.PI * 2;
                pts.push(Math.cos(a) * rx, 6.4 + Math.sin(a * 2) * 1.2 * (i % 2 ? 1 : -1), -30 + Math.sin(a) * rz);
            }
            const g = track(new THREE.BufferGeometry());
            g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
            const line = new THREE.Line(g, orbitMat);
            zoneB.add(line); meshCount += 1;
        }
        // Passage floor, distant illuminated gates at the end.
        const passFloor = addMesh(zoneB, track(new THREE.PlaneGeometry(14, 62)), darkStone);
        passFloor.rotation.x = -Math.PI / 2; passFloor.position.set(0, 0.01, -30);
        for (const g of [0, 1, 2]) {
            const gateRing = addMesh(zoneB, track(new THREE.TorusGeometry(3.6 - g * 0.9, 0.12, 8, d.radial * 2)), brassBright);
            gateRing.position.set(0, 6.4, PASSAGE_END_Z + 2 + g * 2.4);
        }
        const endGlow = glowSprite('#ffe2b0', 22, 0.9);
        endGlow.position.set(0, 6.4, PASSAGE_END_Z + 1);
        zoneB.add(endGlow);
        // Passage colonnade: slender columns each side.
        const pcol = new THREE.InstancedMesh(track(new THREE.CylinderGeometry(0.22, 0.26, 10.5, 10)), brass, 2 * 9);
        let pi = 0;
        for (const side of [-1, 1]) for (let i = 0; i < 9; i += 1) {
            tmp.position.set(side * 6.4, 5.4, -8 - i * 5.8); tmp.rotation.set(0, 0, 0); tmp.scale.set(1, 1, 1); tmp.updateMatrix();
            pcol.setMatrixAt(pi, tmp.matrix); pi += 1;
        }
        zoneB.add(pcol);
        // ── Zone C: the celestial gallery ──────────────────────────────────────────────────────
        const domeGlass = addMesh(zoneC, track(new THREE.SphereGeometry(46, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2)), track(new THREE.MeshBasicMaterial({ color: '#6f90d8', transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false, fog: false })));
        domeGlass.position.set(GALLERY_CENTER.x, 0, GALLERY_CENTER.z);
        const domeRibGeo = track(new THREE.TorusGeometry(46, 0.25, 6, 48, Math.PI));
        const domeRibs = new THREE.InstancedMesh(domeRibGeo, brassBright, 12);
        for (let i = 0; i < 12; i += 1) {
            tmp.position.set(GALLERY_CENTER.x, 0, GALLERY_CENTER.z); tmp.rotation.set(0, (i / 12) * Math.PI, 0); tmp.scale.set(1, 1, 1); tmp.updateMatrix();
            domeRibs.setMatrixAt(i, tmp.matrix);
        }
        zoneC.add(domeRibs);
        const galleryFloor = addMesh(zoneC, track(new THREE.CircleGeometry(46, 48)), darkStone);
        galleryFloor.rotation.x = -Math.PI / 2; galleryFloor.position.set(GALLERY_CENTER.x, 0.02, GALLERY_CENTER.z);
        const scope = new THREE.Group();
        scope.position.set(GALLERY_CENTER.x + 6, 0, GALLERY_CENTER.z + 12);
        zoneC.add(scope);
        const tube = addMesh(scope, track(new THREE.CylinderGeometry(1.0, 1.25, 12, 20)), brassBright);
        tube.rotation.set(0.9, 0.4, 0); tube.position.y = 9;
        const tripod = addMesh(scope, track(new THREE.CylinderGeometry(0.35, 0.8, 6.5, 10)), slateBlue);
        tripod.position.y = 3.3;
        const lens = addMesh(scope, track(new THREE.TorusGeometry(1.05, 0.12, 8, 24)), brass);
        lens.position.set(tube.position.x + 3.5, 13.4, 3.6); lens.rotation.set(0.9, 0.4, 0);
    }

    // ── Hall figures: a telescope on a pedestal, a pair of astronomer statues, a floating constellation ring ──
    {
        const scopeG = new THREE.Group();
        scopeG.position.set(FIGURES.telescope.x, 0, FIGURES.telescope.z);
        zoneA.add(scopeG);
        addLathe(scopeG, [[0, 0], [1.5, 0], [1.5, 0.5], [0.95, 0.7], [0.7, 2.6], [1.0, 2.8], [0, 2.8]], slate);
        const yoke = addMesh(scopeG, track(new THREE.SphereGeometry(0.55, 18, 12)), brassBright); yoke.position.y = 3.1;
        const body = addMesh(scopeG, track(new THREE.CylinderGeometry(0.42, 0.62, 4.6, 18)), brass);
        body.position.set(0.3, 4.4, 0.6); body.rotation.set(-1.0, 0.3, -0.25);
        const bandA = addMesh(scopeG, track(new THREE.TorusGeometry(0.5, 0.06, 8, 20)), brassBright);
        bandA.position.set(1.0, 5.9, -1.0); bandA.rotation.set(-1.0 + Math.PI / 2, 0.3, -0.25);
        const eyepiece = addMesh(scopeG, track(new THREE.CylinderGeometry(0.15, 0.2, 0.7, 12)), brassBright);
        eyepiece.position.set(-0.1, 3.0, 2.2); eyepiece.rotation.set(-1.0, 0.3, -0.25);
        for (const sx of [FIGURES.statueLeft.x, FIGURES.statueRight.x]) {
            const g = new THREE.Group();
            g.position.set(sx, 0, FIGURES.statueLeft.z);
            g.rotation.y = sx < 0 ? 0.5 : -0.5;
            zoneA.add(g);
            addMesh(g, track(new THREE.BoxGeometry(1.7, 0.9, 1.7)), slate).position.y = 0.45;
            addLathe(g, [[0, 0.9], [0.75, 0.9], [0.62, 1.8], [0.48, 3.0], [0.38, 3.5], [0, 3.5]], slateBlue);
            const head = addMesh(g, track(new THREE.SphereGeometry(0.3, 16, 12)), slate); head.position.y = 3.85;
            const hood = addMesh(g, track(new THREE.ConeGeometry(0.42, 0.7, 14)), slateBlue); hood.position.y = 4.15;
            const arm = addMesh(g, track(new THREE.CylinderGeometry(0.11, 0.14, 1.5, 10)), slateBlue);
            arm.position.set(0.5, 3.8, 0.45); arm.rotation.set(0.9, 0, -0.5);
            const orb = addMesh(g, track(new THREE.SphereGeometry(0.28, 16, 12)), brassBright); orb.position.set(0.95, 4.55, 1.0);
            orb.add(glowSprite('#ffd9a0', 1.8, 0.5));
        }
        const cons = new THREE.Group();
        cons.position.set(FIGURES.constellation.x, FIGURES.constellation.y, FIGURES.constellation.z);
        zoneA.add(cons);
        const consRing = addMesh(cons, track(new THREE.TorusGeometry(1.8, 0.04, 8, 64)), brassBright);
        consRing.rotation.x = 1.2;
        const pts: number[] = []; const segs: number[] = [];
        for (let i = 0; i < 9; i += 1) {
            const a = i * 2.399; const rr = 0.35 + ((i * 37) % 10) / 10 * 1.2;
            pts.push(Math.cos(a) * rr, Math.sin(a) * rr * 0.8, ((i * 53) % 10 - 5) * 0.08);
        }
        for (let i = 0; i < 8; i += 1) segs.push(pts[i * 3]!, pts[i * 3 + 1]!, pts[i * 3 + 2]!, pts[i * 3 + 3]!, pts[i * 3 + 4]!, pts[i * 3 + 5]!);
        const lineGeo = track(new THREE.BufferGeometry()); lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3));
        cons.add(new THREE.LineSegments(lineGeo, track(new THREE.LineBasicMaterial({ color: '#9fc0ff', transparent: true, opacity: 0.45, fog: false }))));
        for (let i = 0; i < 9; i += 1) {
            const star = glowSprite('#fff4d6', 0.55, 0.95); star.position.set(pts[i * 3]!, pts[i * 3 + 1]!, pts[i * 3 + 2]!); cons.add(star);
        }
        constellation = cons;
    }

    // ── Focus marker: a glow ring and halo that lock onto the station whose line is sung ──
    const focusRing = addMesh(root, track(new THREE.TorusGeometry(1, 0.012, 6, 96)), track(new THREE.MeshBasicMaterial({ color: '#ffe2b0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
    focusRing.visible = false;
    const focusHalo = glowSprite('#ffd9a0', 1, 0);
    focusHalo.visible = false;
    root.add(focusHalo);
    let focusStrength = 0;

    // ── Public state ────────────────────────────────────────────────────────────────────────────
    const tmpV = new THREE.Vector3();
    let kickGlow = 0;
    let waveCooldown = 0;
    let lastBeat = 0;
    let envTexture: THREE.Texture | null = null;
    let initialized = false;

    const init = (renderer: THREE.WebGLRenderer) => {
        if (initialized) return;
        initialized = true;
        // A tiny gradient room, pre-filtered once: soft warm light above, cool navy below, so brass has something to reflect.
        const envScene = new THREE.Scene();
        const roomMat = new THREE.ShaderMaterial({
            side: THREE.BackSide,
            vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            fragmentShader: 'varying vec3 vP; void main(){ float h = vP.y*0.5+0.5; vec3 c = mix(vec3(0.02,0.03,0.07), vec3(0.55,0.42,0.26), smoothstep(0.3,1.0,h)); c += vec3(1.1,0.85,0.55) * pow(max(0.0, dot(vP, normalize(vec3(-0.4,0.8,0.6)))), 24.0); c += vec3(0.2,0.35,0.8) * pow(max(0.0, dot(vP, normalize(vec3(0.7,0.3,-0.6)))), 10.0); gl_FragColor = vec4(c,1.0); }',
        });
        envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 24, 16), roomMat));
        const pmrem = new THREE.PMREMGenerator(renderer);
        envTexture = pmrem.fromScene(envScene, 0.04).texture;
        pmrem.dispose();
        roomMat.dispose();
        (envScene.children[0] as THREE.Mesh).geometry.dispose();
        root.traverse(object => {
            const material = (object as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
            const apply = (m: THREE.Material) => { if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) { (m as THREE.MeshStandardMaterial).envMap = envTexture; (m as THREE.MeshStandardMaterial).envMapIntensity = 0.9; m.needsUpdate = true; } };
            if (Array.isArray(material)) material.forEach(apply); else if (material) apply(material);
        });
        root.userData.fog = fog;
    };

    const update = (frame: AstralWorldFrame) => {
        const { time, audio, still } = frame;
        const act = still ? 0 : frame.orbitalActivity;
        const react = still ? 0 : frame.reactivity;
        const t = still ? 0 : time;
        const bass = audio.bass * react;
        kickGlow += (audio.kick * react - kickGlow) * Math.min(1, frame.dt * 18);
        // Orrery life: armillary and orbiters turn slowly even in silence.
        armRings[0]!.rotation.z = t * 0.08 * act;
        armRings[1]!.rotation.y = t * 0.12 * act * (1 + audio.lowMid * react * 1.6);
        armRings[2]!.rotation.x = -t * 0.1 * act * (1 + audio.lowMid * react * 1.2);
        armRings[3]!.rotation.y = t * 0.15 * act;
        armRings[4]!.rotation.z = -t * 0.2 * act;
        let oi = 0;
        orbiterSpecs.forEach(spec => {
            const a = spec.phase + t * spec.speed * 0.4 * act;
            const m = orbiterMeshes[oi]!;
            m.position.set(Math.cos(a) * spec.r, Math.sin(a * 0.7) * spec.r * 0.18, Math.sin(a) * spec.r);
            const arm = orbiterMeshes[oi + 1]!;
            const len = m.position.length();
            tmpV.copy(m.position).divideScalar(len || 1);
            arm.quaternion.setFromUnitVectors(UP, tmpV);
            arm.scale.set(1, len, 1);
            oi += 2;
        });
        const breath = 1 + Math.sin(t * 0.9) * 0.04 * act;
        const starPulse = breath * (1 + kickGlow * 0.18 + audio.power * react * 0.12);
        starGlow.scale.setScalar(2.6 * starPulse * (1 + audio.treble * react * 0.15));
        (starGlow.material as THREE.SpriteMaterial).opacity = 0.7 + audio.power * react * 0.3 + kickGlow * 0.2;
        starLight.intensity = 105 + audio.power * react * 60 + kickGlow * 70;
        // Bass: base drums and the gate rings take a small pressure expansion; the dial hand settles with a tick.
        const press = 1 + bass * 0.022 + kickGlow * 0.018;
        baseDrums.scale.set(press, 1, press);
        gate.scale.setScalar(1 + bass * 0.012 + kickGlow * 0.01);
        dialHandPivot.rotation.z = -Math.floor(t * 0.5) * 0.105 - Math.min(1, (t * 0.5) % 1 * 6) * 0.105;
        // Gate rings: the numeral ring turns almost imperceptibly, the inner rings counter-rotate.
        numeralRing.rotation.z = t * 0.004 * act;
        innerToothed.rotation.z = -t * 0.03 * act * (1 + audio.lowMid * react);
        counterRing.rotation.z = t * 0.05 * act;
        // Enamel glow follows the mid band.
        const enamel = 0.75 + audio.mid * react * 0.9;
        enamelLower.emissiveIntensity = enamel;
        enamelUpper.emissiveIntensity = enamel;
        // Mini orrery lamps.
        miniSpheres.forEach((lamp, i) => { lamp.rotation.y = t * (0.25 + i * 0.07) * act; lamp.rotation.x = Math.sin(t * 0.3 + i) * 0.1 * act; });
        // Planets bob and drift on their own slow clocks; the colossus breathes in depth with the low mids.
        for (const { mesh, spec } of planetMeshes) {
            const phase = (t / spec.period) * Math.PI * 2 + spec.seedOffset * 10;
            mesh.position.y = spec.position.y + Math.sin(phase) * spec.bob * act;
            mesh.position.x = spec.position.x + Math.cos(phase * 0.7) * spec.bob * 0.6 * act;
            mesh.position.z = spec.position.z + (spec.id === 'colossus' ? audio.lowMid * react * 0.7 : 0);
            mesh.rotation.y = spec.seedOffset * 6 + t * 0.012 * act;
        }
        planetMaterials.setTime(t, audio.power * react * 0.6 + kickGlow * 0.3);
        // Pressure waves.
        waveCooldown -= frame.dt;
        const beatEdge = audio.beat > 0.5 && lastBeat <= 0.5;
        lastBeat = audio.beat;
        if (!still && ((audio.kick * react > 0.55 && waveCooldown <= 0) || beatEdge)) {
            const free = waves.find(w => w.age > 2.4) ?? waves[0]!;
            free.age = 0;
            free.strength = beatEdge ? 1 : Math.min(1, audio.kick * react);
            free.mesh.visible = true;
            waveCooldown = 0.4;
        }
        for (const wave of waves) {
            if (!wave.mesh.visible) continue;
            wave.age += frame.dt;
            const life = wave.age / 2.2;
            if (life >= 1) { wave.mesh.visible = false; continue; }
            wave.mesh.scale.setScalar(3 + life * 26);
            (wave.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - life) * (1 - life) * 0.35 * wave.strength;
        }
        // Atmosphere and fog follow overall power.
        key.intensity = 2.2 + audio.power * react * 0.7;
        hemi.intensity = 0.85 + audio.power * react * 0.2;
        fog.density = 0.0105 + audio.power * react * 0.0012;
        if (fanMaterial) fanMaterial.opacity = 0.42 + 0.1 * Math.sin(t * 0.7) * act + audio.treble * react * 0.28;
        starPoints.uniforms.uTime!.value = t; starPoints.uniforms.uTreble!.value = audio.treble * react;
        dustMaterial.uniforms.uTime!.value = still ? 0 : t; dustMaterial.uniforms.uTreble!.value = audio.treble * react; dustMaterial.uniforms.uAmount!.value = Math.min(1, frame.atmosphere);
        stars.position.set(frame.camera.x, frame.camera.y, frame.camera.z);
        // Gate: the portal dissolves as it opens; the glow rises with it.
        portalMaterial.uniforms.uOpen!.value = frame.gateOpen;
        portalMaterial.uniforms.uPulse!.value = kickGlow;
        (gateGlow.material as THREE.SpriteMaterial).opacity = frame.gateOpen * 0.55 + kickGlow * 0.08;
        // Zones B and C only exist while the camera is near them or the gate is open.
        const beyond = frame.gateOpen > 0.02 || frame.camera.z < PANEL_Z + 6;
        zoneB.visible = beyond;
        zoneC.visible = beyond && (frame.camera.z < -20 || frame.gateOpen > 0.5);
        if (constellation) { constellation.rotation.y = Math.sin(t * 0.12) * 0.35 * act; constellation.rotation.z = t * 0.02 * act; }
        // Focus marker: eases in on the station, breathes with the kick.
        const wanted = frame.focus && !still ? frame.focus.strength : 0;
        focusStrength += (wanted - focusStrength) * Math.min(1, frame.dt * 4 || (wanted > 0 ? 1 : 0));
        const on = focusStrength > 0.01 && !!frame.focus;
        focusRing.visible = on; focusHalo.visible = on;
        if (on && frame.focus) {
            const r = frame.focus.r * (1 + kickGlow * 0.04);
            focusRing.position.set(frame.focus.x, frame.focus.y, frame.focus.z);
            focusRing.scale.setScalar(r);
            focusRing.quaternion.copy(frame.cameraQuaternion ?? focusRing.quaternion);
            (focusRing.material as THREE.MeshBasicMaterial).opacity = focusStrength * (0.38 + kickGlow * 0.25);
            focusHalo.position.set(frame.focus.x, frame.focus.y, frame.focus.z);
            focusHalo.scale.setScalar(r * 2.6);
            (focusHalo.material as THREE.SpriteMaterial).opacity = focusStrength * (0.16 + kickGlow * 0.1);
        }
        orrery.updateMatrixWorld(false);
    };

    const dispose = () => {
        disposables.forEach(item => { try { item.dispose(); } catch { /* already gone */ } });
        envTexture?.dispose();
        root.clear();
    };
    return {
        root, update, init, dispose,
        get stats() { return { meshes: meshCount, drawCallsEstimate: meshCount }; },
    } as AstralWorld;
};
