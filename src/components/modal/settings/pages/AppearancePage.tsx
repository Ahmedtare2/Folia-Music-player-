import React from 'react';
import { Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { getVisualizerModeLabel } from '../../../visualizer/registry';
import { useDynamicAlbumArtworkStore } from '../../../../stores/useDynamicAlbumArtworkStore';
import { usePlayerChromeSettingsStore } from '../../../../stores/usePlayerChromeSettingsStore';
import { openSettings } from '../../../../stores/useSettingsModalStore';
import { useSystemBarSettingsStore } from '../../../../stores/useSystemBarSettingsStore';
import { useThemeSettingsStore } from '../../../../stores/useThemeSettingsStore';
import { useVisualizerSettingsStore } from '../../../../stores/useVisualizerSettingsStore';
import type { DynamicAlbumArtworkIntensity } from '../../../../utils/dynamicAlbumArtwork';
import { openAIEndpointOf } from '../../../../utils/openAIEndpoint';
import { Button, FoldedGroup, Group, NumberField, Reveal, Row, Segmented, TextField, Toggle, Value, option, parseNumberText, type SettingsGroupDef, type SettingsOptionDef } from '../kit';
import { settingsAnchorSubview } from '../navigation/settingsAnchorModel';
import { AiConnectionTestReply, useAiConnectionTest } from './AiConnectionTest';
import { useSettingsPage, type AiApiKeyName } from './settingsPageContext';

// src/components/modal/settings/pages/AppearancePage.tsx
// The 外观 page: which lyric animation the player uses, Display and Immersive Mode system bar controls,
// Dynamic Album Artwork controls, light or dark, the colour theme, how a song's own theme is made
// and applied, and (desktop app) the AI provider that makes those themes.

const LYRICS: SettingsGroupDef = { id: 'lyricsRenderer', titleKey: 'options.lyricsRenderer' };
const DISPLAY_IMMERSIVE: SettingsGroupDef = { id: 'displayAndImmersiveMode', titleKey: 'options.displayAndImmersiveMode' };
const THEME: SettingsGroupDef = { id: 'themePresets', titleKey: 'options.settingsHeadingTheme' };
const SONG_THEME: SettingsGroupDef = { id: 'songTheme', titleKey: 'options.settingsHeadingSongTheme' };
const AI: SettingsGroupDef = { id: 'electronSettings', titleKey: 'options.electronSettings', electronOnly: true };

const O = {
    lyricsAnimation: option(LYRICS, 'lyricsAnimationAdjust', 'options.lyricsAnimationAdjust'),
    albumVideoCovers: option(DISPLAY_IMMERSIVE, 'albumVideoCovers', 'options.albumVideoCovers'),
    dynamicArtwork: option(DISPLAY_IMMERSIVE, 'dynamicAlbumArtwork', 'options.dynamicAlbumArtwork'),
    dynamicArtworkIntensity: option(DISPLAY_IMMERSIVE, 'dynamicAlbumArtworkIntensity', 'options.dynamicAlbumArtworkIntensity'),
    hideStatusBar: option(DISPLAY_IMMERSIVE, 'hideStatusBar', 'options.hideStatusBar'),
    hideNavigationBar: option(DISPLAY_IMMERSIVE, 'hideNavigationBar', 'options.hideNavigationBar'),
    fullScreenLyricsMode: option(DISPLAY_IMMERSIVE, 'fullScreenLyricsMode', 'options.fullScreenLyricsMode'),
    daylight: option(THEME, 'daylightMode', 'options.daylightMode'),
    preset: option(THEME, 'themePreset', 'options.themePresets'),
    themePark: option(THEME, 'openThemePark', 'options.openThemePark'),
    autoSwitch: option(SONG_THEME, 'autoSwitchSongTheme', 'options.autoSwitchSongTheme'),
    autoGenerate: option(SONG_THEME, 'autoGenerateSongTheme', 'options.autoGenerateSongTheme'),
    source: option(SONG_THEME, 'themeGenerationSource', 'options.themeGenerationSource'),
    preferCustom: option(SONG_THEME, 'preferCustomTheme', 'options.preferCustomTheme'),
    aiProvider: option(AI, 'aiProvider', 'options.aiProvider'),
    geminiKey: option(AI, 'geminiApiKey', 'options.geminiApiKey'),
    openaiUrl: option(AI, 'openaiApiUrl', 'options.openaiApiUrl'),
    openaiModel: option(AI, 'openaiApiModel', 'options.openaiApiModel'),
    openaiTemperature: option(AI, 'openaiApiTemperature', 'options.openaiApiTemperature'),
    openaiStream: option(AI, 'openaiApiStream', 'options.openaiApiStream'),
    openaiKey: option(AI, 'openaiApiKey', 'options.openaiApiKey'),
    aiProxy: option(AI, 'useSystemProxyAI', 'options.useSystemProxyAI'),
};

export const OPTIONS: SettingsOptionDef[] = Object.values(O);

type DaylightChoice = 'light' | 'dark' | 'system';

type AiKeyFieldProps = {
    /** The draft of a replacement key. */
    value: string;
    onChange: (value: string) => void;
    saved: boolean;
    onClear: () => void;
    placeholder?: string;
};

/** A provider key. A saved key is never shown: the field stays empty, typing replaces it on save, and Clear removes it at once. */
const AiKeyField: React.FC<AiKeyFieldProps> = ({ value, onChange, saved, onClear, placeholder }) => {
    const { t } = useTranslation();
    return (
        <span className="flex min-w-0 items-center gap-2">
            <TextField type="password" value={value} onChange={onChange} placeholder={saved ? t('options.aiApiKeySavedPlaceholder') : placeholder} />
            {saved && <Button onClick={onClear}>{t('options.aiApiKeyClear')}</Button>}
        </span>
    );
};

const AppearancePage: React.FC = () => {
    const { t } = useTranslation();
    const { isElectron, themeControls, onOpenVisPlayground, onOpenThemePark, viewProps } = useSettingsPage();
    const { electronSettings, setElectronSettings, onSaveElectronSettings, electronSaveStatus, savedAiApiKeys, savedOpenAIKeyEndpoint, onClearAiApiKey } = viewProps.desktop.model;
    const { isDaylight, followSystemTheme, setDaylightPreference, setFollowSystemTheme } = useThemeSettingsStore(useShallow(state => ({
        isDaylight: state.isDaylight,
        followSystemTheme: state.followSystemTheme,
        setDaylightPreference: state.setDaylightPreference,
        setFollowSystemTheme: state.setFollowSystemTheme,
    })));
    const {
        albumVideoEnabled,
        dynamicArtworkEnabled,
        dynamicArtworkIntensity,
        setAlbumVideoEnabled,
        setDynamicArtworkEnabled,
        setDynamicArtworkIntensity,
    } = useDynamicAlbumArtworkStore(useShallow(state => ({
        albumVideoEnabled: state.albumVideoEnabled,
        dynamicArtworkEnabled: state.enabled,
        dynamicArtworkIntensity: state.intensity,
        setAlbumVideoEnabled: state.setAlbumVideoEnabled,
        setDynamicArtworkEnabled: state.setDynamicAlbumArtworkEnabled,
        setDynamicArtworkIntensity: state.setDynamicAlbumArtworkIntensity,
    })));
    const {
        hideStatusBar,
        hideNavigationBar,
        fullScreenLyricsMode,
        setHideStatusBar,
        setHideNavigationBar,
        setFullScreenLyricsMode,
    } = useSystemBarSettingsStore(useShallow(state => ({
        hideStatusBar: state.hideStatusBar,
        hideNavigationBar: state.hideNavigationBar,
        fullScreenLyricsMode: state.fullScreenLyricsMode,
        setHideStatusBar: state.setHideStatusBar,
        setHideNavigationBar: state.setHideNavigationBar,
        setFullScreenLyricsMode: state.setFullScreenLyricsMode,
    })));
    const visualizerMode = useVisualizerSettingsStore(state => state.visualizerMode);
    const randomEnabled = useVisualizerSettingsStore(state => state.randomVisualizerModePerSong);
    const nativeBlurEnabled = usePlayerChromeSettingsStore(state => state.enablePlayerPageNativeBlur);

    const usesOpenAi = electronSettings.AI_PROVIDER === 'openai';
    const aiTest = useAiConnectionTest(usesOpenAi
        ? {
            provider: 'openai',
            apiKey: electronSettings.OPENAI_API_KEY || '',
            apiUrl: electronSettings.OPENAI_API_URL || '',
            model: electronSettings.OPENAI_API_MODEL || '',
            stream: electronSettings.OPENAI_API_STREAM === true,
            useSystemProxy: electronSettings.USE_SYSTEM_PROXY_FOR_AI === true,
        }
        : {
            provider: 'gemini',
            apiKey: electronSettings.GEMINI_API_KEY || '',
            useSystemProxy: electronSettings.USE_SYSTEM_PROXY_FOR_AI === true,
        }, usesOpenAi ? savedAiApiKeys.OPENAI_API_KEY : savedAiApiKeys.GEMINI_API_KEY);
    const setAi = (patch: Partial<typeof electronSettings>) => setElectronSettings({ ...electronSettings, ...patch });
    const savedKeyHint = (key: AiApiKeyName) => (savedAiApiKeys[key] ? t('options.aiApiKeySavedDesc') : undefined);
    const boundOpenAiEndpoint = savedOpenAIKeyEndpoint
        && !(electronSettings.OPENAI_API_KEY || '').trim()
        && openAIEndpointOf(electronSettings.OPENAI_API_URL) !== savedOpenAIKeyEndpoint
        ? savedOpenAIKeyEndpoint
        : null;

    return (
        <>
            <Group def={LYRICS} bare>
                {nativeBlurEnabled && <Row notice={t('options.nativeBlurBackgroundNotice')} />}
                <Row option={O.lyricsAnimation} hint={t('options.lyricsRendererDesc')} onClick={onOpenVisPlayground}>
                    <Value>{randomEnabled ? t('ui.visualizerRandom') : getVisualizerModeLabel(visualizerMode, t)}</Value>
                </Row>
            </Group>

            <Group def={DISPLAY_IMMERSIVE}>
                <Row option={O.albumVideoCovers} note={t('options.albumVideoCoversDesc', 'Play matching local album video files as a full-screen animated album visual on the player screen.')}>
                    <Toggle checked={albumVideoEnabled} onChange={setAlbumVideoEnabled} />
                </Row>
                <Row option={O.dynamicArtwork} note={t('options.dynamicAlbumArtworkDesc', 'Animate the album cover on the player screen with subtle camera drift, layered parallax, ambient lighting, and feathered lower-edge blending.')}>
                    <Toggle checked={dynamicArtworkEnabled} onChange={setDynamicArtworkEnabled} />
                </Row>
                <Reveal when={dynamicArtworkEnabled}>
                    <Row sub option={O.dynamicArtworkIntensity}>
                        <Segmented<DynamicAlbumArtworkIntensity>
                            value={dynamicArtworkIntensity}
                            options={[
                                { value: 'low', label: t('options.dynamicAlbumArtworkIntensityLow', 'Low') },
                                { value: 'normal', label: t('options.dynamicAlbumArtworkIntensityNormal', 'Normal') },
                            ]}
                            onChange={setDynamicArtworkIntensity}
                        />
                    </Row>
                </Reveal>
                <Row option={O.hideStatusBar} note={t('options.hideStatusBarDesc', 'Hide the top system status bar. Swipe from the top edge to reveal it temporarily.')}>
                    <Toggle checked={hideStatusBar} onChange={setHideStatusBar} />
                </Row>
                <Row option={O.hideNavigationBar} note={t('options.hideNavigationBarDesc', 'Hide the bottom system navigation bar. Swipe from the screen edge to reveal it temporarily.')}>
                    <Toggle checked={hideNavigationBar} onChange={setHideNavigationBar} />
                </Row>
                <Row option={O.fullScreenLyricsMode} note={t('options.fullScreenLyricsModeDesc', 'Automatically hide both the status bar and navigation bar together when viewing synchronized lyrics or the visualizer, and restore your previous bar state when leaving.')}>
                    <Toggle checked={fullScreenLyricsMode} onChange={setFullScreenLyricsMode} />
                </Row>
            </Group>

            <Group def={THEME}>
                <Row option={O.daylight} note={t('options.followSystemThemeDesc')}>
                    <Segmented<DaylightChoice>
                        value={followSystemTheme ? 'system' : isDaylight ? 'light' : 'dark'}
                        options={[
                            { value: 'light', label: t('options.daylightModeLight') },
                            { value: 'dark', label: t('options.daylightModeDark') },
                            { value: 'system', label: t('options.daylightModeSystem') },
                        ]}
                        onChange={(choice) => {
                            if (choice === 'system') {
                                setFollowSystemTheme(true);
                            } else {
                                setDaylightPreference(choice === 'light');
                            }
                        }}
                    />
                </Row>
                <Row option={O.preset}>
                    <Segmented
                        value={themeControls.bgMode}
                        options={[
                            { value: 'default', label: t('options.themePresetsDefault') },
                            { value: 'custom', label: t('options.customTheme'), disabled: !themeControls.hasCustomTheme },
                        ]}
                        onChange={mode => (mode === 'custom' ? themeControls.onApplyCustomTheme() : themeControls.onApplyDefaultTheme())}
                    />
                </Row>
                <Row option={O.themePark} onClick={onOpenThemePark} />
            </Group>

            <Group def={SONG_THEME}>
                <Row option={O.autoSwitch} note={t('options.autoSwitchSongThemeDesc')}>
                    <Toggle checked={themeControls.songThemeAutoSwitchEnabled} onChange={themeControls.onToggleSongThemeAutoSwitch} />
                </Row>
                <Reveal when={themeControls.songThemeAutoSwitchEnabled}>
                    <Row
                        sub
                        option={O.autoGenerate}
                        note={t(themeControls.themeGenerationSource === 'cover' ? 'options.autoGenerateSongThemeCoverDesc' : 'options.autoGenerateSongThemeDesc')}
                    >
                        <Toggle checked={themeControls.songThemeAutoGenerateEnabled} onChange={themeControls.onToggleSongThemeAutoGenerate} />
                    </Row>
                </Reveal>
                <Row
                    option={O.source}
                    note={t(themeControls.themeGenerationSource === 'cover' ? 'options.themeGenerationSourceCoverDesc' : 'options.themeGenerationSourceAiDesc')}
                >
                    <Segmented
                        value={themeControls.themeGenerationSource}
                        options={[
                            { value: 'ai', label: t('options.themeGenerationSourceAi'), disabled: themeControls.aiApiKeyStatus !== 'configured' },
                            { value: 'cover', label: t('options.themeGenerationSourceCover') },
                        ]}
                        onChange={themeControls.onChangeThemeGenerationSource}
                    />
                </Row>
                <Reveal when={themeControls.aiApiKeyStatus === 'missing'}>
                    <Row sub notice={t('options.themeGenerationSourceAiUnavailable')}>
                        <Button onClick={() => openSettings('options', settingsAnchorSubview('electronSettings'), null, 'electronSettings')}>
                            {t('options.configureAiApiKey')}
                        </Button>
                    </Row>
                </Reveal>
                <Row option={O.preferCustom} hint={t('options.preferCustomThemeDesc')}>
                    <Toggle
                        checked={themeControls.isCustomThemePreferred}
                        onChange={themeControls.onToggleCustomThemePreferred}
                        disabled={!themeControls.hasCustomTheme}
                    />
                </Row>
            </Group>

            {isElectron && (
                <FoldedGroup def={AI} summary={usesOpenAi ? t('options.otherCompatibleApi') : 'Google Gemini'}>
                    <Row option={O.aiProvider}>
                        <Segmented
                            value={usesOpenAi ? 'openai' : 'gemini'}
                            options={[
                                { value: 'gemini', label: 'Google Gemini' },
                                { value: 'openai', label: t('options.otherCompatibleApi') },
                            ]}
                            onChange={provider => setAi({ AI_PROVIDER: provider })}
                        />
                    </Row>
                    <Reveal when={usesOpenAi}>
                        <Row option={O.openaiUrl} note={t('options.openaiApiUrlDesc')}>
                            <TextField
                                value={electronSettings.OPENAI_API_URL || ''}
                                onChange={value => setAi({ OPENAI_API_URL: value })}
                                placeholder="https://api.openai.com/v1"
                            />
                        </Row>
                        <Row option={O.openaiModel} note={t('options.openaiApiModelDesc')}>
                            <TextField
                                value={electronSettings.OPENAI_API_MODEL || ''}
                                onChange={value => setAi({ OPENAI_API_MODEL: value })}
                                placeholder="gpt-4.1-mini"
                            />
                        </Row>
                        <Row option={O.openaiTemperature} hint={t('options.openaiApiTemperatureDesc')}>
                            <NumberField
                                value={parseNumberText(electronSettings.OPENAI_API_TEMPERATURE)}
                                onChange={value => setAi({ OPENAI_API_TEMPERATURE: value === null ? '' : String(value) })}
                                min={0}
                                max={2}
                                step={0.1}
                                placeholder="0.7"
                            />
                        </Row>
                        <Row option={O.openaiStream} note={t('options.openaiApiStreamDesc')}>
                            <Toggle
                                checked={electronSettings.OPENAI_API_STREAM === true}
                                onChange={enabled => setAi({ OPENAI_API_STREAM: enabled })}
                            />
                        </Row>
                        <Row
                            option={O.openaiKey}
                            hint={boundOpenAiEndpoint
                                ? t('options.aiApiKeyEndpointMismatchDesc', { endpoint: boundOpenAiEndpoint })
                                : savedKeyHint('OPENAI_API_KEY')}
                        >
                            <AiKeyField
                                value={electronSettings.OPENAI_API_KEY || ''}
                                onChange={value => setAi({ OPENAI_API_KEY: value })}
                                saved={savedAiApiKeys.OPENAI_API_KEY}
                                onClear={() => void onClearAiApiKey('OPENAI_API_KEY')}
                                placeholder="sk-..."
                            />
                        </Row>
                    </Reveal>
                    <Reveal when={!usesOpenAi}>
                        <Row option={O.geminiKey} hint={savedKeyHint('GEMINI_API_KEY')} note={t('options.geminiApiKeyDesc')}>
                            <AiKeyField
                                value={electronSettings.GEMINI_API_KEY || ''}
                                onChange={value => setAi({ GEMINI_API_KEY: value })}
                                saved={savedAiApiKeys.GEMINI_API_KEY}
                                onClear={() => void onClearAiApiKey('GEMINI_API_KEY')}
                            />
                        </Row>
                    </Reveal>
                    <Row option={O.aiProxy} hint={t('options.useSystemProxyAIDesc')}>
                        <Toggle
                            checked={electronSettings.USE_SYSTEM_PROXY_FOR_AI}
                            onChange={enabled => setAi({ USE_SYSTEM_PROXY_FOR_AI: enabled })}
                        />
                    </Row>
                    <Row below={aiTest.result && <AiConnectionTestReply result={aiTest.result} />}>
                        {electronSaveStatus === 'saved' && <Value>{t('options.settingsSaved')}</Value>}
                        <Button icon={Zap} tip={t('options.aiTestConnectionDesc')} onClick={() => void aiTest.run()} disabled={aiTest.running}>
                            {aiTest.running ? t('options.aiTestRunning') : t('options.aiTestConnection')}
                        </Button>
                        <Button variant="primary" onClick={() => void onSaveElectronSettings()} disabled={electronSaveStatus === 'saving'}>
                            {electronSaveStatus === 'saving' ? t('options.settingsSaving') : t('options.save')}
                        </Button>
                    </Row>
                </FoldedGroup>
            )}
        </>
    );
};

export default AppearancePage;
