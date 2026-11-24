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
