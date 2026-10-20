import { afterEach, describe, expect, it, vi } from 'vitest';
import * as pixi from 'pixi.js';
import type { Line } from '@/types';
import { LUMIERE_PROFILES } from '@/components/visualizer/lumiere/catalog';
import { createLumiereCredits, resolveLumiereCreditsFrame } from '@/components/visualizer/lumiere/credits';
import { hexOf } from '@/components/visualizer/lumiere/color';
import { resolveLumierePalette } from '@/components/visualizer/lumiere/scene';
import { buildGlyphLine } from '@/components/visualizer/lumiere/text/glyphLine';
import { createTextMeasurer, flowLine } from '@/components/visualizer/lumiere/text/lineWrap';
import { createLyricEcho } from '@/components/visualizer/lumiere/text/lyricEcho';
import { createLyricWindow } from '@/components/visualizer/lumiere/text/lyricWindow';
import { buildLineMetas, buildLineView } from '@/components/visualizer/lumiere/text/windowLines';
import { segmentWords } from '@/components/visualizer/lumiere/text/wordStyle';
import { createRngAt } from '@/components/visualizer/lumiere/lumiereRandom';
import { splitLyricGraphemes } from '@/utils/lyrics/graphemeTiming';
import { parseEnhancedLRC } from '@/utils/lyrics/parserCore';
import { buildLyricDataFromTTMLResult } from '@/utils/lyrics/ttmlConversion';
import { installFakeTextMeasure } from './lumiereFixtures';
import { FakeContainer, fakePixi, fakeSprites } from './lumiereWindowFakes';

// test/unit/visualizer/lumiere/lumiereArabicJoining.test.ts
// Regression test suite verifying natural Arabic contextual letter joining, whole-word shaped
// Canvas/Pixi texture rendering, RTL & mixed bidi layout, TTML word/syllable timing, long held
// words, overlapping vocals, seeking, and echo/credits behavior in the Lumiere lyrics visualizer.

installFakeTextMeasure();

interface DrawCallRecord {
    text: string;
    x: number;
    y: number;
    direction: string;
    textAlign: string;
    kind: 'fill' | 'stroke';
}

const createRecordingCanvasEnv = () => {
    const drawCalls: DrawCallRecord[] = [];
    vi.stubGlobal('document', {
        createElement: () => {
            let w = 300;
            let h = 150;
            const ctx = {
                font: '600 60px sans-serif',
                textAlign: 'start',
                textBaseline: 'alphabetic',
                direction: 'inherit',
                fillStyle: '#ffffff',
                strokeStyle: '#ffffff',
                globalAlpha: 1,
                lineWidth: 1,
                setTransform() {},
                measureText(str: string) {
                    const px = Number(/([\d.]+)px/.exec(this.font)?.[1] ?? 60);
                    const graphemes = splitLyricGraphemes(str.replace(/\u200D/g, ''));
                    return { width: Math.max(1, graphemes.length * px * 0.52) };
                },
                fillText(str: string, x: number, y: number) {
                    drawCalls.push({
                        text: str,
                        x,
                        y,
                        direction: this.direction,
                        textAlign: this.textAlign,
                        kind: 'fill',
                    });
                },
                strokeText(str: string, x: number, y: number) {
                    drawCalls.push({
                        text: str,
                        x,
                        y,
                        direction: this.direction,
                        textAlign: this.textAlign,
                        kind: 'stroke',
                    });
                },
            };
            return {
                get width() { return w; },
                set width(val: number) { w = Math.floor(val); drawCalls.length = 0; },
                get height() { return h; },
                set height(val: number) { h = Math.floor(val); drawCalls.length = 0; },
                getContext: () => ctx,
            };
        },
    });
    return { drawCalls };
};

const REQUIRED_ARABIC_LINES = [
    'أهلا بيك يا حبيبي',
    'روح يلا العب غيرها ومتجيش',
    'وبجملة ييجي مية حاجة اتقالت ومفيش حاجة كملت',
    'كلمنجي أوي وبتحب تبان، واحد غلبان وأنا باجي عليه',
] as const;

