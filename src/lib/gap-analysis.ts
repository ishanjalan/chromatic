/**
 * Hue-gap analysis — identifies gaps in a palette's hue distribution
 * and suggests colours from Tailwind CSS v4 and Adobe Spectrum 2
 * to fill them.
 *
 * Suggestion preview hexes are generated at TARGET_CURVE[300] lightness
 * and chroma, gamut-clamped, so that the preview swatch matches what the
 * generator will actually produce when the suggestion is adopted.
 */

import { oklchToRgb, rgbToHex, clampChromaToGamut, hueDelta } from './colour';
import { TARGET_CURVE } from './constants';
import { TAILWIND_COLORS } from './tailwind-match';
import { SPECTRUM_COLORS } from './spectrum-colors';
import type { HueDot } from './components/HueWheel.svelte';

/** Minimum angular gap (degrees) before we suggest filling it. */
const GAP_THRESHOLD = 25;

export interface GapSuggestion {
	/** Suggested colour name */
	name: string;
	/** Source palette */
	source: 'Tailwind' | 'Spectrum';
	/** Representative hex for display */
	hex: string;
	/** Oklch hue angle of the suggestion */
	hue: number;
	/** The gap this suggestion fills (degrees) */
	gapSize: number;
	/** Names of the two adjacent families that form the gap */
	between: [string, string];
}

interface HueEntry {
	name: string;
	hue: number;
}

/**
 * Clockwise angular distance from hue `a` to hue `b` on the 0-360 wheel.
 */
function clockwiseDistance(a: number, b: number): number {
	return ((b - a) % 360 + 360) % 360;
}

/**
 * Find the midpoint hue between two hues going clockwise from a to b.
 */
function midpointHue(a: number, b: number): number {
	const dist = clockwiseDistance(a, b);
	return (a + dist / 2) % 360;
}

/**
 * Check if a hue falls within a clockwise arc from `start` to `end`.
 */
function isInArc(hue: number, start: number, end: number): boolean {
	const distToEnd = clockwiseDistance(start, end);
	const distToHue = clockwiseDistance(start, hue);
	return distToHue < distToEnd;
}

/**
 * Build a combined reference palette from Tailwind and Spectrum,
 * excluding colours that are already represented in the uploaded palette
 * (within a tolerance).
 *
 * Both sources are filtered independently against the uploaded hues only —
 * not against each other — so that near-duplicate references (e.g. TW Teal
 * and SP Seafoam) both survive. The gap-matching step handles deduplication
 * by picking the candidate closest to each gap's midpoint.
 */
function buildReferenceColors(existingHues: number[]): Array<{
	name: string;
	hue: number;
	hex: string;
	source: 'Tailwind' | 'Spectrum';
}> {
	const OVERLAP_TOLERANCE = 10; // degrees — lower than 15 to surface Sky, Emerald, etc.

	const refs: Array<{ name: string; hue: number; hex: string; source: 'Tailwind' | 'Spectrum' }> = [];

	for (const tw of TAILWIND_COLORS) {
		const tooClose = existingHues.some((h) => hueDelta(h, tw.hue) < OVERLAP_TOLERANCE);
		if (!tooClose) {
			refs.push({
				name: tw.name,
				hue: tw.hue,
				hex: previewHexForHue(tw.hue),
				source: 'Tailwind'
			});
		}
	}

	for (const sp of SPECTRUM_COLORS) {
		const tooClose = existingHues.some((h) => hueDelta(h, sp.hue) < OVERLAP_TOLERANCE);
		if (!tooClose) {
			refs.push({
				name: sp.name,
				hue: sp.hue,
				hex: previewHexForHue(sp.hue),
				source: 'Spectrum'
			});
		}
	}

	return refs;
}

/**
 * Generate an honest preview hex for a suggestion at a given hue.
 *
 * Uses TARGET_CURVE[300] L and C (the values the generator will actually use)
 * with gamut clamping, so what the user sees in the suggestion matches what
 * they'll get when they adopt it.
 */
function previewHexForHue(hue: number): string {
	const { L, C } = TARGET_CURVE[300];
	const clampedC = clampChromaToGamut(L, C, hue);
	const { r, g, b } = oklchToRgb(L, clampedC, hue);
	return rgbToHex(r, g, b);
}

/**
 * Analyse hue gaps in the uploaded palette and suggest colours to fill them.
 *
 * @param uploadedDots - HueDot[] from the uploaded token families
 * @returns Ranked list of gap suggestions (largest gaps first)
 */
export function analyseHueGaps(uploadedDots: HueDot[]): GapSuggestion[] {
	if (uploadedDots.length < 2) return [];

	// Sort dots by hue
	const sorted: HueEntry[] = [...uploadedDots]
		.sort((a, b) => a.hue - b.hue)
		.map((d) => ({ name: d.name, hue: d.hue }));

	// Build gaps (including wrap-around)
	const gaps: Array<{ from: HueEntry; to: HueEntry; size: number; midpoint: number }> = [];

	for (let i = 0; i < sorted.length; i++) {
		const from = sorted[i];
		const to = sorted[(i + 1) % sorted.length];
		const size = clockwiseDistance(from.hue, to.hue);

		if (size >= GAP_THRESHOLD) {
			gaps.push({
				from,
				to,
				size,
				midpoint: midpointHue(from.hue, to.hue)
			});
		}
	}

	// Sort gaps by size (largest first)
	gaps.sort((a, b) => b.size - a.size);

	// Build reference palette excluding colours already in the uploaded set
	const existingHues = sorted.map((e) => e.hue);
	const refs = buildReferenceColors(existingHues);

	// For each gap, find the best reference colour(s)
	const suggestions: GapSuggestion[] = [];

	for (const gap of gaps) {
		// Find reference colours that fall within this arc
		const candidates = refs.filter((r) => isInArc(r.hue, gap.from.hue, gap.to.hue));

		if (candidates.length === 0) continue;

		// Sort by proximity to the gap midpoint (closest to centre of gap wins)
		candidates.sort((a, b) =>
			hueDelta(a.hue, gap.midpoint) - hueDelta(b.hue, gap.midpoint)
		);

		// Take up to 2 suggestions per gap
		const take = gap.size > 60 ? 2 : 1;
		for (let i = 0; i < Math.min(take, candidates.length); i++) {
			const c = candidates[i];
			suggestions.push({
				name: c.name,
				source: c.source,
				hex: c.hex,
				hue: c.hue,
				gapSize: gap.size,
				between: [gap.from.name, gap.to.name]
			});
		}
	}

	return suggestions;
}

/**
 * Convert gap suggestions into HueDots for the wheel visualisation.
 */
export function suggestionsToHueDots(suggestions: GapSuggestion[]): HueDot[] {
	return suggestions.map((s) => ({
		name: s.name,
		hue: s.hue,
		hex: s.hex,
		source: 'suggestion' as const
	}));
}
