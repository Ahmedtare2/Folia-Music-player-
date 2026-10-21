import { LyricData } from '../../types';
import { applyLyricDisplayFilter, resolveLyricProcessingOptions } from './filtering';
import { RawLyricSource } from './types';
import { EmbeddedLyricAdapter } from './adapters/EmbeddedLyricAdapter';
import { NeteaseLyricAdapter } from './adapters/NeteaseLyricAdapter';
import { NavidromeLyricAdapter } from './adapters/NavidromeLyricAdapter';
import { LocalFileLyricAdapter } from './adapters/LocalFileLyricAdapter';
import { QrcLyricAdapter } from './adapters/QrcLyricAdapter';
import type { LyricProcessingOptions } from './types';
import { applyAutoWordSegmentation } from './icuFolia';
import { ensureLyricDataRenderHints } from './renderHints';
import {
    associateLyricDataWithCacheKey,
    computeLyricSourceCacheKey,
    readPreParsedLyricsFromDisk,
    writePreParsedLyricsToDisk,
} from '../../services/persistentDiskCacheService';

export class LyricParserFactory {
    static async parse(source: RawLyricSource, options: LyricProcessingOptions = {}): Promise<LyricData | null> {
        const resolvedOptions = resolveLyricProcessingOptions(options);
        const cacheKey = computeLyricSourceCacheKey(source);

        const cached = await readPreParsedLyricsFromDisk(cacheKey);
        if (cached) {
            const filteredCached = applyLyricDisplayFilter(cached, resolvedOptions.filterPattern);
            if (filteredCached) {
                associateLyricDataWithCacheKey(filteredCached, cacheKey);
            }
            return filteredCached;
        }

        let parsed: LyricData | null = null;

        switch (source.type) {
            case 'embedded':
                parsed = await new EmbeddedLyricAdapter().parse(source, resolvedOptions);
                break;
            case 'netease':
                parsed = await new NeteaseLyricAdapter().parse(source, resolvedOptions);
                break;
            case 'navidrome':
                parsed = await new NavidromeLyricAdapter().parse(source, resolvedOptions);
                break;
            case 'local':
                parsed = await new LocalFileLyricAdapter().parse(source, resolvedOptions);
                break;
            case 'qrc':
                parsed = await new QrcLyricAdapter().parse(source, resolvedOptions);
                break;
            default:
                console.warn('[LyricParserFactory] Unknown lyric source type:', (source as any)?.type);
                return null;
        }

        if (parsed) {
            const preSegmented = ensureLyricDataRenderHints(applyAutoWordSegmentation(parsed)) ?? parsed;
            associateLyricDataWithCacheKey(preSegmented, cacheKey);
            await writePreParsedLyricsToDisk(cacheKey, preSegmented);
            parsed = preSegmented;
        }

        const filtered = applyLyricDisplayFilter(parsed, resolvedOptions.filterPattern);
        if (filtered) {
            associateLyricDataWithCacheKey(filtered, cacheKey);
        }
        return filtered;
    }
}
