/**
 * Neutral / achromatic colour analysis engine.
 *
 * Analyses grey/neutral scales for:
 * - Perceptual lightness distribution (Oklch L)
 * - Proximity clusters (shades too close to distinguish)
 * - APCA readability against white and dark backgrounds
 * - Consolidation recommendations (remove redundant, keep even spacing)
 * - Semantic role suggestions based on lightness range
 */

import type { AchromaticFamily } from './parse-tokens';
import { hexToRgb, rgbToOklch, apcaContrast } from './colour';

/* ─── Interfaces ─── */

/** Per-shade tint match from a single design system */
export interface ShadeTintMatch {
	source: 'Tailwind' | 'Radix';
	name: string;
	hueDelta: number;
}

export interface NeutralShade {
	shade: number;
	hex: string;
	/** Oklch lightness 0–1 */
	L: number;
	/** Oklch chroma (low for true neutrals, slightly higher for tinted greys) */
	C: number;
	/** Oklch hue angle 0–360 (meaningful only when C > 0) */
	H: number;
	/** APCA Lc against white (#FFFFFF) background — text-on-light readability */
	apcaOnWhite: number;
	/** APCA Lc against dark (#1A1A1A) background — text-on-dark readability */
	apcaOnDark: number;
	/** Whether this shade has a noticeable colour tint (C > 0.005) */
	isTinted: boolean;
	/** Per-shade tint matches from Tailwind and Radix (only for tinted shades) */
	tintMatches: ShadeTintMatch[];
}

export interface ProximityCluster {
	/** Shade numbers in this cluster */
	shades: number[];
	/** Hex values for each shade */
	hexes: string[];
	/** Lightness values */
	lightnesses: number[];
	/** Max ΔL within this cluster */
	maxDeltaL: number;
	/** Recommended shade to keep (the one with the most standard number) */
	keepShade: number;
	/** Shades that could be removed */
	dropShades: number[];
	reason: string;
}

export type SemanticRole =
	| 'Page background'
	| 'Card / surface'
	| 'Subtle background'
	| 'Border / divider'
	| 'Placeholder / disabled'
	| 'Secondary text'
	| 'Primary text'
	| 'Inverse surface'
	| 'Inverse text background';

export interface ConsolidatedShade {
	shade: number;
	hex: string;
	L: number;
	role: SemanticRole;
	/** Whether this shade exists in the original set or is interpolated */
	isOriginal: boolean;
	/** Original shade number if mapped from existing */
	originalShade?: number;
}

/** A named neutral from a reference design system */
export interface NeutralNameMatch {
	/** Design system source */
	source: 'Tailwind' | 'Radix' | 'Spectrum';
	/** Name of the neutral scale (e.g. "Slate", "Mauve") */
	name: string;
	/** Description of the tint character */
	tint: string;
	/** Hue delta between user's neutral and this reference (degrees) */
	hueDelta: number;
	/** Whether this reference is achromatic (true grey) */
	isAchromatic: boolean;
}

export interface NeutralAnalysis {
	familyName: string;
	/** True if this is an alpha/opacity variant family (e.g. Grey Alpha) */
	isAlpha: boolean;
	/** All shades with computed properties, sorted by lightness (light → dark) */
	shades: NeutralShade[];
	/** Groups of shades that are perceptually too close */
	proximityClusters: ProximityCluster[];
	/** Overall distribution score 0–100 (100 = perfectly even) */
	distributionScore: number;
	/** Recommended consolidated shade set */
	consolidated: ConsolidatedShade[];
	/** Closest named neutrals from popular design systems (family-level summary) */
	tintMatches: NeutralNameMatch[];
	/** Detected average tint hue (null if pure neutral) */
	avgTintHue: number | null;
	/** Detected average tint chroma */
	avgTintChroma: number;
	/** Whether tinted shades agree on tint direction (true = consistent, false = drifting) */
	tintConsistent: boolean;
	/** Summary stats */
	stats: {
		totalShades: number;
		consolidatedCount: number;
		tintedCount: number;
		clusteredCount: number;
	};
}

/* ─── Constants ─── */

/** ΔL below which two consecutive shades are flagged as too close */
const PROXIMITY_THRESHOLD = 0.008;

/** White and dark reference colours for APCA testing */
const WHITE = { r: 1, g: 1, b: 1 };
const DARK = { r: 0.1, g: 0.1, b: 0.1 }; // #1A1A1A

/**
 * Tint detection threshold — lightness-adaptive.
 * At extreme L (very light / very dark), the sRGB gamut is narrow so even
 * tiny chroma is meaningful (e.g. Tailwind Slate-50 has C ≈ 0.0034).
 * At mid-range L, more chroma is needed to be perceptible.
 */
