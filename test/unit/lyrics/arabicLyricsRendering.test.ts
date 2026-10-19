import { describe, expect, it } from 'vitest';
import {
    buildShapedArabicPrefix,
    buildShapedArabicSlice,
    containsArabicText,
    containsRtlText,
    detectTextDirection,
    doesArabicGraphemeJoinBetween,
    hasCursiveJoiningScript,
    isArabicLamAlefPair,
    isMixedDirectionText,
    mergeContiguousArabicWordsInLine,
    normalizeArabicForMatch,
    orderBidiItemsForVisualRow,
    resolveTokenDirection,
    shapeArabicGraphemesInContext,
    splitCodePointsWithCombiningMarks,
    stripArabicDiacritics,
} from '@/utils/lyrics/arabicText';
import {
    parseEnhancedLRC,
    parseLRC,
} from '@/utils/lyrics/parserCore';
import { buildLyricDataFromTTMLResult } from '@/utils/lyrics/ttmlConversion';
import { buildLineGraphemeTimeline, splitLyricGraphemes } from '@/utils/lyrics/graphemeTiming';
import { buildPostLyricLayoutUnits } from '@/utils/lyrics/cjkSemanticLayout';
import { SentenceLayout } from '@/utils/lyrics/sentenceLayout';
import { measurePrefixOffsets } from '@/components/visualizer/textMeasureCache';
import { buildWordColorRanges, resolveWordColor } from '@/components/visualizer/wordColoring';
import { BUILTIN_FONT_STACKS, TRANSLATION_FONT_STACKS } from '@/utils/fontStacks';
import { buildMonetDisplayTokens, measureMonetGraphemeOffsets } from '@/components/visualizer/monet/monetLyricsModel';
import { wrapLatticeTokens } from '@/components/app/lattice/lyrics/latticeLyricLayout';
import { resolveLinePassCutoffTime } from '@/components/visualizer/fume/fumeReveal';
import { drawRenderTextRun } from '@/components/visualizer/fume/fumeCanvasText';
import { buildSonnetGlyphLayout } from '@/components/visualizer/sonnet/sonnetGlyphLayout';
import { type SonnetTypographyPlacement } from '@/components/visualizer/sonnet/sonnetTypographyLayout';
import { buildSonnetSemanticSegments, compileSonnetProgram } from '@/components/visualizer/sonnet/sonnetProgram';
import { buildTemperaSegments, compileTemperaProgram } from '@/components/visualizer/tempera/temperaProgram';
import { buildTemperaWordUnit, createTemperaMeasureContext } from '@/components/visualizer/tempera/temperaMeasure';
import { resolveTemperaLayout } from '@/components/visualizer/tempera/temperaLayout';
import { getCharacterRevealPlan } from '@/components/visualizer/cappella/cappellaReveal';
import { buildMeasuredSpacingInfo } from '@/components/visualizer/claddagh/claddaghLayout';
import { splitDioramaLyricUnits } from '@/components/visualizer/diorama/dioramaSceneLayout';
import { createTextMeasurer, flowLine } from '@/components/visualizer/lumiere/text/lineWrap';
import { segmentWords } from '@/components/visualizer/lumiere/text/wordStyle';

