/**
 * Adobe Spectrum 2 colour palette reference for gap-fill suggestions.
 *
 * Oklch values derived from Spectrum 2's **900 shade** (light mode) using
 * the official spectrum-design-data token repository:
 * https://github.com/adobe/spectrum-design-data
 *
 * The 900 shade was chosen because its average Oklch lightness (0.5612)
 * is the closest Spectrum shade to our TARGET_CURVE[300].L (0.5387) —
 * only 0.023 away, vs 0.041 for shade 1000 and 0.069 for shade 800.
 *
 * Analysis methodology: extracted rgb() values for all 13 chromatic hues
 * at shades 700–1100, converted to Oklch, and compared average L to
 * our target. Same approach used for Tailwind (where 700 won).
 *
 * Preview hexes are generated at runtime by gap-analysis.ts using
 * TARGET_CURVE[300] L/C at each hue, so no hex values are stored here.
 *
 * Source: https://opensource.adobe.com/spectrum-design-data/tokens/color-palette/
 *         https://spectrum.adobe.com/page/color-palette/
 */

export interface SpectrumColor {
	name: string;
	/** Oklch hue of the 900 shade (light mode) */
	hue: number;
	/** Oklch chroma of the 900 shade (light mode) */
	chroma: number;
	/** Oklch lightness of the 900 shade (light mode) */
	lightness: number;
}

export const SPECTRUM_COLORS: SpectrumColor[] = [
	{ name: 'Red',        hue: 30.37,  chroma: 0.2036, lightness: 0.5761 },
	{ name: 'Orange',     hue: 44.44,  chroma: 0.1644, lightness: 0.5695 },
	{ name: 'Yellow',     hue: 71.93,  chroma: 0.1194, lightness: 0.5573 },
	{ name: 'Chartreuse', hue: 120.41, chroma: 0.1297, lightness: 0.5438 },
	{ name: 'Celery',     hue: 136.12, chroma: 0.1530, lightness: 0.5390 },
	{ name: 'Green',      hue: 156.58, chroma: 0.1275, lightness: 0.5371 },
	{ name: 'Seafoam',    hue: 176.56, chroma: 0.0990, lightness: 0.5399 },
	{ name: 'Cyan',       hue: 241.45, chroma: 0.1257, lightness: 0.5480 },
	{ name: 'Blue',       hue: 267.08, chroma: 0.2303, lightness: 0.5667 },
	{ name: 'Indigo',     hue: 284.09, chroma: 0.2332, lightness: 0.5759 },
	{ name: 'Purple',     hue: 304.79, chroma: 0.2251, lightness: 0.5797 },
	{ name: 'Fuchsia',    hue: 322.02, chroma: 0.2265, lightness: 0.5826 },
	{ name: 'Magenta',    hue: 8.30,   chroma: 0.2140, lightness: 0.5797 },
];