function tintThreshold(L: number): number {
	if (L > 0.92 || L < 0.08) return 0.0015;  // extreme light / dark
	if (L > 0.85 || L < 0.15) return 0.003;    // near-extreme
	return 0.005;                                // mid-range
}

/**
 * Target lightness values for a well-structured 11-shade neutral scale.
 * Derived from Tailwind's grey scale structure, mapped to Oklch L.
 * These represent ideal perceptual anchor points.
 */
const IDEAL_L_TARGETS: Array<{ shade: number; L: number; role: SemanticRole }> = [
	{ shade: 0,   L: 1.000, role: 'Page background' },
	{ shade: 50,  L: 0.985, role: 'Page background' },
	{ shade: 100, L: 0.950, role: 'Subtle background' },
	{ shade: 200, L: 0.880, role: 'Card / surface' },
	{ shade: 300, L: 0.780, role: 'Border / divider' },
	{ shade: 400, L: 0.640, role: 'Placeholder / disabled' },
	{ shade: 500, L: 0.530, role: 'Secondary text' },
	{ shade: 600, L: 0.420, role: 'Primary text' },
	{ shade: 700, L: 0.310, role: 'Primary text' },
	{ shade: 800, L: 0.210, role: 'Inverse surface' },
	{ shade: 900, L: 0.130, role: 'Inverse text background' },
	{ shade: 950, L: 0.070, role: 'Inverse text background' },
];

/**
 * Reference named neutrals from popular design systems.
 * Each entry has a representative Oklch hue (from mid-tone shades)
 * and a human-readable tint description.
 *
 * Tailwind v4: OKLCH values from official source, using shade-500 hue.
 * Radix Colors v3: Computed from official hex values, using step-8 hue.
 * Spectrum 2: Adobe has a single "Gray" neutral; no tinted variants.
 */
interface RefNeutral {
	source: 'Tailwind' | 'Radix' | 'Spectrum';
	name: string;
	tint: string;
	hue: number;
	isAchromatic: boolean;
}

const REF_NEUTRALS: RefNeutral[] = [
	// Tailwind CSS v4 — from official OKLCH values
	{ source: 'Tailwind', name: 'Neutral',  tint: 'Pure grey — no hue',                  hue: 0,   isAchromatic: true },
	{ source: 'Tailwind', name: 'Stone',    tint: 'Warm, yellow-brown tint',              hue: 58,  isAchromatic: false },
	{ source: 'Tailwind', name: 'Slate',    tint: 'Cool blue tint',                       hue: 257, isAchromatic: false },
	{ source: 'Tailwind', name: 'Gray',     tint: 'Subtle blue tint (cooler than Slate)', hue: 264, isAchromatic: false },
	{ source: 'Tailwind', name: 'Zinc',     tint: 'Violet / purple tint',                 hue: 286, isAchromatic: false },

	// Radix Colors v3 — from official hex values (step 8 → Oklch hue)
	{ source: 'Radix', name: 'Gray',  tint: 'Pure grey — no hue',   hue: 0,   isAchromatic: true },
	{ source: 'Radix', name: 'Sand',  tint: 'Warm yellow tint',     hue: 80,  isAchromatic: false },
	{ source: 'Radix', name: 'Olive', tint: 'Yellow-green tint',    hue: 130, isAchromatic: false },
	{ source: 'Radix', name: 'Sage',  tint: 'Green tint',           hue: 155, isAchromatic: false },
	{ source: 'Radix', name: 'Slate', tint: 'Blue tint',            hue: 255, isAchromatic: false },
	{ source: 'Radix', name: 'Mauve', tint: 'Purple tint',          hue: 293, isAchromatic: false },

	// Adobe Spectrum 2 — single neutral only
	{ source: 'Spectrum', name: 'Gray', tint: 'Neutral grey (single scale)', hue: 0, isAchromatic: true },
];

/* ─── Helpers ─── */

function hueDistance(a: number, b: number): number {
	const d = Math.abs(a - b) % 360;
	return d > 180 ? 360 - d : d;
}

/* ─── Core analysis ─── */

/** Find closest chromatic neutral from a given system for a specific hue */
function matchShadeToSystem(hue: number, source: 'Tailwind' | 'Radix'): ShadeTintMatch {
	const chromatic = REF_NEUTRALS.filter((r) => r.source === source && !r.isAchromatic);
	let bestRef = chromatic[0];
	let bestDelta = hueDistance(hue, chromatic[0].hue);

	for (let i = 1; i < chromatic.length; i++) {
		const d = hueDistance(hue, chromatic[i].hue);
		if (d < bestDelta) {
			bestDelta = d;
			bestRef = chromatic[i];
		}
	}

	return { source, name: bestRef.name, hueDelta: Math.round(bestDelta) };
}

