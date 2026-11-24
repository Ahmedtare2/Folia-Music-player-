import type { Line, LyricSyllable, Word } from '../../types';

// src/utils/lyrics/arabicText.ts
// Shared Arabic & bidirectional text analysis, contextual cursive joining (Unicode Standard 9.2),
// shaping-aware prefix measurement, and UAX #9 visual-row ordering for DOM, Canvas 2D, and WebGL lyric renderers.

export type TextDirection = 'ltr' | 'rtl';

/**
 * Matches Arabic script characters across standard blocks (Arabic, Supplement, Extended-A/B/C,
 * Presentation Forms-A/B) as well as other right-to-left cursive scripts (Syriac, N'Ko, Thaana).
 */
const ARABIC_SCRIPT_REGEX = /[\p{Script=Arabic}\p{Script=Syriac}\p{Script=Nko}\p{Script=Thaana}\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/u;

/**
 * Matches any strong Right-to-Left character (Arabic, Hebrew, Syriac, Thaana, N'Ko, Adlam, etc.)
 * or explicit RTL directional controls.
 */
const RTL_STRONG_REGEX = /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Nko}\p{Script=Thaana}\p{Script=Mandaic}\p{Script=Samaritan}\p{Script=Adlam}\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF\u200F\u202B\u202E\u2067]/u;

/**
 * Matches any strong Left-to-Right character (Latin, Greek, Cyrillic, CJK, Hangul, Thai, Devanagari, etc.)
 * or explicit LTR directional controls.
 */
const LTR_STRONG_REGEX = /[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}\p{Script=Devanagari}\u200E\u202A\u202D\u2066]/u;

/**
 * Matches Arabic combining marks (harakat/tashkeel, shadda, tanween, sukun, maddah, hamza above/below,
 * superscript alef, Quranic annotation marks) and general Unicode combining marks.
 */
const ARABIC_DIACRITICS_REGEX = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u08D3-\u08FF\uFE70-\uFE7F\p{M}]/gu;

const COMBINING_MARK_ONLY_REGEX = /^[\p{M}\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF\uFE70-\uFE7F]+$/u;

const NUMERIC_RUN_REGEX = /^[\s\p{N}\p{P}.,:%+-]+$/u;
const NEUTRAL_OR_DIGIT_CHAR_REGEX = /^[\p{P}\p{S}\p{N}\s]+$/u;
const HAS_DIGIT_REGEX = /\p{N}/u;
const WHITESPACE_ONLY_REGEX = /^\s+$/u;

/** Zero-Width Joiner used to preserve initial/medial/final contextual glyph shapes across slices. */
export const ZWJ = '\u200D';

/**
 * Right-joining (R) Arabic base characters per Unicode Standard Section 9.2 (Joining_Type=R).
 * These letters join to a dual-joining letter preceding them (on the right) and never join
 * to a following letter (on the left).
 */
const RIGHT_JOINING_CODEPOINTS = new Set<number>([
    0x0622, // آ ALEF WITH MADDA ABOVE
    0x0623, // أ ALEF WITH HAMZA ABOVE
    0x0624, // ؤ WAW WITH HAMZA ABOVE
    0x0625, // إ ALEF WITH HAMZA BELOW
    0x0627, // ا ALEF
    0x0629, // ة TEH MARBUTA
    0x062F, // د DAL
    0x0630, // ذ THAL
    0x0631, // ر REH
    0x0632, // ز ZAIN
    0x0648, // و WAW
    0x0671, // ٱ ALEF WASLA
    0x0672, // ٲ ALEF WITH WAVY HAMZA ABOVE
    0x0673, // ٳ ALEF WITH WAVY HAMZA BELOW
    0x0675, // ٵ HIGH HAMZA ALEF
    0x0676, // ٶ HIGH HAMZA WAW
    0x0677, // ٷ U WITH HAMZA ABOVE
    0x0688, 0x0689, 0x068A, 0x068B, 0x068C, 0x068D, 0x068E, 0x068F, 0x0690, // Dal variants
    0x0691, 0x0692, 0x0693, 0x0694, 0x0695, 0x0696, 0x0697, 0x0698, 0x0699, // Reh variants (incl. ژ)
    0x06C0, 0x06C3, // Teh marbuta goal / variants
    0x06C4, 0x06C5, 0x06C6, 0x06C7, 0x06C8, 0x06C9, 0x06CA, 0x06CB, 0x06CF, // Waw variants
    0x06D2, 0x06D3, // Yeh barree
    0x06D5, // Ae
    0x06EE, 0x06EF, // Dal/Reh with inverted V
]);

