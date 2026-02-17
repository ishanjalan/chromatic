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

// Extracted from official Tailwind v4 @theme block — oklch(L C H) for the 700 shade
export const TAILWIND_COLORS: TailwindColor[] = [
	{ name: 'Red',     lightness: 0.5054, chroma: 0.1905, hue: 27.52  },
	{ name: 'Orange',  lightness: 0.5534, chroma: 0.1739, hue: 38.40  },
	{ name: 'Amber',   lightness: 0.5553, chroma: 0.1455, hue: 49.00  },
	{ name: 'Yellow',  lightness: 0.5538, chroma: 0.1207, hue: 66.44  },
	{ name: 'Lime',    lightness: 0.5322, chroma: 0.1405, hue: 131.59 },
	{ name: 'Green',   lightness: 0.5273, chroma: 0.1371, hue: 150.07 },
	{ name: 'Emerald', lightness: 0.5081, chroma: 0.1049, hue: 165.61 },
	{ name: 'Teal',    lightness: 0.5109, chroma: 0.0861, hue: 186.39 },
	{ name: 'Cyan',    lightness: 0.5198, chroma: 0.0936, hue: 223.13 },
	{ name: 'Sky',     lightness: 0.5000, chroma: 0.1193, hue: 242.75 },
	{ name: 'Blue',    lightness: 0.4882, chroma: 0.2172, hue: 264.38 },
	{ name: 'Indigo',  lightness: 0.4568, chroma: 0.2146, hue: 277.02 },
	{ name: 'Violet',  lightness: 0.4907, chroma: 0.2412, hue: 292.58 },
	{ name: 'Purple',  lightness: 0.4955, chroma: 0.2369, hue: 301.92 },
	{ name: 'Fuchsia', lightness: 0.5180, chroma: 0.2258, hue: 323.95 },
	{ name: 'Pink',    lightness: 0.5246, chroma: 0.199,  hue: 3.96   },
	{ name: 'Rose',    lightness: 0.5143, chroma: 0.1978, hue: 16.93  },
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
