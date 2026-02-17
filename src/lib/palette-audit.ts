/**
 * Palette Audit Engine — comprehensive analysis of an uploaded colour palette.
 *
 * Analyses:
 * 1. Chroma normalization — are all families perceptually equal in strength?
 * 2. Hue collisions — are any families too close in hue to distinguish?
 * 3. 300-shade optimization — do any anchors need L or C adjustments?
 * 4. Gap suggestions — what colours should be added? (delegates to gap-analysis.ts)
 */

import type { OklchColor } from './colour';
import {
	hexToRgb,
	rgbToOklch,
	rgbToHex,
	oklchToRgb,
	maxChromaAtLH,
	clampChromaToGamut
} from './colour';
import { TARGET_CURVE, ACHROMATIC_THRESHOLD } from './constants';
import type { ParsedFamily } from './parse-tokens';
import { familiesToHueDots } from './parse-tokens';
import { analyseHueGaps, suggestionsToHueDots } from './gap-analysis';
import type { GapSuggestion } from './gap-analysis';
import type { HueDot } from './components/HueWheel.svelte';

// ── Interfaces ──────────────────────────────────────────────────────

export interface ChromaAnalysis {
	family: string;
	hex300: string;
	oklch: OklchColor;
	maxChroma: number;
	relativeChroma: number;
	targetRelChroma: number;
	suggestedC: number;
	suggestedHex300: string;
	/** Signed deviation from target: positive = oversaturated, negative = undersaturated */
	deviation: number;
	/** Whether this family is flagged for chroma adjustment (|deviation| > threshold) */
	flagged: boolean;
}

export interface ProximityWarning {
	familyA: string;
	familyB: string;
	hueA: number;
	hueB: number;
	hueDelta: number;
	severity: 'critical' | 'warning';
	suggestion: string;
}

export interface Shade300Tweak {
	family: string;
	currentHex: string;
	suggestedHex: string;
	currentOklch: OklchColor;
	suggestedOklch: OklchColor;
	reasons: string[];
	/** Approximate perceptual distance (Oklch Euclidean in L,C space) */
	deltaE: number;
}

export type FindingSeverity = 'info' | 'warning' | 'critical';

export interface AuditFinding {
	type: 'proximity' | 'chroma-imbalance' | 'hue-gap' | 'shade300-tweak';
	severity: FindingSeverity;
	family?: string;
	message: string;
}

export interface PaletteAudit {
	score: number;
	familyCount: number;
	chromaAnalysis: ChromaAnalysis[];
	proximityWarnings: ProximityWarning[];
	shade300Tweaks: Shade300Tweak[];
	gapSuggestions: GapSuggestion[];
	findings: AuditFinding[];
	/** All dots for the hue wheel (uploaded + suggestions) */
	wheelDots: HueDot[];
}

// ── Thresholds ──────────────────────────────────────────────────────

const PROXIMITY_CRITICAL = 5;   // degrees — effectively identical hues
const PROXIMITY_WARNING = 10;   // degrees — genuinely close; Tailwind has pairs at 7-9°
const CHROMA_DEVIATION_THRESHOLD = 0.05; // 5% relative chroma

// ── Helpers ─────────────────────────────────────────────────────────

function hueDelta(a: number, b: number): number {
	const d = Math.abs(a - b) % 360;
	return d > 180 ? 360 - d : d;
}

function median(values: number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0
		? (sorted[mid - 1] + sorted[mid]) / 2
		: sorted[mid];
}

/** Approximate perceptual distance in Oklch (L,C components only). */
function deltaE(a: OklchColor, b: OklchColor): number {
	return Math.sqrt((a.L - b.L) ** 2 + (a.C - b.C) ** 2);
}

interface FamilyOklch {
	name: string;
	hex300: string;
	oklch: OklchColor;
}

function extractFamilyOklch(families: ParsedFamily[]): FamilyOklch[] {
	const results: FamilyOklch[] = [];
	for (const fam of families) {
		const hex = fam.shades[300];
		if (!hex) continue;
		const { r, g, b } = hexToRgb(hex);
		const oklch = rgbToOklch(r, g, b);
		if (oklch.C < ACHROMATIC_THRESHOLD) continue; // skip achromatic
		results.push({ name: fam.name, hex300: hex, oklch });
	}
	return results;
}

// ── Analysis passes ─────────────────────────────────────────────────