/**
 * Non-joining (U) Arabic letters inside the main Arabic block.
 */
const NON_JOINING_ARABIC_CODEPOINTS = new Set<number>([
    0x0621, // ء HAMZA (isolated)
    0x0674, // ٴ HIGH HAMZA
]);

/**
 * Alef variants that form a mandatory Lam-Alef ligature (لا / لأ / لإ / لآ / لٱ) when preceded by Lam (ل).
 */
const ALEF_LIGATURE_CODEPOINTS = new Set<number>([
    0x0622, // آ
    0x0623, // أ
    0x0625, // إ
    0x0627, // ا
    0x0671, // ٱ
]);

/** True when `text` contains Arabic (or cursive RTL) script characters. */
export const containsArabicText = (text: string | null | undefined): boolean => (
    Boolean(text && ARABIC_SCRIPT_REGEX.test(text))
);

/** True when `text` contains any right-to-left script character (Arabic, Hebrew, etc.). */
export const containsRtlText = (text: string | null | undefined): boolean => (
    Boolean(text && RTL_STRONG_REGEX.test(text))
);

/**
 * True when `text` contains a script whose letters cursively join to neighbors (such as Arabic)
 * and therefore must never be rendered as isolated code points or spaced apart with positive letter-spacing.
 */
export const hasCursiveJoiningScript = (text: string | null | undefined): boolean => (
    containsArabicText(text)
);

/**
 * Strips Arabic diacritics (tashkeel/harakat, shadda, tanween, superscript alef) while keeping base letters.
 */
export const stripArabicDiacritics = (text: string): string => (
    text ? text.replace(ARABIC_DIACRITICS_REGEX, '') : ''
);

/**
 * Normalizes Arabic text for search and keyword matching (strips diacritics and tatweel, unifies alef/hamza
 * and teh marbuta / alef maksura variants) without ever altering display text.
 */
export const normalizeArabicForMatch = (text: string): string => (
    stripArabicDiacritics(text)
        .replace(/\u0640/g, '')
        .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
        .replace(/\u0629/g, '\u0647')
        .replace(/\u0649/g, '\u064A')
);

/**
 * Detects the dominant / first-strong paragraph direction of a lyric line per Unicode UAX #9.
 * Scans for the first strong directional character; if none is found, falls back to `fallback`.
 */
export const detectTextDirection = (
    text: string | null | undefined,
    fallback: TextDirection = 'ltr',
): TextDirection => {
    if (!text) {
        return fallback;
    }

    for (const char of text) {
        if (NEUTRAL_OR_DIGIT_CHAR_REGEX.test(char)) {
            continue;
        }
        if (RTL_STRONG_REGEX.test(char)) {
            return 'rtl';
        }
        if (LTR_STRONG_REGEX.test(char)) {
            return 'ltr';
        }
    }

    return fallback;
};

/**
 * Resolves the sweep and shaping direction of an individual token inside a line.
 * - Tokens with strong RTL characters are `'rtl'`.
 * - Tokens with strong LTR characters are `'ltr'`.
 * - Pure numeric tokens (`123`, `٢٠٢٦`) are `'ltr'` per Unicode UAX #9 (numbers in Arabic read left-to-right).
 * - Neutral tokens (spaces, punctuation) inherit `lineDirection`.
 */
