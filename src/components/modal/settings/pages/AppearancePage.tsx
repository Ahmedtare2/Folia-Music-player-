import React from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { ChosenSceneName } from '../../../scenes/settings/SceneWindow';
import { getVisualizerModeLabel } from '../../../visualizer/registry';
import { useDynamicAlbumArtworkStore } from '../../../../stores/useDynamicAlbumArtworkStore';
import { usePlayerChromeSettingsStore } from '../../../../stores/usePlayerChromeSettingsStore';
import { openSettings } from '../../../../stores/useSettingsModalStore';
import { useSystemBarSettingsStore } from '../../../../stores/useSystemBarSettingsStore';
import { useThemeSettingsStore } from '../../../../stores/useThemeSettingsStore';
import { useVisualizerSettingsStore } from '../../../../stores/useVisualizerSettingsStore';
import type { DynamicAlbumArtworkIntensity } from '../../../../utils/dynamicAlbumArtwork';
import { Button, Group, Reveal, Row, Segmented, Toggle, Value, option, type SettingsGroupDef, type SettingsOptionDef } from '../kit';
import { settingsAnchorSubview } from '../../../../utils/settingsAnchorModel';
import { useSettingsPage } from './settingsPageContext';

// src/components/modal/settings/pages/AppearancePage.tsx
// The 外观 page: which lyric animation the player uses, which scene (its window holds each scene's
// settings and sound tracing), light or dark, the colour theme, and how a
// song's own theme is made and applied. The AI provider those themes are generated with is not
// here: it is one connection shared by every AI feature, on the AI service page (pages/AiServicePage).
// The lyric animation workbench and the theme colour editor are the existing overlays; their rows
// here only open them.

const LYRICS: SettingsGroupDef = { id: 'lyricsRenderer', titleKey: 'options.lyricsRenderer' };
const DISPLAY_IMMERSIVE: SettingsGroupDef = { id: 'displayAndImmersiveMode', titleKey: 'options.displayAndImmersiveMode' };
const THEME: SettingsGroupDef = { id: 'themePresets', titleKey: 'options.settingsHeadingTheme' };
const SONG_THEME: SettingsGroupDef = { id: 'songTheme', titleKey: 'options.settingsHeadingSongTheme' };

const O = {
    lyricsAnimation: option(LYRICS, 'lyricsAnimationAdjust', 'options.lyricsAnimationAdjust'),
    albumVideoCovers: option(DISPLAY_IMMERSIVE, 'albumVideoCovers', 'options.albumVideoCovers'),
    dynamicArtwork: option(DISPLAY_IMMERSIVE, 'dynamicAlbumArtwork', 'options.dynamicAlbumArtwork'),
    dynamicArtworkIntensity: option(DISPLAY_IMMERSIVE, 'dynamicAlbumArtworkIntensity', 'options.dynamicAlbumArtworkIntensity'),
    hideStatusBar: option(DISPLAY_IMMERSIVE, 'hideStatusBar', 'options.hideStatusBar'),
    hideNavigationBar: option(DISPLAY_IMMERSIVE, 'hideNavigationBar', 'options.hideNavigationBar'),
    fullScreenLyricsMode: option(DISPLAY_IMMERSIVE, 'fullScreenLyricsMode', 'options.fullScreenLyricsMode'),
    scene: option(LYRICS, 'scene', 'ui.scene'),
    // Not a row of its own: it lives in the scene window, so a search for it lands on the group with the scene row.
    soundTracing: option(LYRICS, 'soundTracing', 'ui.soundTracing'),
    daylight: option(THEME, 'daylightMode', 'options.daylightMode'),
    preset: option(THEME, 'themePreset', 'options.themePresets'),
    themePark: option(THEME, 'openThemePark', 'options.openThemePark'),
    autoSwitch: option(SONG_THEME, 'autoSwitchSongTheme', 'options.autoSwitchSongTheme'),
    autoGenerate: option(SONG_THEME, 'autoGenerateSongTheme', 'options.autoGenerateSongTheme'),
    source: option(SONG_THEME, 'themeGenerationSource', 'options.themeGenerationSource'),
    preferCustom: option(SONG_THEME, 'preferCustomTheme', 'options.preferCustomTheme'),

};

export const OPTIONS: SettingsOptionDef[] = Object.values(O);

type DaylightChoice = 'light' | 'dark' | 'system';

const AppearancePage: React.FC = () => {
    const { t } = useTranslation();
    const { themeControls, onOpenVisPlayground, onOpenThemePark, onOpenSceneWindow } = useSettingsPage();
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

    return (
        <>
            <Group def={LYRICS} bare>
                {nativeBlurEnabled && <Row notice={t('options.nativeBlurBackgroundNotice')} />}
                <Row option={O.lyricsAnimation} hint={t('options.lyricsRendererDesc')} onClick={onOpenVisPlayground}>
                    <Value>{randomEnabled ? t('ui.visualizerRandom') : getVisualizerModeLabel(visualizerMode, t)}</Value>
                </Row>
                <Row option={O.scene} tag={t('ui.sceneBeta')} onClick={onOpenSceneWindow}>
                    <Value><ChosenSceneName /></Value>
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
        </>
    );
};

export default AppearancePage;
