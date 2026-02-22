/**
 * Diagnostic JSON export — produces a comprehensive snapshot of all
 * generated scales, APCA scores, chroma analysis, hue drift, and
 * reference system comparisons for programmatic analysis.
 */

import { generateScale } from './scale';
import type { ScaleResult, ShadeInfo } from './scale';
import type { PaletteAudit } from './palette-audit';
import type { ParsedFamily } from './parse-tokens';
import { hexToRgb, rgbToOklch, apcaContrast, hueDelta, maxChromaAtLH, effectiveMaxChroma, isValidHex } from './colour';
import { TARGET_CURVE, SHADE_LEVELS, REFERENCE_HUE, CUSP_DAMPING_BASE, CUSP_DAMPING_COEFF, DAMPING_CEILING_L, DAMPING_CEILING_VALUE, BASE_RELC, RELC_STEP, ACHROMATIC_THRESHOLD } from './constants';
import { TAILWIND_PALETTE } from './tailwind-palette';
import { RADIX_PALETTE } from './radix-palette';
import { SPECTRUM_PALETTE } from './spectrum-palette';

const CHROMA_BAND_LOW = 0.7;
const CHROMA_BAND_HIGH = 1.3;
function inChromaBand(ratio: number): boolean {
	return ratio >= CHROMA_BAND_LOW && ratio <= CHROMA_BAND_HIGH;
}

interface RefShade { L: number; C: number; H: number; family: string; shade: string; }

function collectRefs(
	palette: Array<{ name: string; shades: Record<string, { L: number; C: number; H: number }> }>
): RefShade[] {
	const out: RefShade[] = [];
	for (const fam of palette) {
		for (const [step, oklch] of Object.entries(fam.shades)) {
			out.push({ ...oklch, family: fam.name, shade: step });
		}
	}
	return out;
}

function findClosest(targetL: number, targetH: number, refs: RefShade[]): RefShade | null {
	let best: RefShade | null = null;
	let bestDist = Infinity;
	for (const ref of refs) {
		if (hueDelta(ref.H, targetH) > 35) continue;
		const dist = Math.abs(ref.L - targetL);
		if (dist < bestDist) { bestDist = dist; best = ref; }
	}
	return best;
}

const twRefs = collectRefs(TAILWIND_PALETTE);
const rxRefs = collectRefs(RADIX_PALETTE);
const spRefs = collectRefs(SPECTRUM_PALETTE);

const G50 = { r: 1.0, g: 1.0, b: 1.0 };
const G750 = { r: 0.114, g: 0.114, b: 0.114 };

interface ShadeExport {
	shade: number;
	hex: string;
	oklch: { L: number; C: number; H: number };
	targetL: number;
	targetRelC: number;
	actualRelC: number;
	effectiveMaxC: number;
	rawMaxC: number;
	gamutHeadroom: number;
	wasGamutReduced: boolean;
	apcaLc: number;
	apcaTarget: number;
	apcaPass: boolean;
	apcaStatus: string;
	hueDriftFromAnchor: number;
	referenceComparisons: {
		system: string;
		closestFamily: string;
		closestShade: string;
		closestC: number;
		chromaRatio: number;
		inBand: boolean;
	}[];
}

interface FamilyExport {
	name: string;
	inputHex: string;
	inputOklch: { L: number; C: number; H: number };
	isAchromatic: boolean;
	shades: ShadeExport[];
}

interface DiagnosticExport {
	version: string;
	exportedAt: string;
	engine: {
		baseRelC: number;
		relcStep: number;
		referenceHue: number;
		cuspDampingBase: number;
		cuspDampingCoeff: number;
		dampingCeilingL: number;
		dampingCeilingValue: number;
		targetCurve: Record<number, { L: number; relC: number }>;
	};
	families: FamilyExport[];
	summary: {
		totalShades: number;
		apcaFailures: number;
		hueDriftWarnings: number;
		chromaBandAnalysis: {
			shade: number;
			totalComparisons: number;
			inBand: number;
			percentage: number;
			avgRatio: number;
			minRatio: number;
			maxRatio: number;
		}[];
		overallInBand: { count: number; total: number; percentage: number };
		perSystem: { system: string; inBand: number; total: number; percentage: number }[];
	};
	audit: {
		score: number;
		scoreBreakdown: PaletteAudit['scoreBreakdown'];
		familyCount: number;
		proximityWarnings: number;
		chromaFlagged: number;
		shade300Tweaks: number;
		gapSuggestions: number;
	} | null;
}