export const resolveTokenDirection = (
    tokenText: string | null | undefined,
    lineDirection: TextDirection = 'ltr',
): TextDirection => {
    if (!tokenText) {
        return lineDirection;
    }

    for (const char of tokenText) {
        if (NEUTRAL_OR_DIGIT_CHAR_REGEX.test(char)) {
            continue;
        }
        if (RTL_STRONG_REGEX.test(char)) {
            return 'rtl';
        }
        if (LTR_STRONG_REGEX.test(char)) {
            return 'ltr';
        }
    }

    if (HAS_DIGIT_REGEX.test(tokenText) && NUMERIC_RUN_REGEX.test(tokenText)) {
        return 'ltr';
    }

    return lineDirection;
};

/**
 * True when `text` mixes RTL characters with strong LTR characters or numerals.
 */
export const isMixedDirectionText = (text: string | null | undefined): boolean => {
    if (!text) return false;
    return RTL_STRONG_REGEX.test(text) && (LTR_STRONG_REGEX.test(text) || HAS_DIGIT_REGEX.test(text));
};

/**
 * Fallback grapheme cluster splitter when `Intl.Segmenter` is unavailable.
 * Keeps all trailing combining marks (`\p{M}`, harakat, shadda, tanween) attached to their base character
 * so Arabic diacritics are never separated from the letter they modify.
 */
export const splitCodePointsWithCombiningMarks = (text: string): string[] => {
    if (!text) return [];
    const clusters: string[] = [];
    for (const char of Array.from(text)) {
        if (clusters.length > 0 && COMBINING_MARK_ONLY_REGEX.test(char)) {
            clusters[clusters.length - 1] += char;
        } else {
            clusters.push(char);
        }
    }
    return clusters;
};

/**
 * Extracts the primary base character of a grapheme cluster, skipping combining marks and bidi controls.
 */
const getGraphemeBaseCodePoint = (grapheme: string): number | null => {
    for (const char of Array.from(grapheme)) {
        if (COMBINING_MARK_ONLY_REGEX.test(char)) {
            continue;
        }
        const cp = char.codePointAt(0);
        if (cp === undefined) continue;
        // Skip ZWJ / ZWNJ / bidi controls when inspecting the base letter
        if ((cp >= 0x200B && cp <= 0x200F) || (cp >= 0x202A && cp <= 0x202E) || (cp >= 0x2066 && cp <= 0x2069)) {
            continue;
        }
        return cp;
    }
    return null;
};

const isArabicJoiningBlockCodePoint = (cp: number): boolean => (
    (cp >= 0x0620 && cp <= 0x064A)
    || (cp >= 0x066E && cp <= 0x06D5)
    || (cp >= 0x0750 && cp <= 0x077F)
    || (cp >= 0x08A0 && cp <= 0x08FF)
);

/**
 * Returns the Unicode Arabic Joining_Type of a grapheme cluster:
 * - `'D'`: Dual-joining (joins to both preceding and following letters, e.g. ب ت ج س ع ف ق ك ل م ن ه ي ـ)
 * - `'R'`: Right-joining (joins only to preceding dual-joining letter, e.g. ا أ إ آ د ذ ر ز و ؤ ة)
 * - `'T'`: Transparent (combining mark only)
 * - `'U'`: Non-joining (hamza ء, Latin, CJK, digits, spaces, punctuation)
 */
export const getArabicJoiningType = (grapheme: string): 'D' | 'R' | 'U' | 'T' => {
    if (!grapheme) return 'U';
    if (COMBINING_MARK_ONLY_REGEX.test(grapheme)) return 'T';
    const cp = getGraphemeBaseCodePoint(grapheme);
    if (cp === null) return 'U';
    if (cp === 0x0640) return 'D'; // Tatweel (ـ) is dual-joining
    if (NON_JOINING_ARABIC_CODEPOINTS.has(cp)) return 'U';
    if (RIGHT_JOINING_CODEPOINTS.has(cp)) return 'R';
    if (isArabicJoiningBlockCodePoint(cp)) return 'D';
    return 'U';
};

/**
 * True when `prevGrapheme` cursively connects to `nextGrapheme` in Arabic script
 * (`prev` is dual-joining `'D'` and `next` is dual-joining `'D'` or right-joining `'R'`).
 * Accepts either `(prevGrapheme: string, nextGrapheme: string)` or `(graphemes: readonly string[], index: number)`.
 */