function computeShade(shade: number, hex: string): NeutralShade {
	const { r, g, b } = hexToRgb(hex);
	const { L, C, H } = rgbToOklch(r, g, b);

	const apcaOnWhite = Math.abs(apcaContrast(r, g, b, WHITE.r, WHITE.g, WHITE.b));
	const apcaOnDark = Math.abs(apcaContrast(r, g, b, DARK.r, DARK.g, DARK.b));

	const isTinted = C > tintThreshold(L);
	const tintMatches: ShadeTintMatch[] = isTinted
		? [matchShadeToSystem(H, 'Tailwind'), matchShadeToSystem(H, 'Radix')]
		: [];

	return {
		shade,
		hex,
		L,
		C,
		H,
		apcaOnWhite,
		apcaOnDark,
		isTinted,
		tintMatches
	};
}

function findProximityClusters(shades: NeutralShade[]): ProximityCluster[] {
	if (shades.length < 2) return [];

	const clusters: ProximityCluster[] = [];
	let currentCluster: NeutralShade[] = [shades[0]];

	for (let i = 1; i < shades.length; i++) {
		const deltaL = Math.abs(shades[i].L - shades[i - 1].L);
		if (deltaL < PROXIMITY_THRESHOLD) {
			currentCluster.push(shades[i]);
		} else {
			if (currentCluster.length >= 2) {
				clusters.push(buildCluster(currentCluster));
			}
			currentCluster = [shades[i]];
		}
	}
	if (currentCluster.length >= 2) {
		clusters.push(buildCluster(currentCluster));
	}

	return clusters;
}

function buildCluster(shades: NeutralShade[]): ProximityCluster {
	const lightnesses = shades.map((s) => s.L);
	const maxDeltaL = Math.max(...lightnesses) - Math.min(...lightnesses);

	// Compute max step between consecutive shades in this cluster
	let maxStep = 0;
	for (let i = 1; i < shades.length; i++) {
		maxStep = Math.max(maxStep, Math.abs(shades[i].L - shades[i - 1].L));
	}

	// Prefer keeping the shade with the "roundest" number (divisible by 100, then 50)
	const sorted = [...shades].sort((a, b) => {
		const scoreA = a.shade % 100 === 0 ? 0 : a.shade % 50 === 0 ? 1 : 2;
		const scoreB = b.shade % 100 === 0 ? 0 : b.shade % 50 === 0 ? 1 : 2;
		if (scoreA !== scoreB) return scoreA - scoreB;
		return a.shade - b.shade; // lower number wins ties
	});

	const keepShade = sorted[0].shade;
	const dropShades = shades.filter((s) => s.shade !== keepShade).map((s) => s.shade);

	const reason = maxStep < 0.005
		? `Visually indistinguishable (ΔL ≤ ${(maxStep * 100).toFixed(1)}% per step)`
		: `Very close (ΔL ≤ ${(maxStep * 100).toFixed(1)}% per step) — hard to tell apart`;

	return {
		shades: shades.map((s) => s.shade),
		hexes: shades.map((s) => s.hex),
		lightnesses,
		maxDeltaL,
		keepShade,
		dropShades,
		reason
	};
}

function computeDistributionScore(shades: NeutralShade[]): number {
	if (shades.length < 3) return 100;

	// Ideal: evenly spaced L values across the full 0–1 range
	const Ls = shades.map((s) => s.L).sort((a, b) => b - a); // sorted light → dark
	const idealStep = (Ls[0] - Ls[Ls.length - 1]) / (Ls.length - 1);

	if (idealStep === 0) return 0;

	let totalDeviation = 0;
	for (let i = 1; i < Ls.length; i++) {
		const actualStep = Ls[i - 1] - Ls[i];
		const deviation = Math.abs(actualStep - idealStep) / idealStep;
		totalDeviation += deviation;
	}

	const avgDeviation = totalDeviation / (Ls.length - 1);
	return Math.max(0, Math.round((1 - avgDeviation) * 100));
}

function buildConsolidation(shades: NeutralShade[]): ConsolidatedShade[] {
	const consolidated: ConsolidatedShade[] = [];

	for (const target of IDEAL_L_TARGETS) {
		// Find the closest existing shade to this target L
		let bestMatch: NeutralShade | null = null;
		let bestDist = Infinity;

		for (const s of shades) {
			const dist = Math.abs(s.L - target.L);
			if (dist < bestDist) {
				bestDist = dist;
				bestMatch = s;
			}
		}

		if (bestMatch && bestDist < 0.08) {
			consolidated.push({
				shade: target.shade,
				hex: bestMatch.hex,
				L: bestMatch.L,
				role: target.role,
				isOriginal: true,
				originalShade: bestMatch.shade
			});
		}
		// If no close match, skip — don't interpolate, just note the gap
	}

	return consolidated;
}

