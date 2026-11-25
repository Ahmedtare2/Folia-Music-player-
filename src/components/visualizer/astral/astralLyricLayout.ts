import type { Line } from '../../../types';
import {
    containsArabicText, detectTextDirection, mergeContiguousArabicWordsInLine, orderBidiItemsForVisualRow,
    resolveTokenDirection, type TextDirection,
} from '../../../utils/lyrics/arabicText';
import { isInterludeLine } from '../../../utils/lyrics/parserCore';
import { segmentLyricWords } from '../../../utils/lyrics/wordSegmentation';

// src/components/visualizer/astral/astralLyricLayout.ts
// A lyric line -> whole timed words -> wrapped, bidi-ordered rows, in raster pixels. Pure: text is measured through a callback.
// An Arabic word is one unit with the TTML timestamps the line has (contiguous Arabic pieces are merged by
// mergeContiguousArabicWordsInLine, as the other styles do), and it is later drawn with ONE fillText, so the browser's own shaping keeps
// joining, contextual forms and diacritics. Nothing here splits a word into letters, and no grapheme timing is used.

export interface AstralWord {
    text: string;
    start: number;
    end: number;
    dir: TextDirection;
}

export interface PlacedAstralWord {
    word: AstralWord;
    /** Left edge inside its row. */
    x: number;
    width: number;
}

export interface AstralRow {
    words: PlacedAstralWord[];
    width: number;
}

export interface AstralLayout {
    rows: AstralRow[];
    direction: TextDirection;
    width: number;
    lineHeight: number;
}

export const buildAstralWords = (line: Line): AstralWord[] => {
    const baseDirection = detectTextDirection(line.fullText);
    const merged = containsArabicText(line.fullText) ? mergeContiguousArabicWordsInLine(line) : line;
    const timed = merged.words
        .filter(word => word.text.trim().length > 0 && Number.isFinite(word.startTime) && Number.isFinite(word.endTime))
        .map(word => ({ text: word.text.trim(), start: word.startTime, end: Math.max(word.endTime, word.startTime) }));
    const segments = segmentLyricWords(line).filter(segment => segment.isWordLike && segment.segment.trim().length > 0);
    const useTimed = timed.length > 1 || (timed.length === 1 && segments.length <= 1);
    if (useTimed) {
        // The saved TTML times are used exactly as they are.
        return timed.map(word => ({ ...word, dir: resolveTokenDirection(word.text, baseDirection) }));
    }
    // No usable word timing: the saved/automatic segmentation, spread over the line's own span by letter count.
    const source = segments.length > 0 ? segments.map(segment => segment.segment.trim()) : [line.fullText.trim()].filter(Boolean);
    const total = source.reduce((sum, text) => sum + Array.from(text).length, 0) || 1;
    const span = Math.max(0.1, line.endTime - line.startTime);
    let cursor = line.startTime;
    return source.map(text => {
        const share = (Array.from(text).length / total) * span;
        const word = { text, start: cursor, end: cursor + share, dir: resolveTokenDirection(text, baseDirection) };
        cursor += share;
        return word;
    });
};

export interface AstralLayoutInput {
    words: readonly AstralWord[];
    direction: TextDirection;
    maxWidth: number;
    spaceWidth: number;
    lineHeight: number;
    measure: (text: string) => number;
}

export const layoutAstralLine = (input: AstralLayoutInput): AstralLayout => {
    const { words, direction, maxWidth, spaceWidth, lineHeight, measure } = input;
    const widths = words.map(word => measure(word.text));
    const groups: number[][] = [];
    let current: number[] = [];
    let used = 0;
    words.forEach((_, index) => {
        const next = used + (current.length ? spaceWidth : 0) + widths[index]!;
        if (current.length > 0 && next > maxWidth) {
            groups.push(current);
            current = [];
            used = 0;
        }
        used += (current.length ? spaceWidth : 0) + widths[index]!;
        current.push(index);
    });
    if (current.length) groups.push(current);
    const rows: AstralRow[] = groups.map(group => {
        const ordered = orderBidiItemsForVisualRow(group, index => words[index]!.text, direction);
        let x = 0;
        const placed = ordered.map((index, slot) => {
            if (slot > 0) x += spaceWidth;
            const item: PlacedAstralWord = { word: words[index]!, x, width: widths[index]! };
            x += widths[index]!;
            return item;
        });
        return { words: placed, width: x };
    });
    return { rows, direction, width: Math.max(0, ...rows.map(row => row.width)), lineHeight };
};

/** Progress of a word at playback time t: -1 before it starts, 0..1 while it is sung, 2 after. A zero-length word is lit instantly. */
export const wordProgress = (word: Pick<AstralWord, 'start' | 'end'>, t: number): number => {
    if (t < word.start) return -1;
    if (t >= word.end) return 2;
    const span = word.end - word.start;
    return span <= 1e-6 ? 2 : (t - word.start) / span;
};

/** The index of the lyric line to show at time t: the last real line that has started (interludes are not lyrics). -1 before the first. */
export const activeLineIndexAt = (lines: readonly Line[], t: number): number => {
    let lo = 0;
    let hi = lines.length - 1;
    let found = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (lines[mid]!.startTime <= t) { found = mid; lo = mid + 1; } else hi = mid - 1;
    }
    while (found >= 0 && isInterludeLine(lines[found]!)) found -= 1;
    return found;
};