export function doesArabicGraphemeJoinBetween(prevGrapheme: string, nextGrapheme: string): boolean;
export function doesArabicGraphemeJoinBetween(graphemes: readonly string[], index: number): boolean;
export function doesArabicGraphemeJoinBetween(
    first: string | readonly string[],
    second: string | number,
): boolean {
    const prevGrapheme = typeof first === 'string'
        ? first
        : (first[typeof second === 'number' ? second : 0] ?? '');
    const nextGrapheme = typeof first === 'string'
        ? String(second)
        : (first[(typeof second === 'number' ? second : 0) + 1] ?? '');
    const prevType = getArabicJoiningType(prevGrapheme);
    const nextType = getArabicJoiningType(nextGrapheme);
    return prevType === 'D' && (nextType === 'D' || nextType === 'R');
}

/**
 * True when `prevGrapheme` is Arabic Lam (`ل`, with optional diacritics) and `nextGrapheme` is an Alef
 * variant (`ا`, `أ`, `إ`, `آ`, `ٱ`), which together form the mandatory `لا` ligature.
 */
export const isArabicLamAlefPair = (prevGrapheme: string, nextGrapheme: string): boolean => {
    const prevCp = getGraphemeBaseCodePoint(prevGrapheme);
    const nextCp = getGraphemeBaseCodePoint(nextGrapheme);
    return prevCp === 0x0644 && nextCp !== null && ALEF_LIGATURE_CODEPOINTS.has(nextCp);
};

/**
 * Builds a shaping-aware prefix of the first `count` graphemes (`0 <= count <= graphemes.length`).
 * When grapheme `count - 1` cursively joins to grapheme `count` (and is not the first half of a mandatory
 * `لا` Lam-Alef ligature), appends a Zero-Width Joiner (`\u200D`) so that `measureText` / Pretext / Canvas
 * shapes the trailing letter in its contextual initial/medial form rather than its wide isolated/final form.
 */
export const buildShapedArabicPrefix = (
    graphemes: readonly string[],
    count: number,
): string => {
    if (count <= 0 || graphemes.length === 0) {
        return '';
    }
    if (count >= graphemes.length) {
        return graphemes.join('');
    }
    const rawPrefix = graphemes.slice(0, count).join('');
    const prev = graphemes[count - 1] ?? '';
    const next = graphemes[count] ?? '';
    if (
        doesArabicGraphemeJoinBetween(prev, next)
        && !isArabicLamAlefPair(prev, next)
        && !prev.endsWith(ZWJ)
    ) {
        return `${rawPrefix}${ZWJ}`;
    }
    return rawPrefix;
};

/**
 * Builds a shaping-aware slice `source.slice(start, end)` with leading/trailing ZWJ when the slice
 * boundaries cut across an intra-word Arabic cursive connection.
 * Accepts either a grapheme array `readonly string[]` or a plain `string`.
 */
