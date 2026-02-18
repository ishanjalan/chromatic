import {
	hexToRgb,
	rgbToOklch,
	oklchToRgb,
	rgbToHex,
	relativeLuminance,
	contrastRatio,
	bestTextColor,
	apcaContrast,
	alphaComposite,
	clampChromaToGamut,
	maxChromaAtLH
} from './colour';
import {
	TARGET_CURVE,
	SHADE_LEVELS,
	ACHROMATIC_THRESHOLD,
	SHADE_ROLES,
	TEXT_LEVELS_GREY750,
	TEXT_LEVELS_GREY50,
	SHADE_ACTIVE_TEXT,
	SHADE_TEXT_SEMANTIC,
	HK_COEFF,
	CHROMA_CAP
} from './constants';
import type { ShadeLevel, TextLevel } from './constants';

// ── Text-Level Contrast Result ──────────────────────────────────────

export interface TextLevelContrast {
	label: string;
	effectiveHex: string;
	wcagRatio: number;
	wcagLevel: 'aaa' | 'aa' | 'aa-large' | 'fail';
	apcaLc: number;
	apcaLevel: 'excellent' | 'good' | 'min' | 'poor';
}

function wcagLevel(ratio: number): 'aaa' | 'aa' | 'aa-large' | 'fail' {
	if (ratio >= 7.0) return 'aaa';
	if (ratio >= 4.5) return 'aa';
	if (ratio >= 3.0) return 'aa-large';
	return 'fail';
}

function apcaLevel(lc: number): 'excellent' | 'good' | 'min' | 'poor' {
	const abs = Math.abs(lc);
	if (abs >= 75) return 'excellent';
	if (abs >= 60) return 'good';
	if (abs >= 45) return 'min';
	return 'poor';
}

/**
 * Compute WCAG + APCA contrast for a text level against a background shade.
 * For alpha text, composites the text colour over the background first.
 */
function computeTextLevelContrast(
	textLevel: TextLevel,
	bgR: number, bgG: number, bgB: number, bgLum: number
): TextLevelContrast {
	const eff = alphaComposite(textLevel.r, textLevel.g, textLevel.b, textLevel.alpha, bgR, bgG, bgB);
	const effLum = relativeLuminance(eff.r, eff.g, eff.b);
	const ratio = contrastRatio(bgLum, effLum);
	const lc = apcaContrast(eff.r, eff.g, eff.b, bgR, bgG, bgB);

	const effHex =
		'#' +
		[eff.r, eff.g, eff.b]
			.map((c) => Math.round(Math.max(0, Math.min(255, c * 255))).toString(16).padStart(2, '0'))
			.join('')
			.toUpperCase();

	return {
		label: textLevel.label,
		effectiveHex: effHex,
		wcagRatio: ratio,
		wcagLevel: wcagLevel(ratio),
		apcaLc: lc,
		apcaLevel: apcaLevel(lc)
	};
}

// ── Shade Info ──────────────────────────────────────────────────────

export interface TextLevelGroup {
	token: string;
	levels: TextLevelContrast[];
	isActive: boolean;
	semantic: string;
}

export interface ShadeInfo {
	shade: ShadeLevel;
	hex: string;
	oklch: { L: number; C: number; H: number };
	rgb: { r: number; g: number; b: number };
	contrastOnWhite: number;
	contrastOnBlack: number;
	apcaOnWhite: number;
	apcaOnBlack: number;
	textGroups: TextLevelGroup[];
	modeContext: 'light' | 'dark';
	modeLabel: string;
	cardTextColor: 'white' | 'dark';
	isAnchor: boolean;
	wasLAdjusted: boolean;
	originalL: number;
	wasGamutReduced: boolean;
	originalC: number;
	finalC: number;
	gamutHeadroom: number;
}

export interface ScaleResult {
	name: string;
	shades: ShadeInfo[];
	inputHex: string;
	hue: number;
	/** True when the input hex is achromatic (near-zero chroma) */
	isAchromatic: boolean;
}

