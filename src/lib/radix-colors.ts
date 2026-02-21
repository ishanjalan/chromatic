/**
 * Radix Colors palette reference for gap-fill suggestions.
 *
 * Uses **step 11** (light mode) as the canonical reference for each family.
 * Step 11 (avg L ~0.53) is the closest Radix step to our
 * TARGET_CURVE[300].L (≈0.55).
 *
 * Derived from the comprehensive RADIX_PALETTE (all steps).
 */

import { RADIX_PALETTE } from './radix-palette';

export interface RadixColor {
	name: string;
	/** Oklch hue of step 11 (light mode) */
	hue: number;
	/** Oklch chroma of step 11 (light mode) */
	chroma: number;
	/** Oklch lightness of step 11 (light mode) */
	lightness: number;
}

const REF_STEP = '11';

export const RADIX_COLORS: RadixColor[] = RADIX_PALETTE.map((f) => {
	const s = f.shades[REF_STEP];
	return { name: f.name, hue: s.H, chroma: s.C, lightness: s.L };
});