export const buildShapedArabicSlice = (
    source: readonly string[] | string,
    start: number,
    end: number,
): string => {
    if (typeof source === 'string') {
        const clampedStart = Math.max(0, start);
        const clampedEnd = Math.min(source.length, end);
        if (clampedEnd <= clampedStart) return '';
        const raw = source.slice(clampedStart, clampedEnd);
        const beforeClusters = clampedStart > 0 ? splitCodePointsWithCombiningMarks(source.slice(0, clampedStart)) : [];
        const sliceClusters = splitCodePointsWithCombiningMarks(raw);
        const afterClusters = clampedEnd < source.length ? splitCodePointsWithCombiningMarks(source.slice(clampedEnd)) : [];
        const prevChar = beforeClusters[beforeClusters.length - 1] ?? '';
        const firstChar = sliceClusters[0] ?? '';
        const lastChar = sliceClusters[sliceClusters.length - 1] ?? '';
        const nextChar = afterClusters[0] ?? '';
        const leadZwj = prevChar && firstChar
            && doesArabicGraphemeJoinBetween(prevChar, firstChar)
            && !isArabicLamAlefPair(prevChar, firstChar)
            ? ZWJ
            : '';
        const tailZwj = lastChar && nextChar
            && doesArabicGraphemeJoinBetween(lastChar, nextChar)
            && !isArabicLamAlefPair(lastChar, nextChar)
            ? ZWJ
            : '';
        return `${leadZwj}${raw}${tailZwj}`;
    }

    const graphemes = source;
    const clampedStart = Math.max(0, start);
    const clampedEnd = Math.min(graphemes.length, end);
    if (clampedEnd <= clampedStart) {
        return '';
    }
    const raw = graphemes.slice(clampedStart, clampedEnd).join('');
    const leadZwj = clampedStart > 0
        && doesArabicGraphemeJoinBetween(graphemes[clampedStart - 1] ?? '', graphemes[clampedStart] ?? '')
        && !isArabicLamAlefPair(graphemes[clampedStart - 1] ?? '', graphemes[clampedStart] ?? '')
        ? ZWJ
        : '';
    const tailZwj = clampedEnd < graphemes.length
        && doesArabicGraphemeJoinBetween(graphemes[clampedEnd - 1] ?? '', graphemes[clampedEnd] ?? '')
        && !isArabicLamAlefPair(graphemes[clampedEnd - 1] ?? '', graphemes[clampedEnd] ?? '')
        ? ZWJ
        : '';
    return `${leadZwj}${raw}${tailZwj}`;
};

/**
 * Wraps each grapheme in `graphemes` with leading/trailing Zero-Width Joiners (`\u200D`) wherever it
 * cursively connects to its neighbor in `graphemes`.
 */
export const shapeArabicGraphemesInContext = (graphemes: readonly string[]): string[] => (
    graphemes.map((_, index) => buildShapedArabicSlice(graphemes, index, index + 1))
);

/**
 * Orders a row of logical/chronological items into visual Left-to-Right order according to Unicode UAX #9
 * bidirectional rules without mutating the source array.
 *
 * - When `baseDirection === 'ltr'`: items flow left-to-right, and any contiguous RTL run is reversed as a group.
 * - When `baseDirection === 'rtl'`: items flow right-to-left (so item 0 is rightmost and item N-1 is leftmost),
 *   while any contiguous embedded LTR run (e.g. Latin words or numbers, plus spaces strictly between them)
 *   preserves its internal left-to-right order.
 */
