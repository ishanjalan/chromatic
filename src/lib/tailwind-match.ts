/**
 * Tailwind CSS v4 colour palette reference for closest-match detection.
 *
 * Uses the **700 shade** Oklch values as the canonical reference for each
 * family. The 700 shade (avg L ~0.515) is the closest functional equivalent
 * to our design system's 300 anchor (TARGET_CURVE[300].L = 0.5387) — 2.5×
 * closer than the 600 shade (avg L ~0.598) and wins for 13 of 17 families.
 * This ensures the most accurate hue matching at the lightness range that
 * matters for APCA-compliant primary action colours.
 *
 * Only chromatic colours are included (grays/neutrals excluded).
 *
 * Source: https://tailwindcss.com/docs/colors (Tailwind CSS v4)
 */

import { hexToRgb, rgbToOklch, hueDelta } from './colour';
import { ACHROMATIC_THRESHOLD } from './constants';

export interface TailwindColor {
	name: string;
	/** Oklch hue of the 700 shade */
	hue: number;
	/** Oklch chroma of the 700 shade */
	chroma: number;
	/** Oklch lightness of the 700 shade */
	lightness: number;
}

// Native OKLCH values from Tailwind v4 theme.css (main branch):
// https://github.com/tailwindlabs/tailwindcss/blob/main/packages/tailwindcss/theme.css
// Using the canonical oklch(L% C H) values directly — NOT round-tripped through hex/sRGB.
// Previous values had chroma ~0.02 too low due to sRGB gamut clamping during hex conversion.
export const TAILWIND_COLORS: TailwindColor[] = [
	{ name: 'Red',     lightness: 0.505, chroma: 0.213, hue: 27.518  },
	{ name: 'Orange',  lightness: 0.553, chroma: 0.195, hue: 38.402  },
	{ name: 'Amber',   lightness: 0.555, chroma: 0.163, hue: 48.998  },
	{ name: 'Yellow',  lightness: 0.554, chroma: 0.135, hue: 66.442  },
	{ name: 'Lime',    lightness: 0.532, chroma: 0.157, hue: 131.589 },
	{ name: 'Green',   lightness: 0.527, chroma: 0.154, hue: 150.069 },
	{ name: 'Emerald', lightness: 0.508, chroma: 0.118, hue: 165.612 },
	{ name: 'Teal',    lightness: 0.511, chroma: 0.096, hue: 186.391 },
	{ name: 'Cyan',    lightness: 0.520, chroma: 0.105, hue: 223.128 },
	{ name: 'Sky',     lightness: 0.500, chroma: 0.134, hue: 242.749 },
	{ name: 'Blue',    lightness: 0.488, chroma: 0.243, hue: 264.376 },
	{ name: 'Indigo',  lightness: 0.457, chroma: 0.240, hue: 277.023 },
	{ name: 'Violet',  lightness: 0.491, chroma: 0.270, hue: 292.581 },
	{ name: 'Purple',  lightness: 0.496, chroma: 0.265, hue: 301.924 },
	{ name: 'Fuchsia', lightness: 0.518, chroma: 0.253, hue: 323.949 },
	{ name: 'Pink',    lightness: 0.525, chroma: 0.223, hue: 3.958   },
	{ name: 'Rose',    lightness: 0.514, chroma: 0.222, hue: 16.935  },
];

export interface TailwindMatch {
	/** Closest Tailwind colour name */
	name: string;
	/** Hue difference in degrees */
	hueDelta: number;
	/** Whether this is a close match (< 15°) or approximate (< 30°) */
	confidence: 'exact' | 'close' | 'approximate' | 'distant';
}

/**
 * Find the closest Tailwind CSS colour family to a given hex value.
 * Primarily matches on Oklch hue angle, with chroma as tiebreaker.
 *
 * Achromatic inputs (C < ACHROMATIC_THRESHOLD) return "Neutral" since
 * their phantom hue is meaningless — they belong to the gray family.
 */
export function findClosestTailwind(hex: string): TailwindMatch {
	const { r, g, b } = hexToRgb(hex);
	const { H, C } = rgbToOklch(r, g, b);

	if (C < ACHROMATIC_THRESHOLD) {
		return { name: 'Neutral', hueDelta: 0, confidence: 'exact' };
	}

	let bestName = TAILWIND_COLORS[0].name;
	let bestHueDelta = Infinity;

	for (const tw of TAILWIND_COLORS) {
		const hd = hueDelta(H, tw.hue);
		if (hd < bestHueDelta) {
			bestHueDelta = hd;
			bestName = tw.name;
		}
	}

	let confidence: TailwindMatch['confidence'];
	if (bestHueDelta < 8) confidence = 'exact';
	else if (bestHueDelta < 18) confidence = 'close';
	else if (bestHueDelta < 30) confidence = 'approximate';
	else confidence = 'distant';

	return { name: bestName, hueDelta: bestHueDelta, confidence };
}
