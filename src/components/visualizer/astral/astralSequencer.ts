import type { Line } from '../../../types';
import {
    applyAspect, applyIntensity, blendPose, constrainPose, copyPose, createPose, easeInOut, gateOpenAt, HERO_POSE, SHOT_MAX_SECONDS,
    SHOT_MIN_SECONDS, shotPose, type Pose, type Shot,
} from './astralCameraPath';
import { planSegments, segmentAt, type Segment } from './astralShotPlanner';

// src/components/visualizer/astral/astralSequencer.ts
// The conductor: playback time in, camera pose out. It owns the single writer of the camera pose.
// - The shot for any time comes from the plan (astralShotPlanner), as a pure function of the song's time, so a seek lands on the
//   right shot at once and never plays through the shots in between.
// - A change of shot never snaps: the pose the camera actually has is captured and blended into the new shot (a blend replaced, not
//   stacked, if another change arrives mid-way).
// - A song change or a single-song loop starts a "gate" shot of its own, a round trip through the Astral Gate that returns to the
//   opening composition, and it plays to its end before the plan takes over again.
// - All progress is measured in playback time. Paused: nothing advances. Instrumental or no lyrics: camera-only stretches go on.

export interface ConductorOptions {
    lines: readonly Line[];
    seed: string | number | undefined;
}

export interface ConductorInput {
    time: number;
    dt: number;
    paused: boolean;
    aspect: number;
    intensity: number;
    speed: number;
    /** Static mode: the hero composition and nothing else. */
    still: boolean;
}

export interface ConductorOutput {
    pose: Pose;
    gateOpen: number;
    /** Plan segment index being shown, -1 while a gate return plays. */
    segmentIndex: number;
    shot: Shot;
    /** True for one step when the conductor started a gate return (song change or loop). */
    startedReturn: boolean;
}

const BLEND_MIN = 0.7;
const BLEND_MAX = 2.0;
const SEEK_JUMP_SECONDS = 2.5;
const RETURN_SHOT: Shot = { kind: 'gate', side: 1, variation: 0.5 };
/** A return keeps the camera on its own shot for this long (playback seconds), then hands back to the plan. */
const RETURN_SECONDS = SHOT_MIN_SECONDS.gate;

export interface Conductor {
    step: (input: ConductorInput) => ConductorOutput;
    /** A new song or new lyrics: the plan is rebuilt, and (unless it is the first) a gate return plays. */
    setSong: (options: ConductorOptions, withReturn: boolean) => void;
    readonly segments: readonly Segment[];
}

