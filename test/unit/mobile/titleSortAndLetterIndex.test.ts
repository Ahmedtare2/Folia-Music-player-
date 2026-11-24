import { describe, expect, it } from 'vitest';
import type { LocalSong } from '../../../src/types';
import { buildTitleLetterIndex, filterAndSortLocalSongs, getTitleSortInfo } from '../../../src/components/mobile/mobileNavigationModel';

const song = (id: string, title: string): LocalSong => ({ id, title, fileName: `${id}.mp3`, filePath: `/m/${id}.mp3` } as unknown as LocalSong);

describe('title sort and letter index', () => {
    it('puts Latin A-Z first, then Arabic, then digits and symbols', () => {
        const songs = [
            song('1', 'يا حبيبي'), song('2', 'Zebra'), song('3', '21 Guns'), song('4', 'alpha'),
            song('5', 'Beat It'), song('6', 'أمل'), song('7', 'بيت كبير'), song('8', '(Inspired) Bayen'),
        ];
        const sorted = filterAndSortLocalSongs(songs, '', 'title').map(s => s.title);

        expect(sorted.indexOf('Zebra')).toBeLessThan(sorted.indexOf('أمل'));
        expect(sorted.indexOf('يا حبيبي')).toBeLessThan(sorted.indexOf('21 Guns'));
        expect(sorted.indexOf('alpha')).toBeLessThan(sorted.indexOf('Beat It'));
        expect(sorted.indexOf('Beat It')).toBeLessThan(sorted.indexOf('Zebra'));
        expect(sorted.indexOf('أمل')).toBeLessThan(sorted.indexOf('بيت كبير'));
    });

    it('ignores leading punctuation and accents when picking the letter', () => {
        expect(getTitleSortInfo('"Éclat"').letter).toBe('E');
        expect(getTitleSortInfo('... Bass').letter).toBe('B');
        expect(getTitleSortInfo('إلى أين').letter).toBe('ا');
        expect(getTitleSortInfo('7 Rings').letter).toBe('#');
    });

    it('builds a letter index in list order with the first row of each letter', () => {
        const sorted = filterAndSortLocalSongs([song('1', 'Bass'), song('2', 'Apple'), song('3', 'Bayen'), song('4', 'سلام')], '', 'title');
        const { letters, firstIndex } = buildTitleLetterIndex(sorted);
        expect(letters).toEqual(['A', 'B', 'س']);
        expect(firstIndex.get('B')).toBe(1);
        expect(firstIndex.get('س')).toBe(3);
    });
});
