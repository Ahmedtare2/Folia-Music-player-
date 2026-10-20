import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    Cloud,
    Compass,
    Disc3,
    Globe,
    KeyRound,
    ListMusic,
    Loader2,
    LogIn,
    LogOut,
    Music,
    Play,
    Plus,
    Radio,
    RefreshCw,
    Search,
    Server,
    Sparkles,
    User,
    Wifi,
    WifiOff,
} from 'lucide-react';
import type { SongResult, UnifiedSong } from '../../types';
import type {
    OmniCollection,
    OmniExploreSection,
    OnlineProviderId,
} from '../../types/onlineMusic';
import type { NavidromeConfig, NavidromeSong, SubsonicAlbum, SubsonicPlaylist } from '../../types/navidrome';
import { omni } from '../../services/onlineMusic/omni';
import {
    type ConfigurableOnlineProviderId,
    RUNTIME_API_CHANGED_EVENT,
    getIsDeviceOnline,
    getOnlineProviderDiagnostic,
    getStoredRuntimeApiBase,
    setStoredRuntimeApiBase,
    subscribeDeviceOnlineStatus,
} from '../../services/onlineMusic/runtimeApiConfig';
import {
    clearNavidromeConfig,
    getNavidromeConfig,
    hashPassword,
    isNavidromeEnabled,
    navidromeApi,
    saveNavidromeConfig,
    setNavidromeEnabled,
} from '../../services/navidromeService';
import { useOnlineProviderAccountStore } from '../../stores/useOnlineProviderAccountStore';
import { openLoginWindow } from '../login/loginWindowStore';
import { detectTextDirection } from '../../utils/lyrics/arabicText';
import { errorMessage } from '../../utils/errorText';
import type { MobileOnlineSubTab } from './mobileNavigationModel';

// src/components/mobile/MobileOnlineHub.tsx
// Restores Folia's online music discovery, online playlists, account sign-in/sync,
// online search, Navidrome self-hosted streaming, and runtime API endpoint configuration
// inside the mobile UI while keeping local offline playback 100% intact.

export interface MobileOnlineHubProps {
    accentColor: string;
    currentSong: SongResult | null;
    subTab: MobileOnlineSubTab;
    onChangeSubTab: (subTab: MobileOnlineSubTab) => void;
    onPlayOnlineSong: (song: SongResult, queue?: SongResult[]) => void;
    onAddOnlineSongToQueue: (song: SongResult) => void;
    onPlayNavidromeSong?: (song: NavidromeSong, queue?: NavidromeSong[]) => void;
    onAddNavidromeSongsToQueue?: (songs: NavidromeSong[]) => void;
    onOpenFullSearchWorkspace?: () => void;
    onOpenLyricMatch?: () => void;
}

const PROVIDER_ORDER: readonly OnlineProviderId[] = [
    'netease',
    'qq',
    'kugou',
    'bodian',
    'ytm',
    'spotify',
];

const formatArtistText = (song: SongResult): string => (
    song.artists?.map(a => a.name).filter(Boolean).join(', ') || 'Unknown Artist'
);