export const createConductor = (initial: ConductorOptions): Conductor => {
    let seed = initial.seed;
    let segments = planSegments({ lines: initial.lines, seed });
    let lastTime = Number.NaN;
    let currentIndex = -2;
    let currentShot: Shot = { kind: 'hold', side: 1, variation: 0 };
    let segStart = 0;
    let segEnd = 0;
    let blendFrom = createPose();
    let blendClock = 99;
    let blendLength = 1;
    let haveFrom = false;
    let returnStart = Number.NaN;
    let returnElapsed = 0;
    let pendingReturn = false;
    let lastGateSegment = -1;
    const actual = createPose();
    const shotOut = createPose();
    const result: ConductorOutput = { pose: createPose(), gateOpen: 0, segmentIndex: 0, shot: currentShot, startedReturn: false };
    copyPose(HERO_POSE, actual);

    const beginBlend = (length: number) => {
        copyPose(actual, blendFrom);
        haveFrom = true;
        blendClock = 0;
        blendLength = Math.min(BLEND_MAX, Math.max(BLEND_MIN, length));
    };

    return {
        get segments() { return segments; },
        setSong: (options, withReturn) => {
            seed = options.seed;
            segments = planSegments({ lines: options.lines, seed });
            currentIndex = -2;
            lastTime = Number.NaN;
            pendingReturn = withReturn;
            lastGateSegment = -1;
        },
        step: ({ time, dt, paused, aspect, intensity, speed, still }) => {
            result.startedReturn = false;
            if (still) {
                copyPose(HERO_POSE, shotOut);
                applyAspect(shotOut, aspect);
                constrainPose(shotOut, false);
                copyPose(shotOut, actual);
                copyPose(shotOut, result.pose);
                result.gateOpen = 0;
                result.segmentIndex = -1;
                result.shot = currentShot;
                haveFrom = false;
                return result;
            }
            // A jump back in time (a loop) or a large jump either way (a seek).
            const jumped = Number.isFinite(lastTime) && Math.abs(time - lastTime) > SEEK_JUMP_SECONDS;
            const looped = Number.isFinite(lastTime) && time < lastTime - SEEK_JUMP_SECONDS && time < 4;
            lastTime = time;
            if (pendingReturn || looped) {
                pendingReturn = false;
                returnStart = time;
                returnElapsed = 0;
                beginBlend(1.2);
                result.startedReturn = true;
            } else if (jumped) {
                // A seek cancels any return and any half-made blend, then blends from wherever the camera is now.
                returnStart = Number.NaN;
                currentIndex = -2;
                lastGateSegment = -1;
            }
            const gateReturnActive = Number.isFinite(returnStart);
            if (gateReturnActive && !paused) returnElapsed += Math.max(0, Math.min(dt, 0.1));
            if (gateReturnActive && returnElapsed >= RETURN_SECONDS) {
                returnStart = Number.NaN;
                currentIndex = -2;
            }
            let gateOpen = 0;
            let segmentIndex = -1;
            if (Number.isFinite(returnStart)) {
                const p = Math.min(1, returnElapsed / RETURN_SECONDS);
                shotPose(RETURN_SHOT, p, time, shotOut);
                gateOpen = gateOpenAt('gate', p);
                currentShot = RETURN_SHOT;
            } else {
                const segment = segmentAt(segments, seed, time);
                if (segment.index !== currentIndex) {
                    const first = currentIndex === -2 && !haveFrom;
                    currentIndex = segment.index;
                    currentShot = segment.shot;
                    segStart = segment.start;
                    segEnd = segment.end;
                    if (!first) beginBlend(Math.min(1.8, Math.max(0, (segEnd - segStart) * 0.4)));
                    if (segment.shot.kind === 'gate') {
                        if (segment.index !== lastGateSegment) {
                            // A gate shot is a round trip that must finish: it is played as a locked return, not cut by the next line.
                            lastGateSegment = segment.index;
                            returnStart = time;
                            returnElapsed = 0;
                            result.startedReturn = true;
                        } else {
                            currentShot = { kind: 'hold', side: segment.shot.side, variation: segment.shot.variation };
                        }
                    }
                }
                const duration = Math.min(SHOT_MAX_SECONDS, Math.max(SHOT_MIN_SECONDS[currentShot.kind], segEnd - segStart));
                const p = Math.min(1, Math.max(0, ((time - segStart) * speed) / duration));
                shotPose(currentShot, p, time, shotOut);
                gateOpen = gateOpenAt(currentShot.kind, p);
                segmentIndex = segment.index;
            }
            applyIntensity(shotOut, intensity);
            applyAspect(shotOut, aspect);
            if (blendClock < blendLength) {
                if (!paused) blendClock += Math.max(0, Math.min(dt, 0.1));
                const w = easeInOut(blendClock / blendLength);
                blendPose(blendFrom, shotOut, w, shotOut);
                gateOpen *= w;
            }
            constrainPose(shotOut, gateOpen > 0.02 || currentShot.kind === 'gate');
            copyPose(shotOut, actual);
            copyPose(shotOut, result.pose);
            result.gateOpen = gateOpen;
            result.segmentIndex = segmentIndex;
            result.shot = currentShot;
            return result;
        },
    };
};
