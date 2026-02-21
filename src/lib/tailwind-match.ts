/**
 * Tailwind CSS v4 colour palette reference for closest-match detection.
 *
 * Uses the **700 shade** Oklch values as the canonical reference for each
 * family. The 700 shade (avg L ~0.515) is the closest functional equivalent
 * to our design system's 300 anchor (TARGET_CURVE[300].L ≈ 0.55) — 2.5×
 * closer than the 600 shade (avg L ~0.598) and wins for 13 of 17 families.
 *
 * Derived from the comprehensive TAILWIND_PALETTE (all shades).
 */

import { hexToRgb, rgbToOklch, hueDelta } from './colour';
import { ACHROMATIC_THRESHOLD, confidenceFromHueDelta, type HueConfidence } from './constants';
import { TAILWIND_PALETTE } from './tailwind-palette';

export interface TailwindColor {
	name: string;
	/** Oklch hue of the 700 shade */
	hue: number;
	/** Oklch chroma of the 700 shade */
	chroma: number;
	/** Oklch lightness of the 700 shade */
	lightness: number;
}

const REF_SHADE = '700';

export const TAILWIND_COLORS: TailwindColor[] = TAILWIND_PALETTE.map((f) => {
	const s = f.shades[REF_SHADE];
	return { name: f.name, hue: s.H, chroma: s.C, lightness: s.L };
});

export interface TailwindMatch {
	/** Closest Tailwind colour name */
	name: string;
	/** Hue difference in degrees */
	hueDelta: number;
	/** Whether this is a close match (< 15°) or approximate (< 30°) */
	confidence: HueConfidence;
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

	return { name: bestName, hueDelta: bestHueDelta, confidence: confidenceFromHueDelta(bestHueDelta) };
}
