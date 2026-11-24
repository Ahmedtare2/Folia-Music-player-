# Folia Music Player 0.7.21+styles4 (versionCode 2)

Base: Folia Music Player 0.7.21 (top.izuna.foliamajor). This build adds exactly four
visualizer styles ported from folia-major 0.7.29 and nothing else from 0.7.29.

## Added styles
- Hanabi (fireworks lyric PV)
- Machi (town dioramas)
- Metaphor (ink / halftone / grain)
- Nebbia (lyrics written on a fogged window)

## Arabic in the new styles
Cursive scripts (Arabic) animate per word instead of per letter in all four styles,
so letters keep their contextual joining; RTL lines lay out and highlight
right-to-left:
- hanabi: whole-word glyph units, RTL word order (text/lyricText.ts)
- machi: whole-word board glyphs, RTL placement + right-to-left reveal (engine/boardLayout.ts, engine/lyricScreen.ts)
- metaphor: full Arabic layout/glyph/camera work (same treatment as the Halcyon patch)
- nebbia: whole-word handwriting units with wide skeleton cells, RTL visual order (nebbiaChars.ts, nebbiaBlocks.ts, nebbiaSkeleton.ts)
- utils/lyrics/arabicText.ts gains wholeCursiveTimeline

## Ported support modules (needed by the four styles)
utils/lyricRenderQuality.ts, components/visualizer/renderQuality/*, services/analysis/{vocalEnvelope,gpuActivity}.ts,
components/visualizer/pixi/bloomFilter.ts, components/visualizer/{paragraphStructure,lucidePath2d}.ts, utils/whenIdle.ts,
plus additive updates to tuningDefinition.ts, visualizerSeedHash.ts, beatFx/{beatEffects,beatFxLive}.ts,
analysis/beatGridKeys.ts, services/lucideIconResolver.ts. New types in types.ts:
LyricRenderScale, LyricAntialias, LyricRenderQuality, LyricRenderOverride.
utils/colorMix.ts and utils/textMeasureCache.ts are shims re-exporting the existing
visualizer-local modules (textMeasureCache keeps its Arabic-aware prefix measuring).

## i18n
273 new locale keys per language (en / in / zh-CN) for the four styles, their beat
effects, command palette entries and tuning panels.

## Version
versionCode 1 -> 2, versionName "0.7.21" -> "0.7.21+styles4" in both
android/app/build.gradle and packaging/android/latest-source-overrides.json
(the workflow applies the overrides last, so they win).

## Verification done
- npx vite build (ANDROID=true) passes.
- vitest: visualizer registry / beat effects / live pictures suites pass (44 tests).
- The full vitest suite and tsc --noEmit run longer than the local build window;
  the GitHub Actions workflow runs both as the gate on upload.

## Fix after screenshot verification (v2)
- hanabi: glyph atlas cells were square (sized for single letters), so whole-word Arabic glyphs were cropped to the cell center and the outline (fat) layer rendered as blobs. Cells now use measured ink width (glyphs.ts); fill, outline and halves frames follow. Verified with screenshots (outline and hardShadow shots).

## v4 - TypeScript clean on the 0.7.21 base (after GitHub typecheck failure)
- src/types.ts: added LyricRenderScale / LyricAntialias / LyricRenderQuality / LyricRenderOverride and optional BeatEffectSetting.parts (verbatim 0.7.29 definitions; additive, no runtime change).
- useVisualizerSettingsStore: added the global lyricRenderQuality setting (default scale 1, antialias auto = every style's previous behavior) with persist + setter; styles' own overrides stay in their tunings.
- subtitleOverlayLayout stripped from the 4 style shells: 0.7.29-only overlay layout; the base subtitle overlay placement applies.
- machi entry: onClosePanel added to VisualizerQuickControlsProps and passed through in AppearanceSection (base already had the callback).
- nebbia entry: dropped 0.7.29-only showsBackground registration; nebbia's background config function still controls what it draws, and background beat-FX gating follows base behavior.
- machi boardLayout + hanabi glyphs: type fixes in the Arabic/atlas code added by this port.

## v4.1 - corrections found by subset typechecks
- types.ts: the base already had LyricRenderScale / LyricAntialias / LyricRenderQuality; only LyricRenderOverride and BeatEffectSetting.parts needed adding. Removed the duplicate declarations my first fix pass introduced.
- nebbia entry: also dropped the 0.7.29-only beatEffectOnScreen and prewarm/prewarmWhenIdle registry properties; the 0.7.21 registry does not consume them. Nebbia shaders compile on first render instead of the idle pre-warm (base behavior), and beat-FX gating follows the base beat clock.

## v4.1 verification (10:40 AM, workspace box could not hold a full run)
- Full-program tsc --noEmit could not complete locally: the sandbox box hard-recycles every ~10 min (5 wipes in an hour), and the run needs longer. Subset configs extending the real tsconfig (temporary, not shipped) covered every site of the 39 CI errors plus the whole visualizer slice:
  - A hanabi entry, B machi entry, C metaphor entry, D nebbia entry (each pulls its full import closure): all clean.
  - E stores + AppearanceSection + settingsSnapshot + types: clean.
  - F every file under src/components/visualizer + stores + beatEffects + settingsSnapshot + AppearanceSection: clean.
- vitest: workflow step-19 subset 11 files / 151 tests passed; builtinModeLists + beatEffectsGroup 5 passed; livePictures 39 passed.
- Ahmed's GitHub CI is the backstop for the full-program run.
