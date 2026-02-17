/**
 * Radix Colors palette reference for gap-fill suggestions.
 *
 * Oklch values derived from Radix Colors **step 11** (light mode) using
 * the official @radix-ui/colors package:
 * https://github.com/radix-ui/colors
 *
 * Step 11 was chosen because its average Oklch lightness (0.533) is the
 * closest Radix step to our TARGET_CURVE[300].L (0.5387) — only 0.005
 * away, vs 0.049 for step 10 and 0.079 for step 9.
 *
 * Radix has two types of colour scales:
 * - **Standard** (tomato→orange): step 9 is the solid/primary, step 11
 *   is low-contrast accessible text.
 * - **Bright** (sky, mint, lime, yellow, amber): step 9 is a light tint
 *   (background), step 11 is the functional solid colour.
 * In both cases, step 11 is the lightness-closest match to our anchor.
 *
 * All 25 chromatic scales are included (6 neutrals excluded).
 * While many overlap in hue with Tailwind/Spectrum, the gap analysis
 * algorithm handles deduplication via OVERLAP_TOLERANCE. Unique additions
 * include Brown (~56°), Gold (~78°), Pink (~347°), and Jade (~176°).
 *
 * Source: https://www.radix-ui.com/colors
 *         https://github.com/radix-ui/colors (v3.0.0+)
 */

export interface RadixColor {
	name: string;
	/** Oklch hue of step 11 (light mode) */
	hue: number;
	/** Oklch chroma of step 11 (light mode) */
	chroma: number;
	/** Oklch lightness of step 11 (light mode) */
	lightness: number;
}

export const RADIX_COLORS: RadixColor[] = [
	// Standard chromatic scales
	{ name: 'Tomato',  hue: 32.73,  chroma: 0.1978, lightness: 0.5665 },
	{ name: 'Red',     hue: 25.17,  chroma: 0.1974, lightness: 0.5570 },
	{ name: 'Ruby',    hue: 13.90,  chroma: 0.1985, lightness: 0.5489 },
	{ name: 'Crimson', hue: 4.49,   chroma: 0.2073, lightness: 0.5522 },
	{ name: 'Pink',    hue: 347.32, chroma: 0.2069, lightness: 0.5575 },
	{ name: 'Plum',    hue: 321.89, chroma: 0.1727, lightness: 0.5216 },
	{ name: 'Purple',  hue: 307.40, chroma: 0.1786, lightness: 0.4906 },
	{ name: 'Violet',  hue: 285.88, chroma: 0.1604, lightness: 0.4709 },
	{ name: 'Iris',    hue: 279.84, chroma: 0.1739, lightness: 0.5111 },
	{ name: 'Indigo',  hue: 267.17, chroma: 0.1725, lightness: 0.5092 },
	{ name: 'Blue',    hue: 252.19, chroma: 0.1622, lightness: 0.5558 },
	{ name: 'Cyan',    hue: 220.75, chroma: 0.0966, lightness: 0.5470 },
	{ name: 'Teal',    hue: 178.79, chroma: 0.1010, lightness: 0.5521 },
	{ name: 'Jade',    hue: 175.80, chroma: 0.0904, lightness: 0.5246 },
	{ name: 'Green',   hue: 159.50, chroma: 0.1116, lightness: 0.5435 },
	{ name: 'Grass',   hue: 147.20, chroma: 0.1294, lightness: 0.5262 },
	{ name: 'Orange',  hue: 42.74,  chroma: 0.1743, lightness: 0.5855 },
	{ name: 'Brown',   hue: 56.06,  chroma: 0.0615, lightness: 0.5313 },
	{ name: 'Bronze',  hue: 38.63,  chroma: 0.0438, lightness: 0.5109 },
	{ name: 'Gold',    hue: 78.26,  chroma: 0.0395, lightness: 0.5042 },

	// Bright scales (step 11 is their solid-colour shade)
	{ name: 'Sky',     hue: 232.55, chroma: 0.1079, lightness: 0.5255 },
	{ name: 'Mint',    hue: 175.60, chroma: 0.0955, lightness: 0.5117 },
	{ name: 'Lime',    hue: 128.60, chroma: 0.1114, lightness: 0.5444 },
	{ name: 'Yellow',  hue: 76.81,  chroma: 0.1192, lightness: 0.5691 },
	{ name: 'Amber',   hue: 63.94,  chroma: 0.1291, lightness: 0.5706 },
];