/* ─── Tint name matching (family-level) ─── */

/**
 * Compute the chroma-weighted circular mean hue from tinted shades.
 * Shades with higher chroma contribute more to the average.
 */
function weightedMeanHue(shades: NeutralShade[]): number | null {
	const tinted = shades.filter((s) => s.isTinted);
	if (tinted.length === 0) return null;

	let sinSum = 0;
	let cosSum = 0;
	let weightSum = 0;

	for (const s of tinted) {
		const w = s.C; // weight by chroma — more saturated shades are more reliable indicators
		const rad = (s.H * Math.PI) / 180;
		sinSum += Math.sin(rad) * w;
		cosSum += Math.cos(rad) * w;
		weightSum += w;
	}

	if (weightSum === 0) return null;

	let avgHue = (Math.atan2(sinSum / weightSum, cosSum / weightSum) * 180) / Math.PI;
	if (avgHue < 0) avgHue += 360;
	return avgHue;
}

function findNeutralNames(shades: NeutralShade[]): {
	matches: NeutralNameMatch[];
	avgHue: number | null;
	avgChroma: number;
} {
	const tinted = shades.filter((s) => s.isTinted);
	const avgChroma = tinted.length > 0
		? tinted.reduce((sum, s) => sum + s.C, 0) / tinted.length
		: 0;
	const avgHue = weightedMeanHue(shades);

	// If essentially pure neutral (no tinted shades or extremely low avg chroma)
	const isPureNeutral = avgHue === null || avgChroma < 0.003;

	const matches: NeutralNameMatch[] = [];

	if (isPureNeutral) {
		// Match to achromatic references from each system
		for (const ref of REF_NEUTRALS) {
			if (ref.isAchromatic) {
				matches.push({
					source: ref.source,
					name: ref.name,
					tint: ref.tint,
					hueDelta: 0,
					isAchromatic: true
				});
			}
		}
	} else {
		// For each system, find the best chromatic match + include achromatic option
		const systems = ['Tailwind', 'Radix', 'Spectrum'] as const;

		for (const sys of systems) {
			const sysNeutrals = REF_NEUTRALS.filter((r) => r.source === sys);
			const chromatic = sysNeutrals.filter((r) => !r.isAchromatic);
			const achromatic = sysNeutrals.find((r) => r.isAchromatic);

			if (chromatic.length > 0) {
				// Find closest hue match
				let bestRef = chromatic[0];
				let bestDelta = hueDistance(avgHue!, chromatic[0].hue);

				for (let i = 1; i < chromatic.length; i++) {
					const d = hueDistance(avgHue!, chromatic[i].hue);
					if (d < bestDelta) {
						bestDelta = d;
						bestRef = chromatic[i];
					}
				}

				matches.push({
					source: sys,
					name: bestRef.name,
					tint: bestRef.tint,
					hueDelta: Math.round(bestDelta),
					isAchromatic: false
				});
			} else if (achromatic) {
				// System only has one neutral (Spectrum)
				matches.push({
					source: sys,
					name: achromatic.name,
					tint: achromatic.tint,
					hueDelta: 0,
					isAchromatic: true
				});
			}
		}
	}

	return { matches, avgHue, avgChroma };
}

/* ─── Public API ─── */

export function analyseNeutrals(family: AchromaticFamily): NeutralAnalysis {
	// Compute properties for each shade
	const shades = Object.entries(family.shades)
		.map(([k, hex]) => computeShade(Number(k), hex))
		.sort((a, b) => b.L - a.L); // light → dark

	const proximityClusters = findProximityClusters(shades);
	const distributionScore = computeDistributionScore(shades);
	const consolidated = buildConsolidation(shades);
	const { matches: tintMatches, avgHue: avgTintHue, avgChroma: avgTintChroma } = findNeutralNames(shades);

	// Check tint consistency: do all tinted shades match to the same TW neutral?
	const tintedShades = shades.filter((s) => s.isTinted);
	const twNames = new Set(tintedShades.flatMap((s) => s.tintMatches.filter((m) => m.source === 'Tailwind').map((m) => m.name)));
	const tintConsistent = twNames.size <= 1;

	const clusteredShadeNumbers = new Set(proximityClusters.flatMap((c) => c.shades));

	return {
		familyName: family.name,
		isAlpha: !!family.isAlpha,
		shades,
		proximityClusters,
		distributionScore,
		consolidated,
		tintMatches,
		avgTintHue,
		avgTintChroma: avgTintChroma,
		tintConsistent,
		stats: {
			totalShades: shades.length,
			consolidatedCount: consolidated.length,
			tintedCount: shades.filter((s) => s.isTinted).length,
			clusteredCount: clusteredShadeNumbers.size
		}
	};
}
