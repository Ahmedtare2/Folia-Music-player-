import type { Line } from '../../../types';
import {
    containsArabicText, detectTextDirection, mergeContiguousArabicWordsInLine, orderBidiItemsForVisualRow,
    resolveTokenDirection, type TextDirection,
} from '../../../utils/lyrics/arabicText';
import { segmentLyricWords } from '../../../utils/lyrics/wordSegmentation';

// src/components/visualizer/filmgate/filmGateLayout.ts
// A lyric line -> timed whole words -> wrapped, bidi-ordered rows. Pure: text is measured through a callback so the
// layout runs the same in a test as on the canvas. Arabic stays in whole words: a word is one unit with the TTML
// timestamps the line already has (contiguous Arabic pieces are merged by mergeContiguousArabicWordsInLine, the same
// helper the other styles use), and it is drawn with ONE fillText call, so the browser's own shaping keeps the
// contextual forms, the joining and the diacritics. Nothing here ever splits a word into letters.

export interface FilmWord {
    text: string;
    start: number;
    end: number;
    dir: TextDirection;
}

export interface PlacedWord {
    word: FilmWord;
    /** Left edge of the word inside its row, row-relative (the row is centred by the caller). */
    x: number;
    width: number;
}

export interface FilmRow {
    words: PlacedWord[];
    width: number;
}

export interface FilmLayout {
    rows: FilmRow[];
    direction: TextDirection;
    /** Whole-line width of the widest row. */
    width: number;
    lineHeight: number;
    /** Font size the layout was made at, in px (the caller shrinks long lines). */
    fontSize: number;
}

/** The line's words with their times. Per-word timestamps are used as they are; a line without them is spread over its own span by letter count. */
export const buildFilmWords = (line: Line): FilmWord[] => {
    const baseDirection = detectTextDirection(line.fullText);
    const merged = containsArabicText(line.fullText) ? mergeContiguousArabicWordsInLine(line) : line;
    const timed = merged.words
        .filter(word => word.text.trim().length > 0 && Number.isFinite(word.startTime) && Number.isFinite(word.endTime))
        .map(word => ({ text: word.text.trim(), start: word.startTime, end: Math.max(word.endTime, word.startTime) }));
    const segments = segmentLyricWords(line).filter(segment => segment.isWordLike && segment.segment.trim().length > 0);
    const useTimed = timed.length > 1 || (timed.length === 1 && segments.length <= 1);
    if (useTimed) {
        return timed.map(word => ({ ...word, dir: resolveTokenDirection(word.text, baseDirection) }));
    }
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

export interface FilmLayoutInput {
    words: readonly FilmWord[];
    direction: TextDirection;
    maxWidth: number;
    spaceWidth: number;
    lineHeight: number;
    measure: (text: string) => number;
}

/** Greedy wrap in reading order, then each row in visual left-to-right order by the Unicode bidi rule the other styles use. */
export const layoutFilmLine = (input: FilmLayoutInput): FilmLayout => {
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
    const rows: FilmRow[] = groups.map(group => {
        const ordered = orderBidiItemsForVisualRow(group, index => words[index]!.text, direction);
        let x = 0;
        const placed = ordered.map((index, slot) => {
            if (slot > 0) x += spaceWidth;
            const item: PlacedWord = { word: words[index]!, x, width: widths[index]! };
            x += widths[index]!;
            return item;
        });
        return { words: placed, width: x };
    });
    return { rows, direction, width: Math.max(0, ...rows.map(row => row.width)), lineHeight, fontSize: 0 };
};
