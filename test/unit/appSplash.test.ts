import { describe, expect, it } from 'vitest';
import { SPLASH_MIN_VISIBLE_MS, SPLASH_MIN_VISIBLE_REDUCED_MS, splashRemainingMs } from '@/utils/appSplash';

describe('app splash minimum time', () => {
    it('keeps a fast start on screen until the minimum has passed', () => {
        expect(splashRemainingMs(600, false)).toBe(SPLASH_MIN_VISIBLE_MS - 600);
        expect(splashRemainingMs(0, false)).toBe(SPLASH_MIN_VISIBLE_MS);
    });

    it('does not add time to a slow start', () => {
        expect(splashRemainingMs(SPLASH_MIN_VISIBLE_MS, false)).toBe(0);
        expect(splashRemainingMs(9000, false)).toBe(0);
    });

    it('is longer than one second (the old behaviour) and covers a full 2.4 s animation turn', () => {
        expect(SPLASH_MIN_VISIBLE_MS).toBeGreaterThan(2400);
    });

    it('uses a short beat for reduced motion', () => {
        expect(splashRemainingMs(100, true)).toBe(SPLASH_MIN_VISIBLE_REDUCED_MS - 100);
        expect(SPLASH_MIN_VISIBLE_REDUCED_MS).toBeLessThan(SPLASH_MIN_VISIBLE_MS);
    });

    it('survives bad input', () => {
        expect(splashRemainingMs(Number.NaN, false)).toBe(0);
        expect(splashRemainingMs(-5, false)).toBe(SPLASH_MIN_VISIBLE_MS);
    });
});