export function analyseChroma(families: FamilyOklch[]): ChromaAnalysis[] {
	if (families.length === 0) return [];

	const analyses: ChromaAnalysis[] = families.map((fam) => {
		const maxC = maxChromaAtLH(fam.oklch.L, fam.oklch.H);
		const relC = maxC > 0 ? fam.oklch.C / maxC : 0;
		return {
			family: fam.name,
			hex300: fam.hex300,
			oklch: fam.oklch,
			maxChroma: maxC,
			relativeChroma: relC,
			targetRelChroma: 0, // filled below
			suggestedC: 0,
			suggestedHex300: fam.hex300,
			deviation: 0,
			flagged: false
		};
	});

	const target = median(analyses.map((a) => a.relativeChroma));

	for (const a of analyses) {
		a.targetRelChroma = target;
		a.deviation = a.relativeChroma - target;
		a.flagged = Math.abs(a.deviation) > CHROMA_DEVIATION_THRESHOLD;

		if (a.flagged) {
			const newC = clampChromaToGamut(a.oklch.L, target * a.maxChroma, a.oklch.H);
			a.suggestedC = newC;
			const rgb = oklchToRgb(a.oklch.L, newC, a.oklch.H);
			a.suggestedHex300 = rgbToHex(rgb.r, rgb.g, rgb.b);
		} else {
			a.suggestedC = a.oklch.C;
			a.suggestedHex300 = a.hex300;
		}
	}

	return analyses;
}

export function analyseProximity(families: FamilyOklch[]): ProximityWarning[] {
	if (families.length < 2) return [];

	const sorted = [...families].sort((a, b) => a.oklch.H - b.oklch.H);
	const warnings: ProximityWarning[] = [];

	for (let i = 0; i < sorted.length; i++) {
		const a = sorted[i];
		const b = sorted[(i + 1) % sorted.length];
		const delta = hueDelta(a.oklch.H, b.oklch.H);

		if (delta < PROXIMITY_CRITICAL) {
			warnings.push({
				familyA: a.name,
				familyB: b.name,
				hueA: a.oklch.H,
				hueB: b.oklch.H,
				hueDelta: delta,
				severity: 'critical',
				suggestion: `${a.name} and ${b.name} are only ${delta.toFixed(1)}° apart — they will be nearly indistinguishable in UI. Consider merging them into one family or repositioning one to a different hue.`
			});
		} else if (delta < PROXIMITY_WARNING) {
			warnings.push({
				familyA: a.name,
				familyB: b.name,
				hueA: a.oklch.H,
				hueB: b.oklch.H,
				hueDelta: delta,
				severity: 'warning',
				suggestion: `${a.name} and ${b.name} are ${delta.toFixed(1)}° apart — they may look similar at lighter tints (50/100 shades). Consider whether both are needed.`
			});
		}
	}

	return warnings;
}

export function computeShade300Tweaks(
	families: FamilyOklch[],
	chromaResults: ChromaAnalysis[]
): Shade300Tweak[] {
	const tweaks: Shade300Tweak[] = [];
	const chromaMap = new Map(chromaResults.map((c) => [c.family, c]));

	for (const fam of families) {
		const reasons: string[] = [];
		let newL = fam.oklch.L;
		let newC = fam.oklch.C;
		const H = fam.oklch.H;

		// Flag lightness only when significantly off the APCA-optimised target.
		// A tolerance of 0.06 (~6% Oklch L) keeps the audit from flagging
		// minor deviations that don't meaningfully affect contrast or perception.
		// Only families far enough from the optimal L to impact APCA compliance
		// get a normalisation suggestion.
		const optimalL = TARGET_CURVE[300].L;
		const lDelta = Math.abs(fam.oklch.L - optimalL);
		if (lDelta > 0.06) {
			newL = optimalL;
			reasons.push(`Lightness ${fam.oklch.L.toFixed(3)} is ${lDelta > 0.10 ? 'significantly ' : ''}off the optimal L* ${optimalL.toFixed(3)} — normalised for APCA compliance`);
		}

		// Check chroma normalization
		const chroma = chromaMap.get(fam.name);
		if (chroma?.flagged) {
			newC = chroma.suggestedC;
			const direction = chroma.deviation > 0 ? 'oversaturated' : 'undersaturated';
			reasons.push(`Chroma is ${Math.abs(chroma.deviation * 100).toFixed(1)}% ${direction} relative to palette median — adjusted for perceptual balance`);
		}

		// If lightness changed, re-clamp chroma at new L
		if (newL !== fam.oklch.L) {
			newC = clampChromaToGamut(newL, newC, H);
		}

		if (reasons.length === 0) continue;

		const clamped = clampChromaToGamut(newL, newC, H);
		const rgb = oklchToRgb(newL, clamped, H);
		const suggestedHex = rgbToHex(rgb.r, rgb.g, rgb.b);

		const suggestedOklch: OklchColor = { L: newL, C: clamped, H };
		const de = deltaE(fam.oklch, suggestedOklch);

		tweaks.push({
			family: fam.name,
			currentHex: fam.hex300,
			suggestedHex,
			currentOklch: fam.oklch,
			suggestedOklch,
			reasons,
			deltaE: de
		});
	}

	return tweaks;
}

