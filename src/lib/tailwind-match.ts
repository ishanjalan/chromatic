/**
 * Tailwind CSS v4 colour palette reference for closest-match detection.
 *
 * Uses the 500 shade's Oklch hue as the canonical hue for each family.
 * Only chromatic colours are included (grays/neutrals excluded).
 *
 * Source: https://tailwindcss.com/docs/colors (Tailwind CSS v4)
 */

import { hexToRgb, rgbToOklch } from './colour';
import { ACHROMATIC_THRESHOLD } from './constants';

export interface TailwindColor {
	name: string;
	/** Oklch hue of the 500 shade */
	hue: number;
	/** Oklch chroma of the 500 shade */
	chroma: number;
	/** Oklch lightness of the 500 shade */
	lightness: number;
}

// Extracted from official Tailwind v4 @theme block — oklch(L C H) for the 500 shade
export const TAILWIND_COLORS: TailwindColor[] = [
	{ name: 'Red',     lightness: 0.637, chroma: 0.237, hue: 25.331 },
	{ name: 'Orange',  lightness: 0.705, chroma: 0.213, hue: 47.604 },
	{ name: 'Amber',   lightness: 0.769, chroma: 0.188, hue: 70.08 },
	{ name: 'Yellow',  lightness: 0.795, chroma: 0.184, hue: 86.047 },
	{ name: 'Lime',    lightness: 0.768, chroma: 0.233, hue: 130.85 },
	{ name: 'Green',   lightness: 0.723, chroma: 0.219, hue: 149.579 },
	{ name: 'Emerald', lightness: 0.696, chroma: 0.17,  hue: 162.48 },
	{ name: 'Teal',    lightness: 0.704, chroma: 0.14,  hue: 182.503 },
	{ name: 'Cyan',    lightness: 0.715, chroma: 0.143, hue: 215.221 },
	{ name: 'Sky',     lightness: 0.685, chroma: 0.169, hue: 237.323 },
	{ name: 'Blue',    lightness: 0.623, chroma: 0.214, hue: 259.815 },
	{ name: 'Indigo',  lightness: 0.585, chroma: 0.233, hue: 277.117 },
	{ name: 'Violet',  lightness: 0.606, chroma: 0.25,  hue: 292.717 },
	{ name: 'Purple',  lightness: 0.627, chroma: 0.265, hue: 303.9 },
	{ name: 'Fuchsia', lightness: 0.667, chroma: 0.295, hue: 322.15 },
	{ name: 'Pink',    lightness: 0.656, chroma: 0.241, hue: 354.308 },
	{ name: 'Rose',    lightness: 0.645, chroma: 0.246, hue: 16.439 },
];

/**
 * Angular distance between two hue values (0–360), wrapping correctly.
 */
function hueDelta(h1: number, h2: number): number {
	const d = Math.abs(h1 - h2) % 360;
	return d > 180 ? 360 - d : d;
}

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