describe('Phase 3: Arabic lyric rendering, shaping, bidi layout, and synchronized highlighting', () => {
    describe('Arabic typography, diacritics, joining rules, and direction detection', () => {
        it('detects Egyptian Arabic, diacritics, hamza forms, tatweel, and Arabic punctuation accurately', () => {
            const egyptianLine = 'الليلة دي حلوة أوي يا حبيبي، تعالَ نعيش في مصر!';
            const vocalizedLine = 'بِحِبَّكْ يَا قَلْبِي وَلاَ أَنْسَاكَ أَبَدًا؟';
            const englishLine = 'Tonight we sing under the Cairo stars';
            const mixedRtlFirst = 'يا حبيبي Live in Cairo 2026، ولا إيه؟';
            const mixedLtrFirst = 'Cairo 2026 — يا حبيبي في الليل';

            expect(containsArabicText(egyptianLine)).toBe(true);
            expect(containsRtlText(egyptianLine)).toBe(true);
            expect(hasCursiveJoiningScript(egyptianLine)).toBe(true);
            expect(containsArabicText(englishLine)).toBe(false);
            expect(hasCursiveJoiningScript(englishLine)).toBe(false);

            expect(detectTextDirection(egyptianLine)).toBe('rtl');
            expect(detectTextDirection(vocalizedLine)).toBe('rtl');
            expect(detectTextDirection(englishLine)).toBe('ltr');
            expect(detectTextDirection(mixedRtlFirst)).toBe('rtl');
            expect(detectTextDirection(mixedLtrFirst)).toBe('ltr');

            expect(isMixedDirectionText(mixedRtlFirst)).toBe(true);
            expect(isMixedDirectionText(egyptianLine)).toBe(false);
            expect(isMixedDirectionText(englishLine)).toBe(false);

            expect(resolveTokenDirection('حبيبي', 'ltr')).toBe('rtl');
            expect(resolveTokenDirection('Cairo', 'rtl')).toBe('ltr');
            expect(resolveTokenDirection('2026', 'rtl')).toBe('ltr');
            expect(resolveTokenDirection('،', 'rtl')).toBe('rtl');
        });

        it('preserves combining marks (harakat, shadda, tanween, maddah, superscript alef) with base letters', () => {
            const vocalizedWord = 'مُحَمَّدٌ';
            const graphemes = splitLyricGraphemes(vocalizedWord);
            const fallbackGraphemes = splitCodePointsWithCombiningMarks(vocalizedWord);

            expect(graphemes).toEqual(['مُ', 'حَ', 'مَّ', 'دٌ']);
            expect(fallbackGraphemes).toEqual(['مُ', 'حَ', 'مَّ', 'دٌ']);
            expect(stripArabicDiacritics('بِحِبَّكْ يَا مِصْرُ')).toBe('بحبك يا مصر');
            expect(normalizeArabicForMatch('أَحْبَبْتُكَ يَا غَالِي')).toBe('احببتك يا غالي');
        });

        it('respects dual-joining vs right-joining Arabic letters and Lam-Alef ligatures when shaping prefixes', () => {
            // In "حبيبي", every letter is dual-joining (ح-ب-ي-ب-ي).
            const habibi = splitLyricGraphemes('حبيبي');
            expect(doesArabicGraphemeJoinBetween(habibi, 0)).toBe(true);
            expect(doesArabicGraphemeJoinBetween(habibi, 1)).toBe(true);
            expect(doesArabicGraphemeJoinBetween(habibi, 2)).toBe(true);
            expect(doesArabicGraphemeJoinBetween(habibi, 3)).toBe(true);
            expect(buildShapedArabicPrefix(habibi, 1)).toBe('ح\u200D');
            expect(buildShapedArabicPrefix(habibi, 2)).toBe('حب\u200D');
            expect(buildShapedArabicPrefix(habibi, 5)).toBe('حبيبي');

            // In "وردة", و (waw), ر (reh), and د (dal) are right-joining only and do not join to the left.
            const warda = splitLyricGraphemes('وردة');
            expect(doesArabicGraphemeJoinBetween(warda, 0)).toBe(false);
            expect(doesArabicGraphemeJoinBetween(warda, 1)).toBe(false);
            expect(doesArabicGraphemeJoinBetween(warda, 2)).toBe(false);
            expect(buildShapedArabicPrefix(warda, 1)).toBe('و');

            // Mandatory Lam-Alef ligatures (لا / لأ / لإ / لآ) even with diacritics on Lam:
            const lamAlef = splitLyricGraphemes('لَا');
            expect(isArabicLamAlefPair(lamAlef[0]!, lamAlef[1]!)).toBe(true);
            expect(doesArabicGraphemeJoinBetween(lamAlef, 0)).toBe(true);

            // Contextual ZWJ shaping for per-grapheme spans:
            const shapedSpans = shapeArabicGraphemesInContext(habibi);
            expect(shapedSpans[0]).toBe('ح\u200D');
            expect(shapedSpans[1]).toBe('\u200Dب\u200D');
            expect(shapedSpans[4]).toBe('\u200Dي');

            // Substring slice shaping:
            expect(buildShapedArabicSlice('حبيبي', 0, 2)).toBe('حب\u200D');
            expect(buildShapedArabicSlice('حبيبي', 2, 5)).toBe('\u200Dيبي');
        });

        it('orders RTL and mixed bidi items into UAX #9 visual left-to-right row order without mutating logical arrays', () => {
            const logicalWords = ['يا', 'حبيبي', 'Live', '2026', 'مصر'];
            const copy = [...logicalWords];
            const visualRow = orderBidiItemsForVisualRow(logicalWords, item => item, 'rtl');

            // Logical array is untouched:
            expect(logicalWords).toEqual(copy);
            // Visual left-to-right order on an RTL line places "مصر" on the far left,
            // the LTR run "Live 2026" in the middle (preserving Live -> 2026 LTR order),
            // and "حبيبي" then "يا" on the far right:
            expect(visualRow).toEqual(['مصر', 'Live', '2026', 'حبيبي', 'يا']);
        });
    });

    describe('TTML, Enhanced LRC, and ordinary LRC parsing with Arabic lyrics and overlapping vocals', () => {
        it('merges intra-word Arabic syllables in syllable-timed TTML while preserving sub-word syllable timings and original word order', () => {
            const ttmlResult = {
                lines: [{
                    startTime: 1000,
                    endTime: 3200,
                    text: 'يا حبيبي مصر',
                    words: [
                        { text: 'يا', startTime: 1000, endTime: 1400, endsWithSpace: true },
                        { text: 'حبي', startTime: 1400, endTime: 1900, endsWithSpace: false },
                        { text: 'بي', startTime: 1900, endTime: 2400, endsWithSpace: true },
                        { text: 'مصر', startTime: 2400, endTime: 3200, endsWithSpace: false },
                    ],
                    translations: [],
                    romanizations: [],
                }],
                metadata: { timingMode: 'Syllable', agents: {} },
            };
            const parsed = buildLyricDataFromTTMLResult(ttmlResult as any, () => []);
            expect(parsed.lines).toHaveLength(1);
            const line = parsed.lines[0]!;

            expect(line.fullText).toBe('يا حبيبي مصر');
            // "حبي" + "بي" must be merged into a single intact word "حبيبي" so DOM/Canvas never splits mid-word:
            expect(line.words.map(word => word.text.trim())).toEqual(['يا', 'حبيبي', 'مصر']);
            expect(line.words[1]!.startTime).toBeCloseTo(1.4, 3);
            expect(line.words[1]!.endTime).toBeCloseTo(2.4, 3);
            expect(line.words[1]!.syllables?.map(s => s.text.trim())).toEqual(['حبي', 'بي']);
        });

        it('parses word-level TTML, overlapping duet lines, and background vocals without truncating overlapping line endTimes', () => {
            const ttmlResult = {
                lines: [
                    {
                        startTime: 2000,
                        endTime: 6500,
                        text: 'الليلة عيدنا',
                        agentId: 'v1',
                        words: [
                            { text: 'الليلة', startTime: 2000, endTime: 3500, endsWithSpace: true },
                            { text: 'عيدنا', startTime: 3500, endTime: 6500, endsWithSpace: false },
                        ],
                        translations: [],
                        romanizations: [],
                        backgroundVocal: {
                            startTime: 4000,
                            endTime: 6200,
                            text: '(يا ليل)',
                            words: [
                                { text: 'يا', startTime: 4000, endTime: 5000, endsWithSpace: true },
                                { text: 'ليل', startTime: 5000, endTime: 6200, endsWithSpace: false },
                            ],
                            translations: [],
                            romanizations: [],
                        },
                    },
                    {
                        startTime: 4200,
                        endTime: 7800,
                        text: 'غني معانا',
                        agentId: 'v2',
                        words: [
                            { text: 'غني', startTime: 4200, endTime: 5800, endsWithSpace: true },
                            { text: 'معانا', startTime: 5800, endTime: 7800, endsWithSpace: false },
                        ],
                        translations: [],
                        romanizations: [],
                    },
                ],
                metadata: {
                    timingMode: 'Word',
                    agents: {
                        v1: { id: 'v1', type: 'person' },
                        v2: { id: 'v2', type: 'person' },
                    },
                },
            };
            const parsed = buildLyricDataFromTTMLResult(ttmlResult as any, () => []);
            const first = parsed.lines[0]!;

            // First line preserves its full 6.5s endTime while folding the overlapping v2 duet and background vocal:
            expect(first.startTime).toBeCloseTo(2.0, 3);
            expect(first.endTime).toBeCloseTo(6.5, 3);
            expect(first.backgroundVocals?.length).toBe(2);
            expect(first.backgroundVocals?.[0]?.text).toContain('يا ليل');
            expect(first.backgroundVocals?.[1]?.text).toBe('غني معانا');
            expect(first.backgroundVocals?.[1]?.startTime).toBeCloseTo(4.2, 3);
            expect(first.backgroundVocals?.[1]?.endTime).toBeCloseTo(7.8, 3);
        });

        it('parses Enhanced LRC and ordinary LRC with vocalized Egyptian Arabic and mixed English/digits', () => {
            const enhancedLrc = [
                '[00:01.00]<00:01.00>بِحِبَّكْ <00:01.80>يا <00:02.30>مِصْرُ <00:03.10>2026',
                '[00:04.00]<00:04.00>Tonight <00:04.60>we <00:05.00>sing <00:05.60>together',
            ].join('\n');
            const parsed = parseEnhancedLRC(enhancedLrc);
            expect(parsed.lines.length).toBeGreaterThanOrEqual(2);

            const rtlLine = parsed.lines.find(l => l.fullText.includes('بِحِبَّكْ'))!;
            const ltrLine = parsed.lines.find(l => l.fullText.includes('Tonight'))!;
            expect(detectTextDirection(rtlLine.fullText)).toBe('rtl');
            expect(detectTextDirection(ltrLine.fullText)).toBe('ltr');
            expect(rtlLine.words.map(w => w.text.trim())).toEqual(['بِحِبَّكْ', 'يا', 'مِصْرُ', '2026']);
            expect(rtlLine.words[0]!.startTime).toBeCloseTo(1.0, 2);
            expect(rtlLine.words[1]!.startTime).toBeCloseTo(1.8, 2);
            expect(rtlLine.words[2]!.startTime).toBeCloseTo(2.3, 2);
            expect(rtlLine.words[3]!.startTime).toBeCloseTo(3.1, 2);

            // Ordinary LRC:
            const ordinaryLrc = parseLRC('[00:01.00]الليلة دي حلوة أوي يا قلبي\n[00:05.00]We dance until dawn');
            const ordinaryRtl = ordinaryLrc.lines.find(l => l.fullText.includes('الليلة'))!;
            expect(detectTextDirection(ordinaryRtl.fullText)).toBe('rtl');
            expect(ordinaryRtl.words.map(w => w.text)).toEqual(['الليلة', 'دي', 'حلوة', 'أوي', 'يا', 'قلبي']);
        });

        it('merges contiguous intra-word Arabic segments in mergeContiguousArabicWordsInLine without merging space-separated words', () => {
            const splitWordLine = {
                fullText: 'حبيبي يا نور',
                startTime: 1,
                endTime: 4,
                words: [
                    { text: 'حبي', startTime: 1.0, endTime: 1.6 },
                    { text: 'بي', startTime: 1.6, endTime: 2.2 },
                    { text: 'يا', startTime: 2.2, endTime: 2.8 },
                    { text: 'نور', startTime: 2.8, endTime: 4.0 },
                ],
            };
            const merged = mergeContiguousArabicWordsInLine(splitWordLine);
            expect(merged.words).toHaveLength(3);
            expect(merged.words.map(w => w.text)).toEqual(['حبيبي', 'يا', 'نور']);
            expect(merged.words[0]!.syllables?.map(s => s.text)).toEqual(['حبي', 'بي']);
        });
    });

    describe('Shaping-aware measurement, word segmentation, keyword coloring, and offline Arabic fonts', () => {
        it('uses ZWJ-shaped prefixes and Lam-Alef ligature interpolation in measurePrefixOffsets', () => {
            const measuredQueries: string[] = [];
            const graphemes = splitLyricGraphemes('لا حبيبي');
            const offsets = measurePrefixOffsets(graphemes, prefix => {
                measuredQueries.push(prefix);
                // Simulate ligature compression where "لا" is narrower than "ل" + "ا"
                const clean = prefix.replace(/\u200D/g, '');
                return clean.replace('لا', 'X').length * 12;
            });

            expect(offsets).toHaveLength(graphemes.length + 1);
            expect(offsets[0]).toBe(0);
            // Monotonically non-decreasing and clamped to full shaped width:
            for (let i = 1; i < offsets.length; i += 1) {
                expect(offsets[i]!).toBeGreaterThanOrEqual(offsets[i - 1]!);
            }
            // Lam-Alef ligature midpoint is interpolated smoothly between 0 and full "لا" width (12):
            expect(offsets[1]).toBeCloseTo(6, 3);
            expect(offsets[2]).toBeCloseTo(12, 3);
            // Intra-word prefixes of "حبيبي" include trailing ZWJ for contextual glyph shaping:
            expect(measuredQueries.some(q => q.endsWith('\u200D'))).toBe(true);
        });

        it('matches vocalized and unvocalized Arabic keywords in wordColoring', () => {
            const rules = [{ word: 'حبيبي', color: '#ff3366' }];
            const text = 'يا حَبِيبِي تعالَ';
            const ranges = buildWordColorRanges(text, rules);

            expect(ranges).toHaveLength(1);
            expect(text.slice(ranges[0]!.startOffset, ranges[0]!.endOffset)).toBe('حَبِيبِي');
            expect(resolveWordColor('حَبِيبِي،', rules, '#ffffff')).toBe('#ff3366');
        });

        it('keeps Arabic punctuation attached to words in CJK semantic layout and SentenceLayout', () => {
            const line = {
                fullText: 'بحبك يا مصر، ولا أنساك؟',
                startTime: 0,
                endTime: 4,
                words: [
                    { text: 'بحبك', startTime: 0, endTime: 1 },
                    { text: 'يا', startTime: 1, endTime: 1.8 },
                    { text: 'مصر', startTime: 1.8, endTime: 2.6 },
                    { text: '،', startTime: 2.6, endTime: 2.8 },
                    { text: 'ولا', startTime: 2.8, endTime: 3.4 },
                    { text: 'أنساك', startTime: 3.4, endTime: 3.9 },
                    { text: '؟', startTime: 3.9, endTime: 4.0 },
                ],
            };
            const units = buildPostLyricLayoutUnits(line, { semantic: false, sticky: true });
            expect(units.map(u => u.text)).toEqual(['بحبك', 'يا', 'مصر،', 'ولا', 'أنساك؟']);

            const splitSentences = SentenceLayout.splitIntoSentences(line.fullText, 2, 42);
            expect(splitSentences.map(s => s.text).join(' ')).toContain('مصر،');
        });

        it('includes offline system Arabic fonts in built-in and translation font stacks', () => {
            for (const stack of Object.values(BUILTIN_FONT_STACKS)) {
                expect(stack.includes('Arabic') || stack.includes('Geeza') || stack.includes('Amiri')).toBe(true);
            }
            for (const stack of Object.values(TRANSLATION_FONT_STACKS)) {
                expect(stack.includes('Arabic') || stack.includes('Geeza') || stack.includes('Amiri')).toBe(true);
            }
        });
    });

    describe('Visualizer rendering paths: Monet, Lattice, Fume, Lumiere, Sonnet, Tempera, Diorama, Cadenza, Cappella, Claddagh', () => {
        const arabicLine = {
            fullText: 'يا حبيبي 2026',
            startTime: 1.0,
            endTime: 4.0,
            words: [
                { text: 'يا', startTime: 1.0, endTime: 1.8 },
                { text: 'حبيبي', startTime: 1.8, endTime: 3.0 },
                { text: '2026', startTime: 3.0, endTime: 4.0 },
            ],
        };

        it('Monet: preserves intact Arabic words and computes monotonic grapheme offsets', () => {
            const tokens = buildMonetDisplayTokens(arabicLine);
            const timedTokens = tokens.filter(token => token.timed);
            expect(timedTokens.map(token => token.text)).toEqual(['يا', 'حبيبي', '2026']);

            const offsets = measureMonetGraphemeOffsets('حبيبي', 32, '600 32px sans-serif');
            expect(offsets).toHaveLength(6);
            for (let i = 1; i < offsets.length; i += 1) {
                expect(offsets[i]!).toBeGreaterThanOrEqual(offsets[i - 1]!);
            }
        });

        it('Lattice: right-aligns RTL lines, orders mixed bidi runs visually, and marks Arabic slices rtl=true for right-to-left shader sweep', () => {
            const tokens = buildMonetDisplayTokens(arabicLine);
            const pieces = wrapLatticeTokens(
                tokens,
                400,
                '600 24px sans-serif',
                28,
                text => ({ width: Array.from(text).length * 12, height: 24 }),
            );
            const timedPieces = pieces.filter(piece => piece.token.timed);
            expect(timedPieces).toHaveLength(3);

            // Logical piece order is preserved (يا -> حبيبي -> 2026):
            expect(timedPieces.map(p => p.text.trim())).toEqual(['يا', 'حبيبي', '2026']);
            expect(timedPieces[0]!.rtl).toBe(true);
            expect(timedPieces[1]!.rtl).toBe(true);
            expect(timedPieces[2]!.rtl).toBe(false);

            // Visually on the RTL row, "يا" (first sung word) sits furthest right, "حبيبي" in the middle, "2026" on the left:
            expect(timedPieces[0]!.x).toBeGreaterThan(timedPieces[1]!.x);
            expect(timedPieces[1]!.x).toBeGreaterThan(timedPieces[2]!.x);
        });

        it('Fume: preserves overlapping line endTime and clips RTL runs from right to left', () => {
            // Overlapping vocal lines: line ends at 6.0s while next line starts at 3.5s
            const overlappingLine = {
                ...arabicLine,
                startTime: 1.0,
                endTime: 6.0,
                renderHints: {
                    rawDuration: 5.0,
                    timingClass: 'normal' as const,
                    renderEndTime: 6.4,
                    lineTransitionMode: 'normal' as const,
                    wordRevealMode: 'normal' as const,
                },
            };
            // Must not truncate before line.endTime (6.0), but still cuts post-line hold when nextLine >= line.endTime:
            expect(resolveLinePassCutoffTime(overlappingLine, 3.5)).toBeCloseTo(6.0, 5);
            expect(resolveLinePassCutoffTime(overlappingLine, 6.1)).toBeCloseTo(6.1, 5);

            // Right-to-left clipping in drawRenderTextRun for RTL segments:
            const clipRects: Array<{ x: number; y: number; w: number; h: number }> = [];
            const fakeCtx = {
                direction: 'ltr',
                save() {},
                restore() {},
                beginPath() {},
                rect(x: number, y: number, w: number, h: number) {
                    clipRects.push({ x, y, w, h });
                },
                clip() {},
                fillText() {},
            } as unknown as CanvasRenderingContext2D;

            const fakeRenderLine = {
                id: '0',
                text: 'حبيبي',
                start: 0,
                end: 5,
                graphemes: ['ح', 'ب', 'ي', 'ب', 'ي'],
                glyphOffsets: [0, 10, 20, 30, 40],
                segments: [],
                left: 0,
                top: 0,
                width: 50,
            };
            const rtlSegment = {
                text: 'حبيبي',
                start: 0,
                end: 5,
                localStart: 0,
                localEnd: 5,
                x: 100,
                width: 50,
                isFullSegment: true,
                measuredGlyphOffsets: [0, 10, 20, 30, 40, 50],
                rtl: true,
            };

            // Reveal first 2 graphemes (runStart=0, runEnd=2 -> raw [0, 20] -> RTL clip [30, 50] at right edge of segment):
            drawRenderTextRun(fakeCtx, fakeRenderLine, rtlSegment, 0, 2, 0, 50);
            expect(clipRects).toHaveLength(1);
            expect(clipRects[0]!.x).toBeCloseTo(100 + 30, 3);
            expect(clipRects[0]!.w).toBeCloseTo(20, 3);
        });

        it('Lumiere: orders RTL units right-to-left and steps Arabic glyph positions from right to left', () => {
            const measurer = createTextMeasurer('sans-serif', 500, 0.04);
            const text = 'يا حبيبي';
            const graphemes = splitLyricGraphemes(text);
            const words = segmentWords({ fullText: text });
            const flowGlyphs = graphemes.map(char => ({
                char,
                scale: 1,
                advance: 20,
                upright: false,
                jag: 0,
            }));

            const [[singleRow]] = flowLine(measurer, flowGlyphs, words, {
                heroPx: 40,
                limits: { horizontal: 1000, vertical: 1000 },
            });

            // In "يا حبيبي", index 0 ('ي') is the first sung letter on the far right,
            // and index 7 ('ي') is the last sung letter on the far left:
            expect(singleRow.points[0]!.x).toBeGreaterThan(singleRow.points[1]!.x);
            expect(singleRow.points[1]!.x).toBeGreaterThan(singleRow.points[3]!.x);
            expect(singleRow.points[3]!.x).toBeGreaterThan(singleRow.points[7]!.x);
        });

        it('Sonnet: keeps cursive Arabic words intact as whole-word glyph units and preserves overlapping line endTime', () => {
            const segments = buildSonnetSemanticSegments(arabicLine);
            const habibiSeg = segments.find(s => s.text.includes('حبيبي'))!;
            const placement: SonnetTypographyPlacement = {
                segmentIndex: 1,
                displayText: habibiSeg.text,
                role: 'hero',
                fontScale: 1,
                measuredWidth: 120,
                measuredHeight: 48,
                x: 0,
                y: 0,
                rotation: 0,
                enterX: 0,
                enterY: 20,
                vertical: false,
                layoutDirection: 'horizontal',
                timingPhase: 0.5,
            };

            const glyphs = buildSonnetGlyphLayout(
                habibiSeg,
                placement,
                40,
                text => text.length * 18,
                { startTime: 1, endTime: 4 },
            );
            // Whole Arabic word stays intact in one glyph node instead of splitting into isolated code points:
            expect(glyphs).toHaveLength(1);
            expect(glyphs[0]!.char).toBe('حبيبي');

            // Overlapping lines in compileSonnetProgram preserve line.endTime:
            const program = compileSonnetProgram([
                { ...arabicLine, startTime: 1, endTime: 5 },
                { ...arabicLine, startTime: 3, endTime: 7 },
            ]);
            expect(program.paragraphs[0]!.lines[0]!.renderEndTime).toBe(5);
        });

        it('Tempera: keeps cursive Arabic words intact in buildTemperaWordUnit, orders RTL rows right-to-left, and preserves overlapping line endTime', () => {
            const segments = buildTemperaSegments(arabicLine);
            const ctx = createTemperaMeasureContext('sans-serif', 600);
            const habibiSeg = segments.find(s => s.text.includes('حبيبي'))!;
            const wordUnit = buildTemperaWordUnit(ctx, habibiSeg, 0, 1, 48, 1);

            expect(wordUnit).not.toBeNull();
            expect(wordUnit!.glyphs).toHaveLength(1);
            expect(wordUnit!.glyphs[0]!.char).toBe('حبيبي');

            const placements = resolveTemperaLayout({
                lines: [segments],
                shotKind: 'cinema-wide',
                width: 1600,
                height: 720,
                baseFontSize: 24,
                fontFamily: 'sans-serif',
                fontWeight: 600,
                seed: 42,
            });
            expect(placements.map(p => p.char)).toEqual(['يا', 'حبيبي', '2', '0', '2', '6']);
            // On a single RTL row, "يا" is to the right of "حبيبي", which is to the right of "2026":
            expect(placements[0]!.x).toBeGreaterThan(placements[1]!.x);
            expect(placements[1]!.x).toBeGreaterThan(placements[2]!.x);
            // Embedded LTR digits "2026" flow left-to-right:
            expect(placements[2]!.x).toBeLessThan(placements[3]!.x);
            expect(placements[3]!.x).toBeLessThan(placements[4]!.x);
            expect(placements[4]!.x).toBeLessThan(placements[5]!.x);

            // Overlapping lines in compileTemperaProgram preserve line.endTime:
            const program = compileTemperaProgram([
                { ...arabicLine, startTime: 1, endTime: 5 },
                { ...arabicLine, startTime: 3, endTime: 7 },
            ]);
            expect(program.paragraphs[0]!.lines[0]!.renderEndTime).toBe(5);
        });

        it('Diorama, Cappella, and Claddagh: preserve Arabic word units, diacritic graphemes, and right-to-left ring angles', () => {
            // Diorama:
            const timeline = buildLineGraphemeTimeline(arabicLine);
            const dioramaUnits = splitDioramaLyricUnits(arabicLine, timeline);
            expect(dioramaUnits.map(u => u.text)).toEqual(['يا', 'حبيبي', '2026']);

            // Cappella with vocalized Arabic:
            const vocalizedLine = {
                fullText: 'بِحِبَّكْ يَا مِصْرُ',
                startTime: 0,
                endTime: 3,
                words: [
                    { text: 'بِحِبَّكْ', startTime: 0, endTime: 1 },
                    { text: 'يَا', startTime: 1, endTime: 1.8 },
                    { text: 'مِصْرُ', startTime: 1.8, endTime: 3 },
                ],
            };
            const revealPlan = getCharacterRevealPlan(vocalizedLine);
            // Grapheme clusters keep shadda/harakat attached to base letters:
            expect(revealPlan.characters).toEqual(splitLyricGraphemes(vocalizedLine.fullText));
            expect(revealPlan.characters[2]).toBe('بَّ');

            // Claddagh RTL ring angles:
            const claddaghItems = splitLyricGraphemes('يا حبيبي').map(char => ({ char }));
            const spacing = buildMeasuredSpacingInfo(claddaghItems, '700 48px sans-serif', 48, 400);
            // First sung Arabic letter ('ي' of 'يا') sits to the right (greater nominalAngle) of the last letter:
            expect(spacing[0]!.nominalAngle).toBeGreaterThan(spacing[1]!.nominalAngle);
            expect(spacing[1]!.nominalAngle).toBeGreaterThan(spacing[3]!.nominalAngle);
        });
    });
});
