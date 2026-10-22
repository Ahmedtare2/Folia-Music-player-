import { describe, expect, it } from 'vitest';
import {
    buildLyricSourceOrder,
    migratePreferredLyricSource,
} from '@/utils/lyrics/sourcePriority';

// test/unit/lyrics/sourcePriority.test.ts

describe('lyric source priority', () => {
    it('defaults to QQ and retains every fallback exactly once', () => {
        expect(buildLyricSourceOrder()).toEqual(['qq', 'netease', 'amll', 'kugou', 'lrclib', 'spotify']);
        expect(buildLyricSourceOrder('kugou')).toEqual(['kugou', 'netease', 'amll', 'qq', 'lrclib', 'spotify']);
        expect(buildLyricSourceOrder('netease')).toEqual(['netease', 'amll', 'qq', 'kugou', 'lrclib', 'spotify']);
        expect(buildLyricSourceOrder('amll')).toEqual(['amll', 'netease', 'qq', 'kugou', 'lrclib', 'spotify']);
        expect(buildLyricSourceOrder('lrclib')).toEqual(['lrclib', 'netease', 'amll', 'qq', 'kugou', 'spotify']);
        expect(buildLyricSourceOrder('spotify')).toEqual(['spotify', 'netease', 'amll', 'qq', 'kugou', 'lrclib']);
    });

    it('migrates missing, invalid, and legacy NetEase preferences to QQ', () => {
        expect(migratePreferredLyricSource(null, null)).toBe('qq');
        expect(migratePreferredLyricSource(null, 'netease')).toBe('qq');
        expect(migratePreferredLyricSource(null, 'invalid')).toBe('qq');
        expect(migratePreferredLyricSource('invalid', 'kugou')).toBe('qq');
    });

    it('preserves other legacy values and trusts the versioned preference thereafter', () => {
        expect(migratePreferredLyricSource(null, 'amll')).toBe('amll');
        expect(migratePreferredLyricSource(null, 'qq')).toBe('qq');
        expect(migratePreferredLyricSource(null, 'kugou')).toBe('kugou');
        expect(migratePreferredLyricSource('netease', 'qq')).toBe('netease');
        expect(migratePreferredLyricSource('lrclib', 'qq')).toBe('lrclib');
    });
});
