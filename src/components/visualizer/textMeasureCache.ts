// Copyright (c) 2026 chthollyphile
// src/components/visualizer/textMeasureCache.ts
// 各模式文字测量共用的两件小事：按插入顺序淘汰的有界缓存，以及按整段前缀累计字素偏移的循环骨架。
// 测量本身（pretext 首行宽、pretext 自然宽加字距、canvas measureText）仍由各模式传入，结果与原实现逐位一致。

import {
    buildShapedArabicPrefix,
    containsArabicText,
    isArabicLamAlefPair,
} from '../../utils/lyrics/arabicText';

/**
 * Stores `value` under `key` in an insertion-ordered Map, first evicting the oldest entry when a new
 * key would push the cache past `limit`. Returns `value` so callers can `return rememberBounded(...)`.
 */
export const rememberBounded = <TKey, TValue>(
    cache: Map<TKey, TValue>,
    key: TKey,
    value: TValue,
    limit: number,
): TValue => {
    if (!cache.has(key) && cache.size >= limit) {
        const oldest = cache.keys().next();
        if (!oldest.done) cache.delete(oldest.value);
    }
    cache.set(key, value);
    return value;
};

/**
 * Cumulative grapheme offsets: `offsets[i]` is the advance of the first `i` graphemes, with
 * `offsets[0] = 0`. Each prefix is measured as a whole string (not as a sum of single glyphs) so
 * kerning and shaping across glyph boundaries stay exact; `measurePrefix` also receives the count and
 * the previous offset for modes that add tracking or keep the offsets monotonic.
 *
 * For Arabic text, prefixes that end mid-word at a cursive connection use a Zero-Width Joiner (`\u200D`)
 * so the trailing Arabic letter is measured in its contextual initial/medial form rather than its wide
 * isolated/final form, and mandatory Lam-Alef (`لا`) ligatures are interpolated across the pair.
 */
export const measurePrefixOffsets = (
    graphemes: readonly string[],
    measurePrefix: (prefix: string, count: number, previousOffset: number) => number,
): number[] => {
    const offsets = new Array<number>(graphemes.length + 1).fill(0);
    if (graphemes.length === 0) {
        return offsets;
    }

    const fullText = graphemes.join('');
    if (!containsArabicText(fullText)) {
        for (let count = 1; count <= graphemes.length; count += 1) {
            offsets[count] = measurePrefix(graphemes.slice(0, count).join(''), count, offsets[count - 1]);
        }
        return offsets;
    }

    for (let count = 1; count <= graphemes.length; count += 1) {
        const shapedPrefix = buildShapedArabicPrefix(graphemes, count);
        offsets[count] = measurePrefix(shapedPrefix, count, offsets[count - 1]);
    }

    // Interpolate mandatory Lam-Alef (لا) ligature splits so the two halves share the ligature advance evenly.
    for (let count = 1; count < graphemes.length; count += 1) {
        if (isArabicLamAlefPair(graphemes[count - 1] ?? '', graphemes[count] ?? '')) {
            offsets[count] = (offsets[count - 1]! + offsets[count + 1]!) * 0.5;
        }
    }

    // Clamp interior offsets monotonically within [0, fullWidth] so contextual shaping differences
    // never cause an earlier prefix to exceed the full shaped string width.
    const fullWidth = Math.max(0, offsets[graphemes.length]!);
    offsets[graphemes.length] = fullWidth;
    for (let count = graphemes.length - 1; count >= 1; count -= 1) {
        offsets[count] = Math.min(offsets[count]!, offsets[count + 1]!);
    }
    for (let count = 1; count <= graphemes.length; count += 1) {
        offsets[count] = Math.max(offsets[count - 1]!, Math.min(fullWidth, offsets[count]!));
    }

    return offsets;
};
