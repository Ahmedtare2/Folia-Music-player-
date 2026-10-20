// src/services/playbackBlobUrls.ts

/** Blob URLs handed over but not yet safe to revoke - see `retireBlobUrl`. */
let heldBlobUrls: string[] = [];

export const isRevocableBlobUrl = (url: string | null | undefined): url is string => (
    typeof url === 'string' && url.startsWith('blob:')
);

/** True while any media element on the page still has this URL as its source. */
export const isSoundingOnADeck = (url: string): boolean => {
    if (!url || typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') {
        return false;
    }
    return Array.from(document.querySelectorAll('audio'))
        .some(element => element.getAttribute('src') === url || element.currentSrc === url);
};

/**
 * Safely revokes a `blob:` object URL only if it is actually a `blob:` URL and no `<audio>` deck
 * currently references it as `src` or `currentSrc`. Never revokes Android SAF stream URLs
 * (`/__folia_saf/stream?...`) or remote HTTP URLs.
 */
export const safeRevokeBlobUrl = (url: string | null | undefined): boolean => {
    if (!isRevocableBlobUrl(url)) return false;
    if (isSoundingOnADeck(url)) return false;
    try {
        URL.revokeObjectURL(url);
        return true;
    } catch {
        return false;
    }
};

/**
 * Hands a track's blob URL over for revoking, and revokes only the ones no deck is using.
 *
 * Non-blob URLs (such as `/__folia_saf/stream?...` on Android) are ignored so they are never
 * passed to `URL.revokeObjectURL` or accumulated in the blob ledger.
 */
export const retireBlobUrl = (nextBlobUrl: string | null) => {
    const normalizedNext = isRevocableBlobUrl(nextBlobUrl) ? nextBlobUrl : null;
    heldBlobUrls = heldBlobUrls.filter(url => {
        if (!isRevocableBlobUrl(url)) return false;
        if (url === normalizedNext || isSoundingOnADeck(url)) return true;
        try {
            URL.revokeObjectURL(url);
        } catch {
            // Ignore revocation errors on already-revoked URLs.
        }
        return false;
    });
    if (normalizedNext && !heldBlobUrls.includes(normalizedNext)) {
        heldBlobUrls.push(normalizedNext);
    }
};

export const getHeldBlobUrlsForTesting = (): readonly string[] => heldBlobUrls;
export const resetHeldBlobUrlsForTesting = (): void => {
    heldBlobUrls = [];
};
