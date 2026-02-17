/**
 * Adobe Spectrum 2 colour palette reference for gap-fill suggestions.
 *
 * Hues are approximate Oklch equivalents derived from Spectrum 2's
 * published palette (spectrum.adobe.com/page/color-palette/).
 *
 * Spectrum uses CIECAM02-UCS internally; these Oklch hues are close
 * conversions of their 900 (midpoint) shade — suitable for hue-gap
 * matching, not pixel-exact reproduction.
 *
 * Preview hexes are generated at runtime by gap-analysis.ts using
 * TARGET_CURVE[300] L/C at each hue, so no hex values are stored here.
 *
 * Source: https://spectrum.adobe.com/page/color-palette/
 *         https://adobe.design/stories/design-for-scale/reinventing-adobe-spectrum-s-colors
 */

export interface SpectrumColor {
	name: string;
	/** Approximate Oklch hue of the midpoint shade */
	hue: number;
}

export const SPECTRUM_COLORS: SpectrumColor[] = [
	{ name: 'Red',        hue: 25  },
	{ name: 'Orange',     hue: 55  },
	{ name: 'Yellow',     hue: 85  },
	{ name: 'Chartreuse', hue: 115 },
	{ name: 'Celery',     hue: 125 },
	{ name: 'Green',      hue: 145 },
	{ name: 'Seafoam',    hue: 175 },
	{ name: 'Cyan',       hue: 210 },
	{ name: 'Blue',       hue: 250 },
	{ name: 'Indigo',     hue: 280 },
	{ name: 'Purple',     hue: 305 },
	{ name: 'Fuchsia',    hue: 330 },
	{ name: 'Magenta',    hue: 350 },
];