// ── Scoring ─────────────────────────────────────────────────────────

function computeScore(
	proximity: ProximityWarning[],
	chromaResults: ChromaAnalysis[],
	tweaks: Shade300Tweak[],
	gapSuggestions: GapSuggestion[],
	familyCount: number
): number {
	let score = 100;

	for (const pw of proximity) {
		score -= pw.severity === 'critical' ? 15 : 5;
	}

	for (const ca of chromaResults) {
		if (Math.abs(ca.deviation) > 0.10) score -= 3;
	}

	for (const t of tweaks) {
		if (t.reasons.some((r) => r.includes('Lightness'))) score -= 5;
	}

	// Gap penalty: proportional to largest gaps
	for (const gs of gapSuggestions) {
		if (gs.gapSize > 50) score -= 3;
		else if (gs.gapSize > 35) score -= 1;
	}

	// Bonus for having a good number of families (16-20 is ideal)
	if (familyCount >= 16 && familyCount <= 20) score += 5;
	else if (familyCount < 12) score -= 5;

	return Math.max(0, Math.min(100, score));
}

// ── Main entry point ────────────────────────────────────────────────

export function runPaletteAudit(families: ParsedFamily[]): PaletteAudit {
	const familyOklch = extractFamilyOklch(families);
	const uploadedDots = familiesToHueDots(families);

	// Analysis passes
	const chromaAnalysis = analyseChroma(familyOklch);
	const proximityWarnings = analyseProximity(familyOklch);
	const shade300Tweaks = computeShade300Tweaks(familyOklch, chromaAnalysis);
	const gapSuggestions = analyseHueGaps(uploadedDots);

	// Build findings (prioritised)
	const findings: AuditFinding[] = [];

	for (const pw of proximityWarnings) {
		findings.push({
			type: 'proximity',
			severity: pw.severity,
			message: pw.suggestion
		});
	}

	for (const ca of chromaAnalysis) {
		if (ca.flagged) {
			const direction = ca.deviation > 0 ? 'oversaturated' : 'undersaturated';
			findings.push({
				type: 'chroma-imbalance',
				severity: Math.abs(ca.deviation) > 0.10 ? 'warning' : 'info',
				family: ca.family,
				message: `${ca.family} is ${Math.abs(ca.deviation * 100).toFixed(1)}% ${direction} relative to palette median — it may appear ${ca.deviation > 0 ? 'more vivid' : 'more muted'} than its peers`
			});
		}
	}

	for (const tweak of shade300Tweaks) {
		findings.push({
			type: 'shade300-tweak',
			severity: tweak.reasons.some((r) => r.includes('Lightness')) ? 'warning' : 'info',
			family: tweak.family,
			message: `${tweak.family} 300 shade (${tweak.currentHex}) → suggested ${tweak.suggestedHex}: ${tweak.reasons.join('; ')}`
		});
	}

	for (const gs of gapSuggestions) {
		findings.push({
			type: 'hue-gap',
			severity: gs.gapSize > 50 ? 'warning' : 'info',
			message: `${gs.gapSize.toFixed(0)}° gap between ${gs.between[0]} and ${gs.between[1]} — consider adding ${gs.name} (${gs.source})`
		});
	}

	// Sort: critical first, then warning, then info
	const severityOrder: Record<FindingSeverity, number> = { critical: 0, warning: 1, info: 2 };
	findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

	// Hue wheel dots
	const suggestionDots = suggestionsToHueDots(gapSuggestions);
	const wheelDots: HueDot[] = [...uploadedDots, ...suggestionDots];

	// Score
	const score = computeScore(
		proximityWarnings,
		chromaAnalysis,
		shade300Tweaks,
		gapSuggestions,
		familyOklch.length
	);

	return {
		score,
		familyCount: familyOklch.length,
		chromaAnalysis,
		proximityWarnings,
		shade300Tweaks,
		gapSuggestions,
		findings,
		wheelDots
	};
}