export const MobileOnlineHub: React.FC<MobileOnlineHubProps> = ({
    accentColor,
    currentSong,
    subTab,
    onChangeSubTab,
    onPlayOnlineSong,
    onAddOnlineSongToQueue,
    onPlayNavidromeSong,
    onAddNavidromeSongsToQueue,
    onOpenFullSearchWorkspace,
    onOpenLyricMatch,
}) => {
    const activeProviderId = useOnlineProviderAccountStore(state => state.activeProviderId);
    const setActiveProviderId = useOnlineProviderAccountStore(state => state.setActiveProviderId);
    const accounts = useOnlineProviderAccountStore(state => state.accounts);
    const activeAccount = accounts[activeProviderId];

    // Live network connectivity & offline-to-online transition state
    const [isOnline, setIsOnline] = useState<boolean>(() => getIsDeviceOnline());
    const [reconnectedToast, setReconnectedToast] = useState(false);
    const [configEpoch, setConfigEpoch] = useState(0);

    // Online Discover & Playlists state
    const [isSyncingAccount, setIsSyncingAccount] = useState(false);
    const [accountActionError, setAccountActionError] = useState<string | null>(null);
    const [isLoadingFeed, setIsLoadingFeed] = useState(false);
    const [feedError, setFeedError] = useState<string | null>(null);
    const [dailySongs, setDailySongs] = useState<UnifiedSong[]>([]);
    const [personalFmSongs, setPersonalFmSongs] = useState<UnifiedSong[]>([]);
    const [recommendedCollections, setRecommendedCollections] = useState<OmniCollection[]>([]);
    const [exploreSections, setExploreSections] = useState<OmniExploreSection[]>([]);

    // Selected Online Collection (Playlist / Album / Cloud) detail state
    const [selectedCollection, setSelectedCollection] = useState<OmniCollection | null>(null);
    const [collectionTracks, setCollectionTracks] = useState<UnifiedSong[]>([]);
    const [isLoadingCollection, setIsLoadingCollection] = useState(false);
    const [collectionError, setCollectionError] = useState<string | null>(null);

    // Online Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchProvider, setSearchProvider] = useState<'active' | 'navidrome'>('active');
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [searchResults, setSearchResults] = useState<SongResult[]>([]);
    const [hasSearched, setHasSearched] = useState(false);

    // Navidrome state
    const [naviConfig, setNaviConfig] = useState<NavidromeConfig | null>(() => getNavidromeConfig());
    const [naviEnabled, setNaviEnabledState] = useState<boolean>(() => isNavidromeEnabled());
    const [naviServerUrl, setNaviServerUrl] = useState(() => getNavidromeConfig()?.serverUrl || '');
    const [naviUsername, setNaviUsername] = useState(() => getNavidromeConfig()?.username || '');
    const [naviPassword, setNaviPassword] = useState('');
    const [isTestingNavi, setIsTestingNavi] = useState(false);
    const [naviStatusMessage, setNaviStatusMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
    const [naviPlaylists, setNaviPlaylists] = useState<SubsonicPlaylist[]>([]);
    const [naviAlbums, setNaviAlbums] = useState<SubsonicAlbum[]>([]);
    const [isLoadingNaviLibrary, setIsLoadingNaviLibrary] = useState(false);
    const [selectedNaviTitle, setSelectedNaviTitle] = useState<string | null>(null);
    const [selectedNaviSongs, setSelectedNaviSongs] = useState<NavidromeSong[]>([]);

    // Runtime API Base configuration drafts
    const [neteaseBaseDraft, setNeteaseBaseDraft] = useState(() => getStoredRuntimeApiBase('netease'));
    const [qqBaseDraft, setQqBaseDraft] = useState(() => getStoredRuntimeApiBase('qq'));
    const [kugouBaseDraft, setKugouBaseDraft] = useState(() => getStoredRuntimeApiBase('kugou'));
    const [inlineEndpointDraft, setInlineEndpointDraft] = useState('');
    const [backendSavedMsg, setBackendSavedMsg] = useState<string | null>(null);

    const providerDiagnostic = useMemo(
        () => getOnlineProviderDiagnostic(activeProviderId),
        [activeProviderId, configEpoch, isOnline],
    );

    useEffect(() => {
        const onConfigChange = () => setConfigEpoch(prev => prev + 1);
        window.addEventListener(RUNTIME_API_CHANGED_EVENT, onConfigChange);
        return () => window.removeEventListener(RUNTIME_API_CHANGED_EVENT, onConfigChange);
    }, []);

    // Subscribe to browser online/offline transitions
    useEffect(() => {
        return subscribeDeviceOnlineStatus((nowOnline) => {
            setIsOnline(nowOnline);
            if (nowOnline) {
                setReconnectedToast(true);
                setFeedError(null);
                setSearchError(null);
                setAccountActionError(null);
                setTimeout(() => setReconnectedToast(false), 4000);
            }
        });
    }, []);

    // Load online discovery feed when provider is ready & online
    const loadDiscoveryAndRecommendations = useCallback(async () => {
        const diag = getOnlineProviderDiagnostic(activeProviderId);
        if (diag.availability !== 'ready') {
            setFeedError(null);
            return;
        }
        setIsLoadingFeed(true);
        setFeedError(null);
        try {
            const [homeRes, exploreRes] = await Promise.allSettled([
                omni.getHomeFeed(20),
                omni.supportsExplore(activeProviderId)
                    ? omni.getExploreFeed()
                    : Promise.resolve({ sections: [] }),
            ]);

            if (homeRes.status === 'fulfilled') {
                setDailySongs(homeRes.value.dailySongs || []);
                setPersonalFmSongs(homeRes.value.personalFm || []);
                setRecommendedCollections(homeRes.value.recommendedCollections || []);
            } else {
                setDailySongs([]);
                setPersonalFmSongs([]);
                setRecommendedCollections([]);
            }

            if (exploreRes.status === 'fulfilled') {
                setExploreSections(exploreRes.value.sections || []);
            } else {
                setExploreSections([]);
            }

            if (homeRes.status === 'rejected' && exploreRes.status === 'rejected') {
                throw homeRes.reason || exploreRes.reason;
            }
        } catch (err) {
            const msg = errorMessage(err) || 'Failed to load online recommendations.';
            setFeedError(msg);
        } finally {
            setIsLoadingFeed(false);
        }
    }, [activeProviderId]);

    useEffect(() => {
        setSelectedCollection(null);
        setCollectionTracks([]);
        setCollectionError(null);
        setInlineEndpointDraft(
            activeProviderId === 'netease' || activeProviderId === 'qq' || activeProviderId === 'kugou'
                ? getStoredRuntimeApiBase(activeProviderId)
                : '',
        );
        if (providerDiagnostic.availability === 'ready' && isOnline) {
            void loadDiscoveryAndRecommendations();
        } else {
            setDailySongs([]);
            setPersonalFmSongs([]);
            setRecommendedCollections([]);
            setExploreSections([]);
            setFeedError(null);
        }
    }, [activeProviderId, configEpoch, isOnline, loadDiscoveryAndRecommendations, providerDiagnostic.availability]);

    const handleSyncAccount = useCallback(async () => {
        if (!isOnline) {
            setAccountActionError('Cannot sync account while offline.');
            return;
        }
        setIsSyncingAccount(true);
        setAccountActionError(null);
        try {
            const outcome = await omni.readAccount(activeProviderId, 'sync');
            await omni.refreshProviderPlaylists(activeProviderId).catch(() => {});
            const updatedAcc = useOnlineProviderAccountStore.getState().accounts[activeProviderId];
            if (outcome !== 'read' && updatedAcc?.error) {
                setAccountActionError(`Sync error: ${updatedAcc.error}`);
            }
            await loadDiscoveryAndRecommendations();
        } catch (err) {
            setAccountActionError(errorMessage(err) || 'Failed to synchronize account playlists.');
        } finally {
            setIsSyncingAccount(false);
        }
    }, [activeProviderId, isOnline, loadDiscoveryAndRecommendations]);

    const handleOpenCollection = useCallback(async (collection: OmniCollection) => {
        setSelectedCollection(collection);
        setCollectionTracks([]);
        setCollectionError(null);
        if (!getIsDeviceOnline()) {
            setCollectionError('Device is offline. Connect to the internet to load online playlist tracks.');
            return;
        }
        setIsLoadingCollection(true);
        try {
            const page = await omni.getCollectionTracks(collection, { limit: 100, offset: 0 });
            setCollectionTracks(page.items || []);
        } catch (err) {
            setCollectionError(errorMessage(err) || 'Could not load tracks for this playlist.');
        } finally {
            setIsLoadingCollection(false);
        }
    }, []);

    const handleRunSearch = useCallback(async (e?: React.FormEvent) => {
        e?.preventDefault();
        const trimmed = searchQuery.trim();
        if (!trimmed) return;
        setHasSearched(true);
        if (!getIsDeviceOnline()) {
            setSearchError('Device is offline. Reconnect to search online catalogs.');
            return;
        }

        if (searchProvider === 'navidrome') {
            const cfg = getNavidromeConfig();
            if (!cfg) {
                setSearchError('Navidrome server is not configured yet. Configure it in the Navidrome tab first.');
                return;
            }
            setIsSearching(true);
            setSearchError(null);
            try {
                const res = await navidromeApi.search(cfg, trimmed, 5, 10, 30);
                const songs = (res.song || []).map(s => navidromeApi.toNavidromeSong(cfg, s));
                setSearchResults(songs);
            } catch (err) {
                setSearchError(errorMessage(err) || 'Navidrome search failed.');
            } finally {
                setIsSearching(false);
            }
            return;
        }

        const diag = getOnlineProviderDiagnostic(activeProviderId);
        if (diag.availability !== 'ready') {
            setSearchError(`${diag.label}: ${diag.summary}. ${diag.detail}`);
            return;
        }

        setIsSearching(true);
        setSearchError(null);
        try {
            const page = await omni.searchProviderSongs(activeProviderId, trimmed, { limit: 30, offset: 0 });
            setSearchResults(page.items || []);
        } catch (err) {
            setSearchError(errorMessage(err) || 'Online search failed. Check your network or API endpoint.');
        } finally {
            setIsSearching(false);
        }
    }, [activeProviderId, searchProvider, searchQuery]);

    // Load Navidrome playlists & recent albums when configured
    const loadNavidromeLibrary = useCallback(async (cfg: NavidromeConfig) => {
        if (!getIsDeviceOnline()) {
            setNaviStatusMessage({ type: 'err', text: 'Offline — cannot reach Navidrome server.' });
            return;
        }
        setIsLoadingNaviLibrary(true);
        setNaviStatusMessage(null);
        try {
            const ok = await navidromeApi.ping(cfg);
            if (!ok) {
                setNaviStatusMessage({
                    type: 'err',
                    testId: 'navidrome-auth-error',
                    text: 'Could not authenticate or reach Navidrome server. Verify Server URL, username, and password.',
                } as { type: 'err'; text: string });
                setIsLoadingNaviLibrary(false);
                return;
            }
            const [playlists, albums] = await Promise.all([
                navidromeApi.getPlaylists(cfg),
                navidromeApi.getAlbumList2(cfg, 'recent', 24, 0),
            ]);
            setNaviPlaylists(playlists);
            setNaviAlbums(albums);
            setNaviStatusMessage({
                type: 'ok',
                text: `Connected to ${cfg.serverUrl} (${playlists.length} playlists, ${albums.length} recent albums)`,
            });
        } catch (err) {
            setNaviStatusMessage({
                type: 'err',
                text: errorMessage(err) || 'Failed to connect to Navidrome server.',
            });
        } finally {
            setIsLoadingNaviLibrary(false);
        }
    }, []);

    useEffect(() => {
        if (subTab === 'navidrome' && naviConfig && naviEnabled && isOnline) {
            void loadNavidromeLibrary(naviConfig);
        }
    }, [isOnline, loadNavidromeLibrary, naviConfig, naviEnabled, subTab]);

    const handleSaveNavidrome = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanUrl = naviServerUrl.trim().replace(/\/+$/, '');
        const cleanUser = naviUsername.trim();
        if (!cleanUrl || !cleanUser) {
            setNaviStatusMessage({ type: 'err', text: 'Please enter both Server URL and Username.' });
            return;
        }
        const passwordHash = naviPassword
            ? hashPassword(naviPassword)
            : (naviConfig?.passwordHash || '');
        if (!passwordHash) {
            setNaviStatusMessage({ type: 'err', text: 'Please enter your Navidrome password.' });
            return;
        }
        const nextConfig: NavidromeConfig = {
            serverUrl: cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`,
            username: cleanUser,
            passwordHash,
        };
        setIsTestingNavi(true);
        setNaviStatusMessage(null);
        try {
            const ok = await navidromeApi.ping(nextConfig);
            if (!ok) {
                setNaviStatusMessage({
                    type: 'err',
                    text: 'Connection or authentication failed. Please check Server URL, username, and password.',
                });
                return;
            }
            saveNavidromeConfig(nextConfig, 'manual');
            setNavidromeEnabled(true);
            setNaviConfig(nextConfig);
            setNaviEnabledState(true);
            setNaviPassword('');
            await loadNavidromeLibrary(nextConfig);
        } catch (err) {
            setNaviStatusMessage({
                type: 'err',
                text: errorMessage(err) || 'Failed to connect to Navidrome server.',
            });
        } finally {
            setIsTestingNavi(false);
        }
    };

    const handleOpenNaviPlaylist = async (pl: SubsonicPlaylist) => {
        if (!naviConfig) return;
        setIsLoadingNaviLibrary(true);
        try {
            const detail = await navidromeApi.getPlaylist(naviConfig, pl.id);
            const entries = (detail?.entry || []).map(s => navidromeApi.toNavidromeSong(naviConfig, s));
            setSelectedNaviTitle(pl.name);
            setSelectedNaviSongs(entries);
        } finally {
            setIsLoadingNaviLibrary(false);
        }
    };

    const handleOpenNaviAlbum = async (album: SubsonicAlbum) => {
        if (!naviConfig) return;
        setIsLoadingNaviLibrary(true);
        try {
            const detail = await navidromeApi.getAlbum(naviConfig, album.id);
            const entries = (detail?.song || []).map(s => navidromeApi.toNavidromeSong(naviConfig, s, detail ?? album));
            setSelectedNaviTitle(album.name);
            setSelectedNaviSongs(entries);
        } finally {
            setIsLoadingNaviLibrary(false);
        }
    };

    const handleSaveAllBackends = (e: React.FormEvent) => {
        e.preventDefault();
        setStoredRuntimeApiBase('netease', neteaseBaseDraft);
        setStoredRuntimeApiBase('qq', qqBaseDraft);
        setStoredRuntimeApiBase('kugou', kugouBaseDraft);
        setBackendSavedMsg('Saved API endpoints. Ready to connect!');
        setTimeout(() => setBackendSavedMsg(null), 3500);
    };

    const renderOnlineSongRow = (song: SongResult, queueContext: SongResult[], idx: number) => {
        const active = currentSong?.id === song.id;
        const artistText = formatArtistText(song);
        const titleDir = detectTextDirection(song.name || '');
        const subDir = detectTextDirection(artistText);
        const isNavi = Boolean((song as NavidromeSong).isNavidrome);

        return (
            <div
                key={`${song.id}-${idx}`}
                className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors ${
                    active
                        ? 'bg-white/[0.10] border border-white/15'
                        : 'hover:bg-white/[0.04] active:bg-white/[0.08] border border-transparent'
                }`}
            >
                <button
                    type="button"
                    onClick={() => {
                        if (isNavi && onPlayNavidromeSong) {
                            onPlayNavidromeSong(song as NavidromeSong, queueContext as NavidromeSong[]);
                        } else {
                            onPlayOnlineSong(song, queueContext);
                        }
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 flex items-center justify-center text-zinc-500">
                        {song.album?.coverUrl ? (
                            <img src={song.album.coverUrl} alt={song.name} className="h-full w-full object-cover" />
                        ) : (
                            <Music size={18} />
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div
                            dir={titleDir}
                            className="truncate text-sm font-semibold text-zinc-100"
                            style={{ unicodeBidi: 'plaintext' }}
                        >
                            {song.name}
                        </div>
                        <div
                            dir={subDir}
                            className="truncate text-xs text-zinc-400"
                            style={{ unicodeBidi: 'plaintext' }}
                        >
                            {artistText}{song.album?.name ? ` · ${song.album.name}` : ''}
                        </div>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => {
                        if (isNavi && onAddNavidromeSongsToQueue) {
                            onAddNavidromeSongsToQueue([song as NavidromeSong]);
                        } else {
                            onAddOnlineSongToQueue(song);
                        }
                    }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white active:scale-95"
                    aria-label={`Add ${song.name} to queue`}
                >
                    <Plus size={18} />
                </button>
            </div>
        );
    };

    return (
        <div data-testid="mobile-online-hub" className="px-4 pb-6 space-y-4">
            {/* Network Connectivity Banner (Offline / Reconnected state) */}
            {!isOnline && (
                <div
                    data-testid="mobile-offline-banner"
                    className="flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3.5 text-xs text-amber-100"
                >
                    <WifiOff size={18} className="mt-0.5 shrink-0 text-amber-400" />
                    <div className="space-y-1">
                        <div className="font-semibold text-amber-200">
                            Offline Mode — No Internet Connection
                        </div>
                        <p className="text-amber-200/80 leading-relaxed">
                            Your local library, offline folders, and locally stored/cached lyrics continue to play normally. Online services will automatically resume as soon as you reconnect.
                        </p>
                    </div>
                </div>
            )}

            {isOnline && reconnectedToast && (
                <div
                    data-testid="mobile-online-reconnected-banner"
                    className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-200"
                >
                    <span className="flex items-center gap-2 font-medium">
                        <Wifi size={15} className="text-emerald-400" />
                        Back online! Online discovery, search, and lyric matching are ready.
                    </span>
                    <button
                        type="button"
                        onClick={() => void loadDiscoveryAndRecommendations()}
                        className="rounded-lg bg-emerald-400/20 px-2.5 py-1 font-semibold text-emerald-100"
                    >
                        Refresh
                    </button>
                </div>
            )}

            {/* Sub-Navigation Pills: Discover & Playlists | Search | Navidrome | Backends */}
            <div className="flex gap-1.5 overflow-x-auto hide-scrollbar rounded-2xl border border-white/10 bg-white/[0.04] p-1">
                {([
                    { id: 'discover' as const, label: 'Discover & Playlists', icon: Compass },
                    { id: 'search' as const, label: 'Online Search', icon: Search },
                    { id: 'navidrome' as const, label: 'Navidrome', icon: Server },
                    { id: 'backends' as const, label: 'Backends & Auth', icon: KeyRound },
                ]).map(tab => {
                    const Icon = tab.icon;
                    const active = subTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            data-testid={`mobile-online-subtab-${tab.id}`}
                            onClick={() => onChangeSubTab(tab.id)}
                            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                                active
                                    ? 'bg-white text-zinc-950 shadow-sm'
                                    : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            <Icon size={14} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* SUB-TAB 1: DISCOVER, ONLINE PLAYLISTS & ACCOUNT */}
            {subTab === 'discover' && (
                <div className="space-y-4">
                    {/* Online Provider Selector Bar */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold uppercase tracking-wider text-zinc-400">
                                Music Service Provider
                            </span>
                            <span className="text-[11px] text-zinc-400">
                                {providerDiagnostic.availability === 'ready' ? 'Ready' : providerDiagnostic.summary}
                            </span>
                        </div>
                        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                            {PROVIDER_ORDER.map((pid) => {
                                const diag = getOnlineProviderDiagnostic(pid);
                                const active = activeProviderId === pid;
                                const isReady = diag.availability === 'ready';
                                return (
                                    <button
                                        key={pid}
                                        type="button"
                                        data-testid={`online-provider-pill-${pid}`}
                                        onClick={() => setActiveProviderId(pid)}
                                        className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all ${
                                            active
                                                ? 'border-white bg-white text-zinc-950 shadow-sm'
                                                : 'border-white/10 bg-white/[0.04] text-zinc-300'
                                        }`}
                                    >
                                        <span
                                            className={`h-2 w-2 rounded-full ${
                                                isReady
                                                    ? 'bg-emerald-500'
                                                    : diag.availability === 'needs_api_base'
                                                        ? 'bg-amber-400'
                                                        : 'bg-zinc-500'
                                            }`}
                                        />
                                        <span>{omni.getProviderLabel(pid)}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Honest Capability / Backend Requirement Card when provider is not ready */}
                    {providerDiagnostic.availability === 'needs_api_base' && (
                        <div
                            data-testid="online-provider-needs-api-card"
                            className="rounded-2xl border border-amber-400/25 bg-amber-500/[0.08] p-4 space-y-3"
                        >
                            <div className="flex items-start gap-2.5">
                                <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-400" />
                                <div className="space-y-1 text-xs">
                                    <div className="font-bold text-amber-100">
                                        {providerDiagnostic.label} — Backend API URL Required
                                    </div>
                                    <p className="text-amber-200/85 leading-relaxed">
                                        {providerDiagnostic.detail}
                                    </p>
                                </div>
                            </div>

                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    if (
                                        activeProviderId === 'netease'
                                        || activeProviderId === 'qq'
                                        || activeProviderId === 'kugou'
                                    ) {
                                        const saved = setStoredRuntimeApiBase(activeProviderId as ConfigurableOnlineProviderId, inlineEndpointDraft);
                                        if (activeProviderId === 'netease') setNeteaseBaseDraft(saved);
                                        if (activeProviderId === 'qq') setQqBaseDraft(saved);
                                        if (activeProviderId === 'kugou') setKugouBaseDraft(saved);
                                    }
                                }}
                                className="flex gap-2"
                            >
                                <input
                                    type="url"
                                    value={inlineEndpointDraft}
                                    onChange={(e) => setInlineEndpointDraft(e.target.value)}
                                    placeholder={`https://your-${activeProviderId}-api.example.com`}
                                    aria-label={`${providerDiagnostic.label} API URL`}
                                    className="flex-1 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none"
                                />
                                <button
                                    type="submit"
                                    className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-zinc-950 active:scale-95"
                                >
                                    Save & Connect
                                </button>
                            </form>
                        </div>
                    )}

                    {providerDiagnostic.availability === 'needs_desktop_bridge' && (
                        <div
                            data-testid="online-provider-desktop-only-card"
                            className="rounded-2xl border border-white/12 bg-white/[0.04] p-4 space-y-2 text-xs"
                        >
                            <div className="flex items-center gap-2 font-bold text-zinc-100">
                                <AlertCircle size={16} className="text-zinc-400" />
                                <span>{providerDiagnostic.label} — Desktop Electron Only</span>
                            </div>
                            <p className="text-zinc-400 leading-relaxed">
                                {providerDiagnostic.detail}
                            </p>
                            <p className="text-zinc-300">
                                On Android, use <strong>Local Library</strong>, <strong>Navidrome</strong>, <strong>AMLL TTML Lyrics DB</strong>, or configure an API endpoint for <strong>NetEase</strong>, <strong>QQ Music</strong>, or <strong>KuGou</strong>.
                            </p>
                        </div>
                    )}

                    {/* Account Card (Sign In, Sync Playlists, Personal FM) */}
                    {providerDiagnostic.availability !== 'needs_desktop_bridge' && (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    {activeAccount?.user?.avatarUrl ? (
                                        <img
                                            src={activeAccount.user.avatarUrl}
                                            alt={activeAccount.user.nickname}
                                            className="h-11 w-11 rounded-full object-cover border border-white/15"
                                        />
                                    ) : (
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-zinc-300">
                                            <User size={20} />
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-bold text-white">
                                            {activeAccount?.user?.nickname
                                                ? activeAccount.user.nickname
                                                : `${omni.getProviderLabel(activeProviderId)} Account`}
                                        </div>
                                        <div className="truncate text-xs text-zinc-400">
                                            {activeAccount?.status === 'authenticated'
                                                ? `Signed in · ${(activeAccount.collections || []).length} playlists synced`
                                                : activeAccount?.error
                                                    ? `Auth issue: ${activeAccount.error}`
                                                    : 'Not signed in — sign in for personal playlists & cloud library'}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        type="button"
                                        data-testid="mobile-online-signin-btn"
                                        onClick={() => openLoginWindow(activeProviderId)}
                                        className="flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-xs font-semibold text-zinc-950 active:scale-95"
                                    >
                                        <LogIn size={14} />
                                        <span>{activeAccount?.user ? 'Account' : 'Sign In'}</span>
                                    </button>
                                    {activeAccount?.user && (
                                        <button
                                            type="button"
                                            onClick={() => void omni.signOutAccount(activeProviderId)}
                                            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-zinc-300"
                                            title="Sign out"
                                            aria-label="Sign out"
                                        >
                                            <LogOut size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {accountActionError && (
                                <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                                    <span className="truncate">{accountActionError}</span>
                                    <button
                                        type="button"
                                        onClick={() => void handleSyncAccount()}
                                        className="shrink-0 font-semibold underline"
                                    >
                                        Retry
                                    </button>
                                </div>
                            )}

                            <div className="flex flex-wrap gap-2 pt-1">
                                <button
                                    type="button"
                                    disabled={isSyncingAccount || !isOnline}
                                    onClick={() => void handleSyncAccount()}
                                    className="flex h-9 items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-xs font-medium text-zinc-200 disabled:opacity-45"
                                >
                                    <RefreshCw size={13} className={isSyncingAccount ? 'animate-spin' : ''} />
                                    <span>Sync Playlists & Feed</span>
                                </button>

                                {personalFmSongs.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => onPlayOnlineSong(personalFmSongs[0]!, personalFmSongs)}
                                        className="flex h-9 items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-semibold text-white"
                                    >
                                        <Radio size={13} style={{ color: accentColor }} />
                                        <span>Play Personal FM ({personalFmSongs.length})</span>
                                    </button>
                                )}

                                {onOpenLyricMatch && currentSong && (
                                    <button
                                        type="button"
                                        onClick={onOpenLyricMatch}
                                        className="flex h-9 items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-xs font-medium text-zinc-200"
                                    >
                                        <Sparkles size={13} style={{ color: accentColor }} />
                                        <span>Match Current Track Lyrics</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Selected Online Collection Drill-down View */}
                    {selectedCollection ? (
                        <div className="space-y-3">
                            <button
                                type="button"
                                onClick={() => setSelectedCollection(null)}
                                className="flex items-center gap-2 text-xs font-semibold text-zinc-300 hover:text-white"
                            >
                                <ArrowLeft size={16} />
                                <span>Back to Online Playlists & Discovery</span>
                            </button>

                            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
                                <div className="min-w-0">
                                    <h3 className="truncate text-base font-bold text-white">{selectedCollection.name}</h3>
                                    <p className="text-xs text-zinc-400">
                                        {collectionTracks.length} tracks · {omni.getProviderLabel(selectedCollection.providerId)}
                                    </p>
                                </div>
                                {collectionTracks.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => onPlayOnlineSong(collectionTracks[0]!, collectionTracks)}
                                        className="flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-xs font-semibold text-zinc-950"
                                    >
                                        <Play size={14} fill="currentColor" />
                                        <span>Play All</span>
                                    </button>
                                )}
                            </div>

                            {isLoadingCollection ? (
                                <div className="flex items-center justify-center gap-2 py-10 text-xs text-zinc-400">
                                    <Loader2 size={18} className="animate-spin" />
                                    <span>Loading playlist tracks...</span>
                                </div>
                            ) : collectionError ? (
                                <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 p-4 text-center space-y-2">
                                    <p className="text-xs text-rose-200">{collectionError}</p>
                                    <button
                                        type="button"
                                        onClick={() => void handleOpenCollection(selectedCollection)}
                                        className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-zinc-950"
                                    >
                                        Retry
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {collectionTracks.map((track, idx) => renderOnlineSongRow(track, collectionTracks, idx))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* User's Synced Online Playlists & Cloud Collections */}
                            {(activeAccount?.collections?.length ?? 0) > 0 && (
                                <div className="space-y-2">
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                                        My Online Playlists & Cloud ({activeAccount!.collections.length})
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                        {activeAccount!.collections.map((col) => (
                                            <button
                                                key={`${col.type}-${String(col.id)}`}
                                                type="button"
                                                onClick={() => void handleOpenCollection(col)}
                                                className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 text-left active:scale-[0.99]"
                                            >
                                                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-500">
                                                    {col.coverUrl ? (
                                                        <img src={col.coverUrl} alt={col.name} className="h-full w-full object-cover" />
                                                    ) : col.type === 'cloud' ? (
                                                        <Cloud size={20} />
                                                    ) : (
                                                        <ListMusic size={20} />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate text-xs font-semibold text-zinc-100">{col.name}</div>
                                                    <div className="truncate text-[11px] text-zinc-400">
                                                        {col.trackCount !== undefined ? `${col.trackCount} tracks` : col.type}
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Loading / Error State for Discovery Feed */}
                            {isLoadingFeed && (
                                <div className="flex items-center justify-center gap-2 py-8 text-xs text-zinc-400">
                                    <Loader2 size={18} className="animate-spin" />
                                    <span>Loading online discovery & recommendations...</span>
                                </div>
                            )}

                            {feedError && !isLoadingFeed && (
                                <div
                                    data-testid="mobile-online-feed-error"
                                    className="rounded-2xl border border-rose-400/25 bg-rose-500/10 p-4 space-y-2 text-xs text-rose-200"
                                >
                                    <div className="flex items-center gap-2 font-bold">
                                        <AlertCircle size={15} className="text-rose-400" />
                                        <span>Could Not Load Online Recommendations</span>
                                    </div>
                                    <p className="text-rose-200/80">{feedError}</p>
                                    <button
                                        type="button"
                                        onClick={() => void loadDiscoveryAndRecommendations()}
                                        className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-zinc-950"
                                    >
                                        Retry
                                    </button>
                                </div>
                            )}

                            {/* Daily Recommended Songs */}
                            {dailySongs.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                                            Daily Recommended Tracks ({dailySongs.length})
                                        </h3>
                                        <button
                                            type="button"
                                            onClick={() => onPlayOnlineSong(dailySongs[0]!, dailySongs)}
                                            className="text-xs font-semibold text-white underline"
                                        >
                                            Play All
                                        </button>
                                    </div>
                                    <div className="space-y-1">
                                        {dailySongs.slice(0, 10).map((song, idx) => renderOnlineSongRow(song, dailySongs, idx))}
                                    </div>
                                </div>
                            )}

                            {/* Recommended Playlists */}
                            {recommendedCollections.length > 0 && (
                                <div className="space-y-2">
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                                        Recommended Playlists
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                        {recommendedCollections.slice(0, 12).map((col) => (
                                            <button
                                                key={`${col.providerId}-${String(col.id)}`}
                                                type="button"
                                                onClick={() => void handleOpenCollection(col)}
                                                className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 text-left"
                                            >
                                                <div className="aspect-square w-full overflow-hidden rounded-xl bg-zinc-900 mb-2 flex items-center justify-center text-zinc-500">
                                                    {col.coverUrl ? (
                                                        <img src={col.coverUrl} alt={col.name} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <Disc3 size={28} />
                                                    )}
                                                </div>
                                                <div className="truncate text-xs font-semibold text-zinc-100">{col.name}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Explore Sections */}
                            {exploreSections.map((section) => (
                                <div key={section.id} className="space-y-2">
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                                        {section.title}
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                        {section.items.slice(0, 9).map((item, idx) => {
                                            if (item.kind === 'song') {
                                                const s = item.song;
                                                return (
                                                    <button
                                                        key={`song-${s.id}-${idx}`}
                                                        type="button"
                                                        onClick={() => onPlayOnlineSong(s, [s])}
                                                        className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 text-left"
                                                    >
                                                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-500">
                                                            {s.album?.coverUrl ? (
                                                                <img src={s.album.coverUrl} alt={s.name} className="h-full w-full object-cover" />
                                                            ) : (
                                                                <Music size={18} />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="truncate text-xs font-semibold text-white">{s.name}</div>
                                                            <div className="truncate text-[11px] text-zinc-400">{formatArtistText(s)}</div>
                                                        </div>
                                                    </button>
                                                );
                                            }
                                            const col = item.collection;
                                            return (
                                                <button
                                                    key={`col-${String(col.id)}-${idx}`}
                                                    type="button"
                                                    onClick={() => void handleOpenCollection(col)}
                                                    className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 text-left"
                                                >
                                                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-500">
                                                        {col.coverUrl ? (
                                                            <img src={col.coverUrl} alt={col.name} className="h-full w-full object-cover" />
                                                        ) : (
                                                            <Disc3 size={18} />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="truncate text-xs font-semibold text-white">{col.name}</div>
                                                        <div className="truncate text-[11px] text-zinc-400">{col.type}</div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            )}

            {/* SUB-TAB 2: ONLINE SEARCH */}
            {subTab === 'search' && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex gap-1.5">
                            <button
                                type="button"
                                onClick={() => setSearchProvider('active')}
                                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                                    searchProvider === 'active'
                                        ? 'bg-white text-zinc-950'
                                        : 'border border-white/10 bg-white/[0.04] text-zinc-300'
                                }`}
                            >
                                {omni.getProviderLabel(activeProviderId)}
                            </button>
                            <button
                                type="button"
                                onClick={() => setSearchProvider('navidrome')}
                                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                                    searchProvider === 'navidrome'
                                        ? 'bg-white text-zinc-950'
                                        : 'border border-white/10 bg-white/[0.04] text-zinc-300'
                                }`}
                            >
                                Navidrome
                            </button>
                        </div>

                        {onOpenFullSearchWorkspace && (
                            <button
                                type="button"
                                onClick={onOpenFullSearchWorkspace}
                                className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-zinc-200"
                            >
                                Full Multi-Source Search
                            </button>
                        )}
                    </div>

                    <form onSubmit={(e) => void handleRunSearch(e)} className="flex gap-2">
                        <div className="relative flex-1">
                            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                            <input
                                type="search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={`Search songs on ${searchProvider === 'navidrome' ? 'Navidrome' : omni.getProviderLabel(activeProviderId)}...`}
                                className="h-11 w-full rounded-2xl border border-white/15 bg-white/[0.06] pl-10 pr-4 text-xs text-white placeholder-zinc-400 focus:outline-none"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isSearching}
                            className="h-11 rounded-2xl bg-white px-5 text-xs font-semibold text-zinc-950 disabled:opacity-50"
                        >
                            {isSearching ? <Loader2 size={15} className="animate-spin" /> : 'Search'}
                        </button>
                    </form>

                    {searchError && (
                        <div
                            data-testid="mobile-online-search-error"
                            className="rounded-2xl border border-rose-400/25 bg-rose-500/10 p-4 space-y-2 text-xs text-rose-200"
                        >
                            <div className="flex items-center gap-2 font-bold">
                                <AlertCircle size={15} className="text-rose-400" />
                                <span>Search Unavailable</span>
                            </div>
                            <p>{searchError}</p>
                            <button
                                type="button"
                                onClick={() => void handleRunSearch()}
                                className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-zinc-950"
                            >
                                Retry Search
                            </button>
                        </div>
                    )}

                    {isSearching ? (
                        <div className="flex items-center justify-center gap-2 py-10 text-xs text-zinc-400">
                            <Loader2 size={18} className="animate-spin" />
                            <span>Searching online catalog...</span>
                        </div>
                    ) : searchResults.length > 0 ? (
                        <div className="space-y-1">
                            {searchResults.map((song, idx) => renderOnlineSongRow(song, searchResults, idx))}
                        </div>
                    ) : hasSearched && !searchError ? (
                        <div className="py-10 text-center text-xs text-zinc-400">
                            No matching tracks found.
                        </div>
                    ) : null}
                </div>
            )}

            {/* SUB-TAB 3: NAVIDROME SELF-HOSTED SERVER */}
            {subTab === 'navidrome' && (
                <div className="space-y-4">
                    <form
                        onSubmit={(e) => void handleSaveNavidrome(e)}
                        className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-3"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Server size={16} style={{ color: accentColor }} />
                                <h3 className="text-sm font-bold text-white">Navidrome / Subsonic Server</h3>
                            </div>
                            {naviConfig && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        clearNavidromeConfig();
                                        setNavidromeEnabled(false);
                                        setNaviConfig(null);
                                        setNaviEnabledState(false);
                                        setNaviPlaylists([]);
                                        setNaviAlbums([]);
                                        setNaviStatusMessage({ type: 'ok', text: 'Cleared Navidrome credentials.' });
                                    }}
                                    className="text-xs text-zinc-400 underline hover:text-rose-300"
                                >
                                    Disconnect
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 gap-2.5">
                            <input
                                type="url"
                                value={naviServerUrl}
                                onChange={(e) => setNaviServerUrl(e.target.value)}
                                placeholder="Server URL (e.g. https://music.example.com)"
                                aria-label="Navidrome Server URL"
                                className="h-10 rounded-xl border border-white/12 bg-black/40 px-3 text-xs text-white placeholder-zinc-500 focus:outline-none"
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="text"
                                    value={naviUsername}
                                    onChange={(e) => setNaviUsername(e.target.value)}
                                    placeholder="Username"
                                    aria-label="Navidrome Username"
                                    className="h-10 rounded-xl border border-white/12 bg-black/40 px-3 text-xs text-white placeholder-zinc-500 focus:outline-none"
                                />
                                <input
                                    type="password"
                                    value={naviPassword}
                                    onChange={(e) => setNaviPassword(e.target.value)}
                                    placeholder={naviConfig ? 'Password (saved)' : 'Password'}
                                    aria-label="Navidrome Password"
                                    className="h-10 rounded-xl border border-white/12 bg-black/40 px-3 text-xs text-white placeholder-zinc-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1">
                            <button
                                type="submit"
                                disabled={isTestingNavi}
                                className="flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-xs font-semibold text-zinc-950 disabled:opacity-50"
                            >
                                {isTestingNavi ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                <span>Test & Save Server</span>
                            </button>

                            {naviConfig && (
                                <button
                                    type="button"
                                    disabled={isLoadingNaviLibrary}
                                    onClick={() => void loadNavidromeLibrary(naviConfig)}
                                    className="flex h-10 items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-3.5 text-xs font-medium text-zinc-200"
                                >
                                    <RefreshCw size={13} className={isLoadingNaviLibrary ? 'animate-spin' : ''} />
                                    <span>Reload Library</span>
                                </button>
                            )}
                        </div>

                        {naviStatusMessage && (
                            <div
                                data-testid={naviStatusMessage.type === 'err' ? 'navidrome-error-banner' : 'navidrome-ok-banner'}
                                className={`rounded-xl border px-3 py-2 text-xs ${
                                    naviStatusMessage.type === 'err'
                                        ? 'border-rose-400/30 bg-rose-500/10 text-rose-200'
                                        : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                                }`}
                            >
                                {naviStatusMessage.text}
                            </div>
                        )}
                    </form>

                    {selectedNaviTitle ? (
                        <div className="space-y-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedNaviTitle(null);
                                    setSelectedNaviSongs([]);
                                }}
                                className="flex items-center gap-2 text-xs font-semibold text-zinc-300"
                            >
                                <ArrowLeft size={16} />
                                <span>Back to Navidrome Library</span>
                            </button>
                            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
                                <div>
                                    <h4 className="text-sm font-bold text-white">{selectedNaviTitle}</h4>
                                    <p className="text-xs text-zinc-400">{selectedNaviSongs.length} tracks</p>
                                </div>
                                {selectedNaviSongs.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (onPlayNavidromeSong) {
                                                onPlayNavidromeSong(selectedNaviSongs[0]!, selectedNaviSongs);
                                            } else {
                                                onPlayOnlineSong(selectedNaviSongs[0]!, selectedNaviSongs);
                                            }
                                        }}
                                        className="flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-xs font-semibold text-zinc-950"
                                    >
                                        <Play size={13} fill="currentColor" />
                                        <span>Play All</span>
                                    </button>
                                )}
                            </div>
                            <div className="space-y-1">
                                {selectedNaviSongs.map((song, idx) => renderOnlineSongRow(song, selectedNaviSongs, idx))}
                            </div>
                        </div>
                    ) : (
                        <>
                            {naviPlaylists.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                                        Navidrome Playlists ({naviPlaylists.length})
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2.5">
                                        {naviPlaylists.map(pl => (
                                            <button
                                                key={pl.id}
                                                type="button"
                                                onClick={() => void handleOpenNaviPlaylist(pl)}
                                                className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left"
                                            >
                                                <ListMusic size={18} className="shrink-0 text-zinc-400" />
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate text-xs font-semibold text-white">{pl.name}</div>
                                                    <div className="text-[11px] text-zinc-400">{pl.songCount} tracks</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {naviAlbums.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                                        Recent Navidrome Albums ({naviAlbums.length})
                                    </h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                        {naviAlbums.map(album => (
                                            <button
                                                key={album.id}
                                                type="button"
                                                onClick={() => void handleOpenNaviAlbum(album)}
                                                className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 text-left"
                                            >
                                                <div className="truncate text-xs font-semibold text-white">{album.name}</div>
                                                <div className="truncate text-[11px] text-zinc-400">{album.artist}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* SUB-TAB 4: BACKENDS, API ENDPOINTS & SERVICE AVAILABILITY MATRIX */}
            {subTab === 'backends' && (
                <div className="space-y-4">
                    <form
                        onSubmit={handleSaveAllBackends}
                        className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-3"
                    >
                        <div className="flex items-center gap-2">
                            <Globe size={16} style={{ color: accentColor }} />
                            <h3 className="text-sm font-bold text-white">Online API Gateway Endpoints</h3>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                            On Android and Web, NetEase, QQ Music, and KuGou connect through your deployed API gateway URLs (matching <code className="text-zinc-200">VITE_NETEASE_API_BASE</code>, <code className="text-zinc-200">VITE_QQ_API_BASE</code>, and <code className="text-zinc-200">VITE_KUGOU_API_BASE</code>).
                        </p>

                        <div className="space-y-2.5">
                            <div>
                                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                                    NetEase Cloud Music API Base URL
                                </label>
                                <input
                                    type="url"
                                    value={neteaseBaseDraft}
                                    onChange={(e) => setNeteaseBaseDraft(e.target.value)}
                                    placeholder="https://your-netease-api.example.com"
                                    className="h-10 w-full rounded-xl border border-white/12 bg-black/40 px-3 text-xs text-white placeholder-zinc-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                                    QQ Music API Base URL
                                </label>
                                <input
                                    type="url"
                                    value={qqBaseDraft}
                                    onChange={(e) => setQqBaseDraft(e.target.value)}
                                    placeholder="https://your-qq-api.example.com/api/qq"
                                    className="h-10 w-full rounded-xl border border-white/12 bg-black/40 px-3 text-xs text-white placeholder-zinc-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                                    KuGou Music API Base URL
                                </label>
                                <input
                                    type="url"
                                    value={kugouBaseDraft}
                                    onChange={(e) => setKugouBaseDraft(e.target.value)}
                                    placeholder="https://your-kugou-api.example.com"
                                    className="h-10 w-full rounded-xl border border-white/12 bg-black/40 px-3 text-xs text-white placeholder-zinc-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1">
                            <button
                                type="submit"
                                className="h-10 rounded-xl bg-white px-4 text-xs font-semibold text-zinc-950 active:scale-95"
                            >
                                Save API Endpoints
                            </button>
                            {backendSavedMsg && (
                                <span className="text-xs font-medium text-emerald-300">{backendSavedMsg}</span>
                            )}
                        </div>
                    </form>

                    {/* Service Availability Matrix */}
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-2.5">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                            Integration Status & Requirements
                        </h3>
                        {(['amll-db', 'netease', 'qq', 'kugou', 'bodian', 'ytm', 'spotify'] as const).map(id => {
                            const diag = getOnlineProviderDiagnostic(id);
                            return (
                                <div
                                    key={id}
                                    className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-1 text-xs"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-semibold text-white">{diag.label}</span>
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                                diag.availability === 'ready'
                                                    ? 'bg-emerald-500/20 text-emerald-300'
                                                    : diag.availability === 'needs_api_base'
                                                        ? 'bg-amber-500/20 text-amber-300'
                                                        : 'bg-zinc-500/20 text-zinc-400'
                                            }`}
                                        >
                                            {diag.availability === 'ready'
                                                ? 'Ready'
                                                : diag.availability === 'needs_api_base'
                                                    ? 'Needs API URL'
                                                    : diag.availability === 'needs_desktop_bridge'
                                                        ? 'Desktop Only'
                                                        : 'Offline'}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-zinc-400 leading-relaxed">{diag.detail}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(MobileOnlineHub);