export function buildDiagnosticExport(
	parsedFamilies: ParsedFamily[],
	audit: PaletteAudit | null
): DiagnosticExport {
	const families: FamilyExport[] = [];
	const allRatios: { shade: number; system: string; ratio: number }[] = [];
	let apcaFailures = 0;
	let hueDriftWarnings = 0;

	// Generate scales from parsed families' 300 shade hex
	const scales: ScaleResult[] = [];
	for (const fam of parsedFamilies) {
		const hex300 = fam.shades[300];
		if (!hex300 || !isValidHex(hex300)) continue;
		const { r, g, b } = hexToRgb(hex300);
		const { C } = rgbToOklch(r, g, b);
		if (C < ACHROMATIC_THRESHOLD) continue;
		scales.push(generateScale(hex300, fam.name));
	}

	for (const scale of scales) {
		const { r, g, b } = hexToRgb(scale.inputHex);
		const inputOklch = rgbToOklch(r, g, b);

		const shadeExports: ShadeExport[] = scale.shades.map((sh: ShadeInfo) => {
			const shRgb = hexToRgb(sh.hex);
			const isLight = sh.shade <= 200;
			const text = isLight ? G750 : G50;
			const lc = Math.abs(apcaContrast(text.r, text.g, text.b, shRgb.r, shRgb.g, shRgb.b));
			const apcaTarget = sh.shade === 200 ? 60 : 75;
			const apcaPass = lc >= apcaTarget - 1;
			if (!apcaPass) apcaFailures++;

			const hDrift = hueDelta(sh.oklch.H, inputOklch.H);
			if (hDrift > 15) hueDriftWarnings++;

			const effMaxC = effectiveMaxChroma(
				sh.oklch.L, sh.oklch.H, REFERENCE_HUE,
				CUSP_DAMPING_BASE, CUSP_DAMPING_COEFF,
				DAMPING_CEILING_L, DAMPING_CEILING_VALUE
			);
			const rawMaxC = maxChromaAtLH(sh.oklch.L, sh.oklch.H);
			const actualRelC = effMaxC > 0 ? sh.oklch.C / effMaxC : 0;

			const refComparisons: ShadeExport['referenceComparisons'] = [];
			for (const [sysName, refs] of [['Tailwind', twRefs], ['Radix', rxRefs], ['Spectrum', spRefs]] as const) {
				const closest = findClosest(sh.oklch.L, inputOklch.H, refs as RefShade[]);
				if (closest && closest.C > 0.005) {
					const ratio = sh.oklch.C / closest.C;
					allRatios.push({ shade: sh.shade, system: sysName, ratio });
					refComparisons.push({
						system: sysName,
						closestFamily: closest.family,
						closestShade: closest.shade,
						closestC: closest.C,
						chromaRatio: Math.round(ratio * 1000) / 1000,
						inBand: inChromaBand(ratio),
					});
				}
			}

			let apcaStatus: string;
			if (lc >= 75) apcaStatus = 'excellent';
			else if (lc >= 60) apcaStatus = 'good';
			else if (lc >= 45) apcaStatus = 'marginal';
			else apcaStatus = 'fail';

			return {
				shade: sh.shade,
				hex: sh.hex,
				oklch: { L: round(sh.oklch.L), C: round(sh.oklch.C, 4), H: round(sh.oklch.H, 1) },
				targetL: round(TARGET_CURVE[sh.shade].L),
				targetRelC: round(TARGET_CURVE[sh.shade].relC),
				actualRelC: round(actualRelC),
				effectiveMaxC: round(effMaxC, 4),
				rawMaxC: round(rawMaxC, 4),
				gamutHeadroom: round(sh.gamutHeadroom),
				wasGamutReduced: sh.wasGamutReduced,
				apcaLc: round(lc, 0),
				apcaTarget,
				apcaPass,
				apcaStatus,
				hueDriftFromAnchor: round(hDrift, 1),
				referenceComparisons: refComparisons,
			};
		});

		families.push({
			name: scale.name,
			inputHex: scale.inputHex,
			inputOklch: { L: round(inputOklch.L), C: round(inputOklch.C, 4), H: round(inputOklch.H, 1) },
			isAchromatic: scale.isAchromatic,
			shades: shadeExports,
		});
	}

	const bandAnalysis = SHADE_LEVELS.map(shade => {
		const sr = allRatios.filter(r => r.shade === shade);
		const inBand = sr.filter(r => inChromaBand(r.ratio));
		return {
			shade,
			totalComparisons: sr.length,
			inBand: inBand.length,
			percentage: sr.length > 0 ? round(inBand.length / sr.length * 100, 0) : 0,
			avgRatio: sr.length > 0 ? round(sr.reduce((s, r) => s + r.ratio, 0) / sr.length) : 0,
			minRatio: sr.length > 0 ? round(Math.min(...sr.map(r => r.ratio))) : 0,
			maxRatio: sr.length > 0 ? round(Math.max(...sr.map(r => r.ratio))) : 0,
		};
	});

	const totalIn = allRatios.filter(r => inChromaBand(r.ratio));
	const perSystem = ['Tailwind', 'Radix', 'Spectrum'].map(sys => {
		const sr = allRatios.filter(r => r.system === sys);
		const inBand = sr.filter(r => inChromaBand(r.ratio));
		return {
			system: sys,
			inBand: inBand.length,
			total: sr.length,
			percentage: sr.length > 0 ? round(inBand.length / sr.length * 100, 0) : 0,
		};
	});

	const tc: Record<number, { L: number; relC: number }> = {};
	for (const s of SHADE_LEVELS) {
		tc[s] = { L: round(TARGET_CURVE[s].L), relC: round(TARGET_CURVE[s].relC) };
	}

	return {
		version: '1.1',
		exportedAt: new Date().toISOString(),
		engine: {
			baseRelC: BASE_RELC,
			relcStep: RELC_STEP,
			referenceHue: REFERENCE_HUE,
			cuspDampingBase: CUSP_DAMPING_BASE,
			cuspDampingCoeff: CUSP_DAMPING_COEFF,
			dampingCeilingL: DAMPING_CEILING_L,
			dampingCeilingValue: DAMPING_CEILING_VALUE,
			targetCurve: tc,
		},
		families,
		summary: {
			totalShades: families.reduce((s, f) => s + f.shades.length, 0),
			apcaFailures,
			hueDriftWarnings,
			chromaBandAnalysis: bandAnalysis,
			overallInBand: {
				count: totalIn.length,
				total: allRatios.length,
				percentage: allRatios.length > 0 ? round(totalIn.length / allRatios.length * 100, 1) : 0,
			},
			perSystem,
		},
		audit: audit ? {
			score: audit.score,
			scoreBreakdown: audit.scoreBreakdown,
			familyCount: audit.familyCount,
			proximityWarnings: audit.proximityWarnings.length,
			chromaFlagged: audit.chromaAnalysis.filter(c => c.flagged).length,
			shade300Tweaks: audit.shade300Tweaks.length,
			gapSuggestions: audit.gapSuggestions.length,
		} : null,
	};
}

function round(n: number, decimals = 3): number {
	const f = 10 ** decimals;
	return Math.round(n * f) / f;
}

export function downloadDiagnosticJson(
	parsedFamilies: ParsedFamily[],
	audit: PaletteAudit | null
): void {
	const data = buildDiagnosticExport(parsedFamilies, audit);
	const json = JSON.stringify(data, null, 2);
	const blob = new Blob([json], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `chromatic-diagnostic-${new Date().toISOString().slice(0, 10)}.json`;
	a.click();
	URL.revokeObjectURL(url);
}