export const orderBidiItemsForVisualRow = <T>(
    items: readonly T[],
    getText: (item: T) => string,
    baseDirection: TextDirection,
): T[] => {
    if (items.length === 0) {
        return [];
    }

    const tagged = items.map((item, originalIndex) => ({
        item,
        originalIndex,
        direction: resolveTokenDirection(getText(item), baseDirection),
    }));

    // Coalesce neutral/whitespace items sitting strictly between two items of the embedded opposite direction.
    for (let i = 1; i < tagged.length - 1; i += 1) {
        const text = getText(tagged[i]!.item);
        if (WHITESPACE_ONLY_REGEX.test(text) || /^[\s.,:;!?\-'"()[\]{}]+$/u.test(text)) {
            const prevDir = tagged[i - 1]!.direction;
            const nextDir = tagged[i + 1]!.direction;
            if (prevDir === nextDir) {
                tagged[i]!.direction = prevDir;
            }
        }
    }

    if (baseDirection === 'ltr') {
        const result: T[] = [];
        let i = 0;
        while (i < tagged.length) {
            if (tagged[i]!.direction !== 'rtl') {
                result.push(tagged[i]!.item);
                i += 1;
                continue;
            }
            let j = i + 1;
            while (j < tagged.length && tagged[j]!.direction === 'rtl') {
                j += 1;
            }
            for (let k = j - 1; k >= i; k -= 1) {
                result.push(tagged[k]!.item);
            }
            i = j;
        }
        return result;
    }

    // baseDirection === 'rtl':
    // Group maximal contiguous LTR runs first, then reverse the sequence of runs so RTL runs flow right-to-left
    // while each embedded LTR run keeps its internal left-to-right order.
    const runs: T[][] = [];
    let i = 0;
    while (i < tagged.length) {
        if (tagged[i]!.direction === 'ltr') {
            const ltrRun: T[] = [];
            while (i < tagged.length && tagged[i]!.direction === 'ltr') {
                ltrRun.push(tagged[i]!.item);
                i += 1;
            }
            runs.push(ltrRun);
        } else {
            runs.push([tagged[i]!.item]);
            i += 1;
        }
    }

    const visualLeftToRight: T[] = [];
    for (let r = runs.length - 1; r >= 0; r -= 1) {
        visualLeftToRight.push(...runs[r]!);
    }
    return visualLeftToRight;
};

/**
 * Merges contiguous intra-word Arabic segments in `line.words` that were split without whitespace between
 * them in `line.fullText` (for example in syllable-timed Enhanced LRC, YRC, QRC, or KRC), preserving the
 * sub-word timestamps inside `word.syllables` while exposing a single whole `Word` so visualizers never
 * split an Arabic word across separate DOM spans or layout boxes.
 */
export const mergeContiguousArabicWordsInLine = (line: Line): Line => {
    if (line.words.length <= 1 || !containsArabicText(line.fullText)) {
        return line;
    }

    const fullText = line.fullText;
    const mergedWords: Word[] = [];
    const wordEndOffsets: number[] = [];
    let searchCursor = 0;
    let changed = false;

    const toSyllables = (word: Word): LyricSyllable[] => (
        word.syllables?.length
            ? word.syllables
            : [{ text: word.text, startTime: word.startTime, endTime: word.endTime }]
    );

    for (let i = 0; i < line.words.length; i += 1) {
        const current = line.words[i]!;
        const currentTrimmed = current.text.trim();
        const currentStartInFull = currentTrimmed.length > 0
            ? fullText.indexOf(currentTrimmed, searchCursor)
            : -1;
        const currentEndInFull = currentStartInFull >= 0
            ? currentStartInFull + currentTrimmed.length
            : -1;
        if (currentEndInFull >= 0) {
            searchCursor = currentEndInFull;
        }

        const previous = mergedWords[mergedWords.length - 1];
        const previousEndInFull = wordEndOffsets[wordEndOffsets.length - 1] ?? -1;

        const isContiguousInFullText = previousEndInFull >= 0
            && currentStartInFull >= 0
            && currentStartInFull === previousEndInFull;

        const canMergeIntraWordArabic = Boolean(
            previous
            && isContiguousInFullText
            && !/\s$/u.test(previous.text)
            && !/^\s/u.test(current.text)
            && (containsArabicText(previous.text) || COMBINING_MARK_ONLY_REGEX.test(previous.text))
            && (containsArabicText(current.text) || COMBINING_MARK_ONLY_REGEX.test(current.text))
        );

        if (canMergeIntraWordArabic && previous) {
            const combinedSyllables = [...toSyllables(previous), ...toSyllables(current)];
            mergedWords[mergedWords.length - 1] = {
                ...previous,
                text: previous.text + current.text,
                endTime: Math.max(previous.endTime, current.endTime),
                syllables: combinedSyllables,
            };
            wordEndOffsets[wordEndOffsets.length - 1] = currentEndInFull;
            changed = true;
        } else {
            mergedWords.push(current);
            wordEndOffsets.push(currentEndInFull);
        }
    }

    return changed ? { ...line, words: mergedWords } : line;
};

export const wholeCursiveTimeline = <T extends { char: string; startTime: number; endTime: number }>(items: T[]): T[] => {
    if (!hasCursiveJoiningScript(items.map(item => item.char).join(''))) return items;
    const out: T[] = [];
    for (const item of items) {
        const last = out[out.length - 1];
        if (last && /^\s*$/u.test(last.char) === /^\s*$/u.test(item.char)) {
            last.char += item.char;
            last.endTime = Math.max(last.endTime, item.endTime);
        } else out.push({ ...item });
    }
    return out;
};
