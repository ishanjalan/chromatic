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
 * Source: https://spectrum.adobe.com/page/color-palette/
 *         https://adobe.design/stories/design-for-scale/reinventing-adobe-spectrum-s-colors
 */

export interface SpectrumColor {
	name: string;
	/** Approximate Oklch hue of the midpoint shade */
	hue: number;
	/** Representative hex (roughly the 900 shade) */
	hex: string;
}

export const SPECTRUM_COLORS: SpectrumColor[] = [
	{ name: 'Red',        hue: 25,   hex: '#E34850' },
	{ name: 'Orange',     hue: 55,   hex: '#E68619' },
	{ name: 'Yellow',     hue: 85,   hex: '#DFBF00' },
	{ name: 'Chartreuse', hue: 115,  hex: '#85D044' },
	{ name: 'Celery',     hue: 125,  hex: '#44B556' },
	{ name: 'Green',      hue: 145,  hex: '#12805C' },
	{ name: 'Seafoam',    hue: 175,  hex: '#1B959A' },
	{ name: 'Cyan',       hue: 210,  hex: '#0D66D0' },
	{ name: 'Blue',       hue: 250,  hex: '#2680EB' },
	{ name: 'Indigo',     hue: 280,  hex: '#6767EC' },
	{ name: 'Purple',     hue: 305,  hex: '#9256D9' },
	{ name: 'Fuchsia',    hue: 330,  hex: '#C038CC' },
	{ name: 'Magenta',    hue: 350,  hex: '#D83790' },
];
