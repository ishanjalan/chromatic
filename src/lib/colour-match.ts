/**
 * Unified multi-system colour matcher.
 *
 * Finds the closest colour from Tailwind CSS v4, Adobe Spectrum 2, and
 * Radix Colors for a given hex input. Returns ranked matches across all
 * three systems for display in the UI.
 */

import { hexToRgb, rgbToOklch, oklchToRgb, rgbToHex, hueDelta, clampChromaToGamut } from './colour';
import { ACHROMATIC_THRESHOLD, TARGET_CURVE } from './constants';
import { TAILWIND_COLORS } from './tailwind-match';
import { SPECTRUM_COLORS } from './spectrum-colors';
import { RADIX_COLORS } from './radix-colors';

export type DesignSystem = 'Tailwind' | 'Spectrum' | 'Radix';

export interface ColourMatch {
	name: string;
	source: DesignSystem;
	hueDelta: number;
	confidence: 'exact' | 'close' | 'approximate' | 'distant';
	/** Reference hue from the design system */
	refHue: number;
	/** Reference chroma from the design system */
	refChroma: number;
	/** Reference lightness from the design system */
	refLightness: number;
	/** Preview hex at our TARGET_CURVE[300] lightness, gamut-clamped */
	previewHex: string;
}

export interface MultiSystemMatch {
	/** Best match from Tailwind (null if achromatic) */
	tailwind: ColourMatch | null;
	/** Best match from Spectrum (null if achromatic) */
	spectrum: ColourMatch | null;
	/** Best match from Radix (null if achromatic) */
	radix: ColourMatch | null;
	/** Whether the input is achromatic */
	isAchromatic: boolean;
}

function confidenceFromDelta(hd: number): ColourMatch['confidence'] {
	if (hd < 8) return 'exact';
	if (hd < 18) return 'close';
	if (hd < 30) return 'approximate';
	return 'distant';
}

/** Generate a preview hex for a reference colour at our anchor lightness. */
function makePreviewHex(refHue: number, refChroma: number): string {
	const { L } = TARGET_CURVE[300];
	const C = clampChromaToGamut(L, refChroma, refHue);
	const { r, g, b } = oklchToRgb(L, C, refHue);
	return rgbToHex(r, g, b);
}

function findBest(
	hue: number,
	colors: Array<{ name: string; hue: number; chroma: number; lightness: number }>,
	source: DesignSystem
): ColourMatch {
	let bestName = colors[0].name;
	let bestHueDelta = Infinity;
	let bestRef = colors[0];

	for (const c of colors) {
		const hd = hueDelta(hue, c.hue);
		if (hd < bestHueDelta) {
			bestHueDelta = hd;
			bestName = c.name;
			bestRef = c;
		}
	}

	return {
		name: bestName,
		source,
		hueDelta: bestHueDelta,
		confidence: confidenceFromDelta(bestHueDelta),
		refHue: bestRef.hue,
		refChroma: bestRef.chroma,
		refLightness: bestRef.lightness,
		previewHex: makePreviewHex(bestRef.hue, bestRef.chroma)
	};
}

/**
 * Find the closest colour match from each of the three reference systems.
 */
export function findClosestMulti(hex: string): MultiSystemMatch {
	const { r, g, b } = hexToRgb(hex);
	const { H, C } = rgbToOklch(r, g, b);

	if (C < ACHROMATIC_THRESHOLD) {
		return { tailwind: null, spectrum: null, radix: null, isAchromatic: true };
	}

	return {
		tailwind: findBest(H, TAILWIND_COLORS, 'Tailwind'),
		spectrum: findBest(H, SPECTRUM_COLORS, 'Spectrum'),
		radix: findBest(H, RADIX_COLORS, 'Radix'),
		isAchromatic: false
	};
}

/**
 * Get the top N closest matches across all systems, sorted by hue delta.
 * Useful for showing alternative suggestions when entering a hex manually.
 */
export function findTopMatches(hex: string, limit = 6): ColourMatch[] {
	const { r, g, b } = hexToRgb(hex);
	const { H, C } = rgbToOklch(r, g, b);

	if (C < ACHROMATIC_THRESHOLD) return [];

	const allMatches: ColourMatch[] = [];

	const systems: Array<{ colors: typeof TAILWIND_COLORS; source: DesignSystem }> = [
		{ colors: TAILWIND_COLORS, source: 'Tailwind' },
		{ colors: SPECTRUM_COLORS, source: 'Spectrum' },
		{ colors: RADIX_COLORS, source: 'Radix' }
	];

	for (const { colors, source } of systems) {
		for (const c of colors) {
			const hd = hueDelta(H, c.hue);
			allMatches.push({
				name: c.name,
				source,
				hueDelta: hd,
				confidence: confidenceFromDelta(hd),
				refHue: c.hue,
				refChroma: c.chroma,
				refLightness: c.lightness,
				previewHex: makePreviewHex(c.hue, c.chroma)
			});
		}
	}

	allMatches.sort((a, b) => a.hueDelta - b.hueDelta);

	// Deduplicate same-name same-source, keep only closest
	const seen = new Set<string>();
	const unique: ColourMatch[] = [];
	for (const m of allMatches) {
		const key = `${m.source}:${m.name}`;
		if (!seen.has(key)) {
			seen.add(key);
			unique.push(m);
		}
	}

	return unique.slice(0, limit);
}
