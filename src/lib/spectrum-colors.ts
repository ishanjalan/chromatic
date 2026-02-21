/**
 * Adobe Spectrum 2 colour palette reference for gap-fill suggestions.
 *
 * Uses the **900 shade** (light mode) as the canonical reference for each
 * family. The 900 shade (avg L ~0.56) is the closest Spectrum shade to
 * our TARGET_CURVE[300].L (≈0.55).
 *
 * Derived from the comprehensive SPECTRUM_PALETTE (all shades).
 */

import { SPECTRUM_PALETTE } from './spectrum-palette';

export interface SpectrumColor {
	name: string;
	/** Oklch hue of the 900 shade (light mode) */
	hue: number;
	/** Oklch chroma of the 900 shade (light mode) */
	chroma: number;
	/** Oklch lightness of the 900 shade (light mode) */
	lightness: number;
}

const REF_SHADE = '900';

export const SPECTRUM_COLORS: SpectrumColor[] = SPECTRUM_PALETTE.map((f) => {
	const s = f.shades[REF_SHADE];
	return { name: f.name, hue: s.H, chroma: s.C, lightness: s.L };
});
