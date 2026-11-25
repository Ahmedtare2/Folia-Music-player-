import * as THREE from 'three';
import type { PlanetSpec } from './astralSceneLayout';

// src/components/visualizer/astral/astralPlanetMaterials.ts
// Procedural planets with no texture files: one shared ShaderMaterial per planet kind. Surface detail comes from
// value noise in the fragment shader (bands, craters, swirls), each planet's own pattern from its world position.
// Every planet gets the same soft key light and a pale fresnel rim around the limb, like the reference.

type Kind = PlanetSpec['kind'];

const VERT = /* glsl */ `
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vViewDir;
varying vec3 vSeed;
void main() {
    vObj = normalize(position);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - world.xyz);
    vSeed = modelMatrix[3].xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vViewDir;
varying vec3 vSeed;
uniform int uKind;
uniform float uDetail;
uniform float uTime;
uniform float uGlow;
uniform vec3 uKeyDir;
uniform vec3 uRim;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;

float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 5; i++) {
        if (float(i) >= uDetail) break;
        v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5;
    }
    return v;
}
// Rough crater field: dark bowls with bright rims from the distance to the nearest of a jittered grid of points.
float craters(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p);
    float best = 1.0;
    for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
        vec3 g = vec3(float(x), float(y), float(z));
        vec3 o = vec3(hash(i + g), hash(i + g + 7.0), hash(i + g + 13.0));
        float d = length(g + o - f);
        float r = 0.25 + 0.3 * hash(i + g + 21.0);
        best = min(best, abs(d - r));
    }
    return best;
}
void main() {
    vec3 p = vObj;
    vec3 sp = p * 2.2 + vSeed * 0.37;
    vec3 col;
    float spec = 0.0;
    if (uKind == 0) {            // gas giant: latitude bands warped by noise
        float warp = fbm(sp * vec3(1.0, 3.0, 1.0) + uTime * 0.004) * 0.35;
        float band = sin((p.y + warp) * 16.0 + fbm(sp * 2.0) * 3.0) * 0.5 + 0.5;
        col = mix(uA, uB, band);
        col = mix(col, uC, smoothstep(0.55, 0.9, fbm(sp * vec3(2.0, 6.0, 2.0))) * 0.6);
    } else if (uKind == 1) {     // ice giant: deep blue, soft swirls, a few pale streaks
        float n = fbm(sp * vec3(1.4, 2.6, 1.4) + uTime * 0.003);
        col = mix(uA, uB, n);
        col += uC * smoothstep(0.6, 0.85, fbm(sp * 3.0 + 4.0)) * 0.5;
    } else if (uKind == 2) {     // mars: rust, dark maria, bright dust
        float n = fbm(sp * 1.5);
        col = mix(uA, uB, n);
        col = mix(col, uC, smoothstep(0.62, 0.8, fbm(sp * 4.0)) * 0.5);
        col *= 0.8 + 0.4 * (1.0 - craters(sp * 1.5) * 2.0);
    } else if (uKind == 3) {     // moon and dark rocky worlds: craters over rock
        float c = craters(sp * 1.6);
        float bowl = smoothstep(0.0, 0.07, c);
        float n = fbm(sp * 3.0);
        col = mix(uA, uB, n);
        col *= 0.65 + 0.45 * bowl;
        col += uC * (1.0 - smoothstep(0.0, 0.03, c)) * 0.35;
    } else {                     // amber textured planet
        float n = fbm(sp * 2.4);
        col = mix(uA, uB, n);
        col += uC * smoothstep(0.55, 0.8, fbm(sp * 6.0)) * 0.6;
        col *= 0.85 + 0.3 * craters(sp * 2.0);
    }
    // star dust specks inside the surface
    float speck = step(0.992, hash(floor(p * 70.0 + vSeed)));
    col += speck * vec3(0.7, 0.8, 1.0) * 0.3;

    vec3 n = normalize(vNormalW);
    vec3 v = normalize(vViewDir);
    float ndl = dot(n, normalize(uKeyDir));
    float light = smoothstep(-0.35, 0.95, ndl);
    float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 3.0);
    vec3 lit = col * (0.16 + 0.95 * light);
    lit += uRim * fres * (0.55 + 0.9 * uGlow);
    lit += uRim * 0.05 * (1.0 - ndl * 0.5);
    gl_FragColor = vec4(lit, 1.0);
    \n#include <colorspace_fragment>\n
}
`;

interface KindStyle { kind: number; a: string; b: string; c: string; rim: string }

const STYLES: Record<Kind, KindStyle> = {
    gas: { kind: 0, a: '#c9b79a', b: '#8d7a63', c: '#d9c8a8', rim: '#a9c8ff' },
    ringed: { kind: 0, a: '#cdb184', b: '#9b8157', c: '#e0cca0', rim: '#a9c8ff' },
    ice: { kind: 1, a: '#071a5e', b: '#1c3fa8', c: '#6f98e6', rim: '#a9c8ff' },
    mars: { kind: 2, a: '#8a3a22', b: '#c0583a', c: '#e49a72', rim: '#9bbdf5' },
    moon: { kind: 3, a: '#6d7078', b: '#a4a7ae', c: '#d6d8de', rim: '#b5cdf5' },
    dark: { kind: 3, a: '#121218', b: '#2a2a33', c: '#6a5a3a', rim: '#d8a84e' },
    amber: { kind: 4, a: '#a8641e', b: '#e09a3c', c: '#ffd48a', rim: '#ffcf8a' },
    tiny: { kind: 3, a: '#59606c', b: '#8c92a0', c: '#cfd6e4', rim: '#b5cdf5' },
};

export interface PlanetMaterials {
    byKind: Map<Kind, THREE.ShaderMaterial>;
    setDetail: (detail: number) => void;
    setTime: (time: number, glow: number) => void;
    setKeyDirection: (x: number, y: number, z: number) => void;
    dispose: () => void;
}

export const createPlanetMaterials = (detail: number): PlanetMaterials => {
    const byKind = new Map<Kind, THREE.ShaderMaterial>();
    const shared = {
        uTime: { value: 0 },
        uGlow: { value: 0 },
        uDetail: { value: detail },
        uKeyDir: { value: new THREE.Vector3(-0.35, 0.55, 0.75).normalize() },
    };
    (Object.keys(STYLES) as Kind[]).forEach(kind => {
        const style = STYLES[kind];
        byKind.set(kind, new THREE.ShaderMaterial({
            vertexShader: VERT,
            fragmentShader: FRAG,
            uniforms: {
                uKind: { value: style.kind },
                uA: { value: new THREE.Color(style.a) },
                uB: { value: new THREE.Color(style.b) },
                uC: { value: new THREE.Color(style.c) },
                uRim: { value: new THREE.Color(style.rim) },
                uTime: shared.uTime,
                uGlow: shared.uGlow,
                uDetail: shared.uDetail,
                uKeyDir: shared.uKeyDir,
            },
        }));
    });
    return {
        byKind,
        setDetail: value => { shared.uDetail.value = value; },
        setTime: (time, glow) => { shared.uTime.value = time; shared.uGlow.value = glow; },
        setKeyDirection: (x, y, z) => { shared.uKeyDir.value.set(x, y, z).normalize(); },
        dispose: () => byKind.forEach(m => m.dispose()),
    };
};
