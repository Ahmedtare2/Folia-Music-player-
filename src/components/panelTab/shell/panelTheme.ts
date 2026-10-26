import type { CSSProperties } from 'react';
import type { Theme } from '../../../types';
import { settingsTokens } from '../../modal/settings/kit/kitTheme';
import { kitMotionTokens } from '../../modal/settings/kit/motion';

// src/components/panelTab/shell/panelTheme.ts
// The colours of the playing page's opaque panel. It is drawn with the settings kit's parts, so it
// sets the kit's colour and motion variables on itself and adds the three the kit does not hold:
// the panel surface, its shadow and the colour of a liked heart. The text is the song theme's, as
// it was before the panel used the kit.

/** The variables, for the `style` of the panel's surface. */
export const panelTokens = (isDaylight: boolean, theme: Theme, reduced: boolean): CSSProperties => ({
    '--text-primary': theme.primaryColor,
    ...settingsTokens(isDaylight, theme),
    ...kitMotionTokens(reduced),
    // The kit's raised colour in the dark is a fixed grey for its own dark window. A white veil
    // keeps raised controls distinct on this dark panel.
    ...(isDaylight ? null : { '--st-raise': 'rgba(255, 255, 255, 0.18)' }),
    '--pn-glass': isDaylight ? 'rgba(244, 244, 245, 0.97)' : 'rgba(28, 28, 31, 0.97)',
    '--pn-shadow': isDaylight
        ? '0 30px 80px rgba(0, 0, 0, 0.24), 0 0 0 1px rgba(0, 0, 0, 0.06)'
        : '0 30px 80px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.09)',
    '--pn-like': isDaylight ? '#e0354f' : '#f2607a',
} as CSSProperties);