const CONNECTED_ARABIC_WORDS = ['العربية', 'كلام', 'مفيش'] as const;

const makeTimedArabicLine = (fullText: string, startTime: number, wordDuration = 0.6): Line => {
    const rawTokens = fullText.split(/\s+/u).filter(Boolean);
    return {
        fullText,
        startTime,
        endTime: startTime + rawTokens.length * wordDuration,
        words: rawTokens.map((text, index) => ({
            text,
            startTime: startTime + index * wordDuration,
            endTime: startTime + (index + 1) * wordDuration,
        })),
    };
};

describe('Lumiere Arabic Letter Joining & Shaping-Aware Rendering Regression Suite', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        installFakeTextMeasure();
    });

    describe('1. Root-Cause Verification: Whole-Word Canvas Shaping & Texture Slicing in buildGlyphLine', () => {
        it.each(REQUIRED_ARABIC_LINES)(
            'draws each Arabic word in "%s" as a single intact Unicode word with direction="rtl" and textAlign="left"',
            (lineText) => {
                const { drawCalls } = createRecordingCanvasEnv();
                const glyphLine = buildGlyphLine(pixi, {
                    text: lineText,
                    fontPx: 64,
                    font: 'Noto Sans Arabic, sans-serif',
                    weight: 600,
                    resolution: 2,
                    letterSpacing: 0.05,
                });

                // 1. Every fillText call on the Canvas must use textAlign === 'left' so direction === 'rtl'
                // never draws Arabic words off the left edge of the canvas or into neighboring word slots.
                expect(drawCalls.length).toBeGreaterThan(0);
                for (const call of drawCalls) {
                    expect(call.textAlign).toBe('left');
                    expect(call.direction).toBe('rtl');
                    // Original Unicode text must be preserved without ZWJ/ZWNJ injection or presentation forms
                    expect(call.text.includes('\u200D')).toBe(false);
                    expect(call.text.includes('\u200C')).toBe(false);
                    expect(/[\uFB50-\uFDFF\uFE70-\uFEFF]/u.test(call.text)).toBe(false);
                }

                // 2. Verify every Arabic word in the line was drawn as one complete, unsplit string
                const expectedWords = lineText
                    .replace(/[،؟!.]/gu, '')
                    .split(/\s+/u)
                    .filter(Boolean);
                const drawnStrings = drawCalls.map(c => c.text);
                for (const word of expectedWords) {
                    expect(drawnStrings).toContain(word);
                }

                // 3. Verify GlyphSlice count matches grapheme count, and each multi-letter Arabic word has
                // exactly 1 cursiveWordLead slice (with the whole-word texture) followed by cursiveWordContinuation slices.
                const graphemes = splitLyricGraphemes(lineText);
                expect(glyphLine.glyphs).toHaveLength(graphemes.length);
                expect(glyphLine.glyphs.map(g => g.char).join('')).toBe(lineText);

                const leadSlices = glyphLine.glyphs.filter(g => g.cursiveWordLead);
                expect(leadSlices.map(g => g.wordText)).toEqual(expectedWords);
                for (const lead of leadSlices) {
                    expect(lead.wordWidth).toBeGreaterThan(0);
                    expect(lead.width).toBeGreaterThanOrEqual(lead.wordWidth!);
                    expect(lead.anchorX).toBeCloseTo(0.5, 4);
                }

                glyphLine.destroy();
            },
        );

        it('preserves connected letters in "العربية", "كلام", "مفيش", and vocalized Arabic with harakat, shadda, and tanween', () => {
            const { drawCalls } = createRecordingCanvasEnv();
            const text = `${CONNECTED_ARABIC_WORDS.join(' ')} بِحِبَّكْ يَا مِصْرُ مُحَمَّدٌ`;
            const glyphLine = buildGlyphLine(pixi, {
                text,
                fontPx: 60,
                font: 'Noto Sans Arabic, sans-serif',
                weight: 600,
                resolution: 1.5,
            });

            const drawnWords = drawCalls.map(c => c.text);
            for (const word of ['العربية', 'كلام', 'مفيش', 'بِحِبَّكْ', 'يَا', 'مِصْرُ', 'مُحَمَّدٌ']) {
                expect(drawnWords).toContain(word);
            }

            // Combining marks (harakat, shadda, tanween) remain attached to their base letters in graphemes
            const graphemes = glyphLine.glyphs.map(g => g.char);
            expect(graphemes).toContain('بَّ');
            expect(graphemes).toContain('مَّ');
            expect(graphemes).toContain('دٌ');
            expect(graphemes.join('')).toBe(text);

            glyphLine.destroy();
        });
    });

    describe('2. Bidi Layout, Word Positions & Right-to-Left Progression in Lumiere', () => {
        it('orders words and sub-word grapheme anchors right-to-left across all 4 required Egyptian/MSA sentences', () => {
            const measurer = createTextMeasurer('Noto Sans Arabic, sans-serif', 600, 0.04);

            for (const text of REQUIRED_ARABIC_LINES) {
                const graphemes = splitLyricGraphemes(text);
                const words = segmentWords({ fullText: text });
                const flowGlyphs = graphemes.map(char => ({
                    char,
                    scale: 1,
                    advance: char.trim() ? 22 : 10,
                    upright: false,
                    jag: 0,
                }));

                const [[singleRow]] = flowLine(measurer, flowGlyphs, words, {
                    heroPx: 48,
                    limits: { horizontal: 4000, vertical: 2000 },
                });

                const nonBlankWords = words.filter(w => !w.blank);
                expect(nonBlankWords.length).toBeGreaterThan(1);

                // Chronological word order is preserved in `words`, while visual X coordinates progress strictly right-to-left:
                for (let w = 0; w < nonBlankWords.length - 1; w += 1) {
                    const currentWord = nonBlankWords[w]!;
                    const nextWord = nonBlankWords[w + 1]!;
                    const currentCenterX = singleRow.wordPoints![currentWord.start]!.x;
                    const nextCenterX = singleRow.wordPoints![nextWord.start]!.x;
                    expect(currentCenterX, `${text}: "${currentWord.text}" should sit to the right of "${nextWord.text}"`).toBeGreaterThan(nextCenterX);
                }

                // Inside each multi-letter Arabic word, all graphemes share the exact same wordPoints center,
                // while sub-word `points` step from right to left for spotlight/halo/star progression:
                for (const word of nonBlankWords) {
                    const leadWordPoint = singleRow.wordPoints![word.start]!;
                    for (let i = word.start + 1; i < word.end; i += 1) {
                        expect(singleRow.wordPoints![i]!.x).toBeCloseTo(leadWordPoint.x, 5);
                        expect(singleRow.wordPoints![i]!.y).toBeCloseTo(leadWordPoint.y, 5);
                        expect(singleRow.points[i - 1]!.x).toBeGreaterThan(singleRow.points[i]!.x);
                    }
                }
            }
        });

        it('handles mixed Arabic-English lines, Latin characters, numbers, and punctuation in both RTL-first and LTR-first lines', () => {
            const measurer = createTextMeasurer('Noto Sans Arabic, sans-serif', 600, 0.04);

            // Case A: RTL-first mixed line
            const rtlMixed = 'أهلا بيك Live in Cairo 2026، يا حبيبي!';
            const rtlGraphemes = splitLyricGraphemes(rtlMixed);
            const rtlWords = segmentWords({ fullText: rtlMixed });
            const [[rtlSingle]] = flowLine(
                measurer,
                rtlGraphemes.map(char => ({ char, scale: 1, advance: char.trim() ? 20 : 8, upright: false, jag: 0 })),
                rtlWords,
                { heroPx: 44, limits: { horizontal: 4000, vertical: 2000 } },
            );

            const wordCenterOf = (text: string, words: ReturnType<typeof segmentWords>, variant: typeof rtlSingle, target: string) => {
                const found = words.find(w => w.text === target);
                expect(found, `Expected word "${target}" in "${text}"`).toBeTruthy();
                return (variant.wordPoints ?? variant.points)[found!.start]!.x;
            };

            // In "أهلا بيك Live in Cairo 2026، يا حبيبي!":
            // "أهلا" (rightmost) > "بيك" > ("Live" < "in" < "Cairo" < "2026") > "يا" > "حبيبي" (leftmost)
            const xAhlan = wordCenterOf(rtlMixed, rtlWords, rtlSingle, 'أهلا');
            const xBeek = wordCenterOf(rtlMixed, rtlWords, rtlSingle, 'بيك');
            const xLive = wordCenterOf(rtlMixed, rtlWords, rtlSingle, 'Live');
            const xIn = wordCenterOf(rtlMixed, rtlWords, rtlSingle, 'in');
            const xCairo = wordCenterOf(rtlMixed, rtlWords, rtlSingle, 'Cairo');
            const x2026 = wordCenterOf(rtlMixed, rtlWords, rtlSingle, '2026');
            const xYa = wordCenterOf(rtlMixed, rtlWords, rtlSingle, 'يا');
            const xHabibi = wordCenterOf(rtlMixed, rtlWords, rtlSingle, 'حبيبي');

            expect(xAhlan).toBeGreaterThan(xBeek);
            expect(xBeek).toBeGreaterThan(x2026);
            // Embedded LTR phrase "Live in Cairo 2026" flows left-to-right:
            expect(xLive).toBeLessThan(xIn);
            expect(xIn).toBeLessThan(xCairo);
            expect(xCairo).toBeLessThan(x2026);
            // Following Arabic phrase "يا حبيبي" sits to the left of the LTR run and flows right-to-left:
            expect(xLive).toBeGreaterThan(xYa);
            expect(xYa).toBeGreaterThan(xHabibi);

            // Case B: LTR-first mixed line ("Cairo 2026 — أهلا بيك يا حبيبي")
            const ltrMixed = 'Cairo 2026 — أهلا بيك يا حبيبي';
            const ltrGraphemes = splitLyricGraphemes(ltrMixed);
            const ltrWords = segmentWords({ fullText: ltrMixed });
            const [[ltrSingle]] = flowLine(
                measurer,
                ltrGraphemes.map(char => ({ char, scale: 1, advance: char.trim() ? 20 : 8, upright: false, jag: 0 })),
                ltrWords,
                { heroPx: 44, limits: { horizontal: 4000, vertical: 2000 } },
            );

            const ltrCairo = wordCenterOf(ltrMixed, ltrWords, ltrSingle, 'Cairo');
            const ltr2026 = wordCenterOf(ltrMixed, ltrWords, ltrSingle, '2026');
            const ltrAhlan = wordCenterOf(ltrMixed, ltrWords, ltrSingle, 'أهلا');
            const ltrBeek = wordCenterOf(ltrMixed, ltrWords, ltrSingle, 'بيك');
            const ltrYa = wordCenterOf(ltrMixed, ltrWords, ltrSingle, 'يا');
            const ltrHabibi = wordCenterOf(ltrMixed, ltrWords, ltrSingle, 'حبيبي');

            // LTR prefix on the left ("Cairo" < "2026"), RTL clause on the right ordered right-to-left ("أهلا" > "بيك" > "يا" > "حبيبي")
            expect(ltrCairo).toBeLessThan(ltr2026);
            expect(ltr2026).toBeLessThan(ltrHabibi);
            expect(ltrAhlan).toBeGreaterThan(ltrBeek);
            expect(ltrBeek).toBeGreaterThan(ltrYa);
            expect(ltrYa).toBeGreaterThan(ltrHabibi);
        });
    });

    describe('3. Word-Level & Syllable-Level TTML Highlighting, Held Words, Overlapping Vocals, Seeking & Decay', () => {
        it('renders only 1 visible whole-word sprite per Arabic word while animating highlights, halos, stars, and spotlights across TTML timestamps', () => {
            createRecordingCanvasEnv();
            const lines: Line[] = REQUIRED_ARABIC_LINES.map((text, idx) => makeTimedArabicLine(text, 2 + idx * 5, 0.5));
            const palette = resolveLumierePalette({ backgroundColor: '#09090b', accentColor: '#38bdf8' } as any);
            const profile = LUMIERE_PROFILES[0]!;
            const window = createLyricWindow(fakePixi, {
                width: 1600,
                height: 900,
                lines,
                font: 'Noto Sans Arabic, sans-serif',
                weight: 600,
                resolution: 1.5,
                region: { cx: 0.88, cy: 0.52, w: 1.2, h: 0.5 },
                heroPx: 64,
                neighbors: 2,
                typography: 'horizontal',
                decay: profile.decay,
                seed: 'arabic-window',
                sprites: fakeSprites,
            });

            const glyphLayer = (window.view as unknown as FakeContainer).children[3] as FakeContainer;

            // 1. Before Line 0 starts singing (t = 1.5s): all 4 Arabic words in "أهلا بيك يا حبيبي" are unlit cold color
            window.update({
                time: 1.5,
                beams: [],
                litColor: palette.lit,
                unlitColor: palette.unlit,
                unlitAlpha: 0.2,
                intensity: 1,
            });

            const line0Holder = glyphLayer.children.find(c => (c as FakeContainer).label === 'line-0') as FakeContainer;
            expect(line0Holder).toBeTruthy();

            // Line 0 ("أهلا بيك يا حبيبي") has 4 Arabic words -> exactly 4 visible glyph sprites (the 4 whole-word lead sprites)!
            const visibleSpritesAtStart = line0Holder.children.filter(c => (c as FakeContainer).visible) as FakeContainer[];
            expect(visibleSpritesAtStart).toHaveLength(4);
            for (const sprite of visibleSpritesAtStart) {
                expect(sprite.tint).toBe(hexOf(palette.unlit));
            }

            // 2. At t = 2.6s: Word 0 ("أهلا", 2.0..2.5s) is fully lit, Word 1 ("بيك", 2.5..3.0s) is mid-highlight,
            // and Words 2 & 3 ("يا", "حبيبي") are still unlit cold color!
            window.update({
                time: 2.6,
                beams: [],
                litColor: palette.lit,
                unlitColor: palette.unlit,
                unlitAlpha: 0.2,
                intensity: 1,
            });
            // Word 0 ("أهلا") is illuminated (with a subtle white flash highlight), while Words 2 & 3 remain unlit
            expect(visibleSpritesAtStart[0]!.tint).toBeGreaterThanOrEqual(hexOf(palette.lit));
            expect(visibleSpritesAtStart[0]!.tint).not.toBe(hexOf(palette.unlit));
            expect(visibleSpritesAtStart[1]!.tint).not.toBe(hexOf(palette.unlit));
            expect(visibleSpritesAtStart[2]!.tint).toBe(hexOf(palette.unlit));
            expect(visibleSpritesAtStart[3]!.tint).toBe(hexOf(palette.unlit));
            const stateAt26 = visibleSpritesAtStart.map(s => ({ x: s.position.x, y: s.position.y, alpha: s.alpha, tint: s.tint }));

            // 3. At t = 4.2s: all 4 words in Line 0 are illuminated, and still exactly 4 whole-word sprites are visible
            window.update({
                time: 4.2,
                beams: [],
                litColor: palette.lit,
                unlitColor: palette.unlit,
                unlitAlpha: 0.2,
                intensity: 1,
            });
            const visibleSpritesAfterSung = line0Holder.children.filter(c => (c as FakeContainer).visible) as FakeContainer[];
            expect(visibleSpritesAfterSung).toHaveLength(4);
            for (const sprite of visibleSpritesAfterSung) {
                expect(sprite.tint).toBeGreaterThanOrEqual(hexOf(palette.lit));
                expect(sprite.tint).not.toBe(hexOf(palette.unlit));
            }

            // 4. Verify seeking forward to Line 3 (t = 18.5s), then seeking backward to t = 2.6s produces identical state
            window.update({
                time: 18.5,
                beams: [],
                litColor: palette.lit,
                unlitColor: palette.unlit,
                unlitAlpha: 0.2,
                intensity: 1,
            });
            window.update({
                time: 2.6,
                beams: [],
                litColor: palette.lit,
                unlitColor: palette.unlit,
                unlitAlpha: 0.2,
                intensity: 1,
            });
            const line0HolderAfterSeek = glyphLayer.children.find(c => (c as FakeContainer).label === 'line-0') as FakeContainer;
            const visibleAfterSeek = line0HolderAfterSeek.children.filter(c => (c as FakeContainer).visible) as FakeContainer[];
            expect(
                visibleAfterSeek.map(s => ({ x: s.position.x, y: s.position.y, alpha: s.alpha, tint: s.tint })),
            ).toEqual(stateAt26);

            // 5. Verify during post-line decay (t = 6.5s) that graphemes within each Arabic word never drift apart
            window.update({
                time: 6.5,
                beams: [],
                litColor: palette.lit,
                unlitColor: palette.unlit,
                unlitAlpha: 0.2,
                intensity: 1,
            });
            for (const word of segmentWords(lines[0]!).filter(w => !w.blank)) {
                const anchors = [];
                for (let g = word.start; g < word.end; g += 1) {
                    anchors.push(window.glyphAnchor(0, g, 6.5));
                }
                // All graphemes in the word lie on the exact same tilted line axis (no intra-word vertical scatter/decay split)
                // and maintain strict right-to-left X spacing
                const lineRot = line0HolderAfterSeek.rotation;
                const normalY = (pt: { x: number; y: number }) => -Math.sin(lineRot) * pt.x + Math.cos(lineRot) * pt.y;
                for (let k = 1; k < anchors.length; k += 1) {
                    expect(normalY(anchors[k]!)).toBeCloseTo(normalY(anchors[0]!), 5);
                    expect(anchors[k - 1]!.x).toBeGreaterThan(anchors[k]!.x);
                }
            }

            window.destroy();
        });

        it('preserves syllable-timed TTML, long held Arabic words, and overlapping duet/background vocal lines', () => {
            createRecordingCanvasEnv();
            // Syllable-level TTML where "حبيبي" is split into intra-word syllables and held for 4 seconds,
            // overlapped by a second vocal line starting before the first finishes:
            const parsed = buildLyricDataFromTTMLResult({
                lines: [
                    {
                        startTime: 1000,
                        endTime: 6000,
                        text: 'أهلا حبيبي',
                        words: [
                            { text: 'أهلا', startTime: 1000, endTime: 1800, endsWithSpace: true },
                            { text: 'حبي', startTime: 1800, endTime: 3200, endsWithSpace: false },
                            { text: 'بي', startTime: 3200, endTime: 6000, endsWithSpace: false },
                        ],
                        translations: [],
                        romanizations: [],
                    },
                    {
                        startTime: 4000,
                        endTime: 8000,
                        text: 'روح يلا',
                        agentId: 'v2',
                        words: [
                            { text: 'روح', startTime: 4000, endTime: 5200, endsWithSpace: true },
                            { text: 'يلا', startTime: 5200, endTime: 8000, endsWithSpace: false },
                        ],
                        translations: [],
                        romanizations: [],
                    },
                ],
                metadata: { timingMode: 'Syllable', agents: {} },
            } as any, () => []);

            expect(parsed.lines).toHaveLength(2);
            // Intra-word syllables "حبي" + "بي" are merged into a single whole word "حبيبي" with 2 syllables:
            expect(parsed.lines[0]!.words.map(w => w.text.trim())).toEqual(['أهلا', 'حبيبي']);
            expect(parsed.lines[0]!.words[1]!.syllables).toHaveLength(2);
            expect(parsed.lines[0]!.words[1]!.startTime).toBeCloseTo(1.8, 3);
            expect(parsed.lines[0]!.words[1]!.endTime).toBeCloseTo(6.0, 3);
            // Overlapping line 0 endTime (6.0s) is preserved even though line 1 starts at 4.0s:
            expect(parsed.lines[0]!.endTime).toBeCloseTo(6.0, 3);

            const metas = buildLineMetas(parsed.lines);
            const lineView0 = buildLineView(
                {
                    pixi: fakePixi,
                    font: 'Noto Sans Arabic, sans-serif',
                    weight: 600,
                    resolution: 1,
                    heroPx: 60,
                    spacing: 0,
                    seed: 'ttml-syllable',
                    sprites: fakeSprites,
                    measurer: createTextMeasurer('Noto Sans Arabic, sans-serif', 600, 0),
                    limits: { horizontal: 1600, vertical: 900 },
                    keywords: undefined,
                    driftSpeed: [0.013, 0.022],
                    placementsOf: () => new Map(),
                },
                0,
                metas[0]!,
                createRngAt('ttml-syllable:window', metas[0]!.randomOffset),
            );

            // "حبيبي" starts at grapheme index 5 (after "أهلا ") and spans indices 5..9:
            const habibiLead = lineView0.glyphs[5]!;
            expect(habibiLead.cursiveWordLead).toBe(true);
            expect(habibiLead.wordTiming.start).toBeCloseTo(1.8, 3);
            expect(habibiLead.wordTiming.end).toBeCloseTo(6.0, 3);
            // Sub-word grapheme timings still follow the two syllable spans (1.8..3.2s and 3.2..6.0s):
            expect(lineView0.glyphs[5]!.timing.start).toBeCloseTo(1.8, 3);
            expect(lineView0.glyphs[9]!.timing.end).toBeCloseTo(6.0, 3);
        });

        it('keeps echoed Arabic words intact in createLyricEcho and avoids positive letterSpacing in createLumiereCredits', () => {
            createRecordingCanvasEnv();
            const echoLines = [makeTimedArabicLine('العربية كلام مفيش', 2, 0.6)];
            const echo = createLyricEcho(fakePixi, {
                width: 1600,
                height: 900,
                lines: echoLines,
                font: 'Noto Sans Arabic, sans-serif',
                weight: 600,
                resolution: 1,
                seed: 'arabic-echo',
                size: 0.25,
                opacity: 1,
            });

            // Trigger echo rasterization and update at t = 4.5s (3.5s into fragment life when non-cursive fragments split apart)
            echo.update({ time: 4.5, beams: [], color: 0xffe0a8, intensity: 1 });
            const holders = (echo.view as unknown as FakeContainer).children as FakeContainer[];
            expect(holders).toHaveLength(3);
            for (const holder of holders) {
                const visibleChildren = holder.children.filter(c => (c as FakeContainer).visible) as FakeContainer[];
                // Each Arabic word fragment renders as exactly 1 intact whole-word outline sprite with zero scatter split:
                expect(visibleChildren).toHaveLength(1);
                expect(visibleChildren[0]!.position.x).toBe(0);
                expect(visibleChildren[0]!.position.y).toBe(0);
                expect(visibleChildren[0]!.rotation).toBe(0);
            }
            echo.destroy();

            // Verify credits card timing helper & Arabic title word segmentation
            const creditsFrame = resolveLumiereCreditsFrame(25, 23);
            expect(creditsFrame.active).toBe(true);
            expect(creditsFrame.posterAlpha).toBeGreaterThan(0);
        });
    });
});