export function generateScale(hexInput: string, name = 'Custom'): ScaleResult {
	const { r, g, b } = hexToRgb(hexInput);
	const { L: L_in, C: C_in, H } = rgbToOklch(r, g, b);

	// Detect achromatic (grey/neutral) inputs — force chroma to 0 for all
	// shades to produce a pure grey ramp instead of tinting at the phantom hue.
	const isAchromatic = C_in < ACHROMATIC_THRESHOLD;

	const shades = SHADE_LEVELS.map((shade) => {
		const { L: tL, relC } = TARGET_CURVE[shade];

		let targetC: number;
		if (isAchromatic) {
			targetC = 0;
		} else if (shade === 300) {
			targetC = C_in;
		} else {
			targetC = relC * maxChromaAtLH(tL, H);
			const cap = CHROMA_CAP[shade];
			if (cap !== undefined && targetC > cap) {
				targetC = cap;
			}
		}

		let finalC = clampChromaToGamut(tL, targetC, H);
		const wasGamutReduced = Math.abs(targetC - finalC) > 0.001;

		// Helmholtz-Kohlrausch compensation: reduce effective lightness
		// proportionally to chroma so saturated shades don't appear
		// brighter than their achromatic equivalent.
		const targetL = (isAchromatic || shade === 300) ? tL : tL - HK_COEFF * finalC;

		// Re-clamp chroma at the H-K adjusted lightness (safety net)
		finalC = clampChromaToGamut(targetL, finalC, H);

		const { r, g, b } = oklchToRgb(targetL, finalC, H);
		const hex = rgbToHex(r, g, b);
		const lum = relativeLuminance(r, g, b);

		const maxC = maxChromaAtLH(targetL, H);
		const gamutHeadroom = maxC > 0 ? Math.min(1, finalC / maxC) : 1;

		const contrastOnWhite = contrastRatio(lum, 1.0);
		const contrastOnBlack = contrastRatio(lum, 0.0);

		const apcaOnWhite = apcaContrast(r, g, b, 1, 1, 1);
		const apcaOnBlack = apcaContrast(r, g, b, 0, 0, 0);

		const cardTextColor = bestTextColor(r, g, b);

		const role = SHADE_ROLES[shade];
		const modeContext: 'light' | 'dark' = role.light ? 'light' : 'dark';
		const modeLabel = role.light ? `Light ${role.light}` : `Dark ${role.dark}`;

		const grey750Levels = TEXT_LEVELS_GREY750.map((tl) => computeTextLevelContrast(tl, r, g, b, lum));
		const grey50Levels = TEXT_LEVELS_GREY50.map((tl) => computeTextLevelContrast(tl, r, g, b, lum));

		const activeToken = SHADE_ACTIVE_TEXT[shade];
		const semantic = SHADE_TEXT_SEMANTIC[shade];

		const textGroups: TextLevelGroup[] = [
			{ token: 'Grey 750', levels: grey750Levels, isActive: activeToken === 'grey750', semantic },
			{ token: 'Grey 50', levels: grey50Levels, isActive: activeToken === 'grey50', semantic }
		];

		return {
			shade,
			hex,
			oklch: { L: targetL, C: finalC, H: H },
			rgb: { r, g, b },
			contrastOnWhite,
			contrastOnBlack,
			apcaOnWhite,
			apcaOnBlack,
			textGroups,
			modeContext,
			modeLabel,
			cardTextColor,
			isAnchor: shade === 300,
			wasLAdjusted: shade === 300 && Math.abs(L_in - tL) > 0.01,
			originalL: L_in,
			wasGamutReduced,
			originalC: targetC,
			finalC,
			gamutHeadroom
		} satisfies ShadeInfo;
	});

	return { name, shades, inputHex: hexInput, hue: H, isAchromatic };
}

// ── WCAG Badge (legacy, for overall card badge) ─────────────────────

export interface WcagBadge {
	label: string;
	background: 'white' | 'black' | null;
	level: 'aaa' | 'aa' | 'aa-large' | 'fail';
}

export function wcagBadge(onWhite: number, onBlack: number): WcagBadge {
	if (onWhite >= 7.0) return { label: 'AAA', background: 'white', level: 'aaa' };
	if (onBlack >= 7.0) return { label: 'AAA', background: 'black', level: 'aaa' };
	if (onWhite >= 4.5) return { label: 'AA', background: 'white', level: 'aa' };
	if (onBlack >= 4.5) return { label: 'AA', background: 'black', level: 'aa' };
	if (onWhite >= 3.0) return { label: 'AA Large', background: 'white', level: 'aa-large' };
	if (onBlack >= 3.0) return { label: 'AA Large', background: 'black', level: 'aa-large' };
	return { label: 'Fails', background: null, level: 'fail' };
}

// ── JSON Token Export ───────────────────────────────────────────────

export function toJsonTokens(scale: ScaleResult): object {
	const familyTokens: Record<string, object> = {};

	for (const shade of scale.shades) {
		familyTokens[String(shade.shade)] = {
			$type: 'color',
			$value: {
				colorSpace: 'srgb',
				components: [shade.rgb.r, shade.rgb.g, shade.rgb.b],
				alpha: 1,
				hex: shade.hex
			},
			$extensions: {
				'com.figma.hiddenFromPublishing': true,
				'com.figma.scopes': ['ALL_FILLS']
			}
		};
	}

	return {
		Colour: {
			[scale.name]: familyTokens
		}
	};
}

export function toJsonTokensMultiple(scales: ScaleResult[]): object {
	const families: Record<string, object> = {};

	for (const scale of scales) {
		const familyTokens: Record<string, object> = {};
		for (const shade of scale.shades) {
			familyTokens[String(shade.shade)] = {
				$type: 'color',
				$value: {
					colorSpace: 'srgb',
					components: [shade.rgb.r, shade.rgb.g, shade.rgb.b],
					alpha: 1,
					hex: shade.hex
				},
				$extensions: {
					'com.figma.hiddenFromPublishing': true,
					'com.figma.scopes': ['ALL_FILLS']
				}
			};
		}
		families[scale.name] = familyTokens;
	}

	return { Colour: families };
}
