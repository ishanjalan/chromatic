/**
 * Parse a Figma-exported Value.tokens.json (or similar) to extract
 * colour families and their shade hex values.
 *
 * Chromatic families use the 6 core shades (50–500).
 * Achromatic/neutral families import ALL numeric shade keys.
 *
 * Handles the standard Figma variable export format:
 *   { Colour: { FamilyName: { "50": { $type: "color", $value: { hex: "..." } }, ... } } }
 *
 * Also handles a flat structure without a "Colour" wrapper:
 *   { FamilyName: { "50": { $type: "color", $value: { hex: "..." } }, ... } }
 */

import { SHADE_LEVELS, ACHROMATIC_THRESHOLD } from './constants';
import type { ShadeLevel } from './constants';
import { hexToRgb, rgbToOklch } from './colour';
import type { HueDot } from './components/HueWheel.svelte';

export interface ParsedFamily {
	name: string;
	shades: Record<number, string>; // shade level → hex
	complete: boolean; // has all 6 core shades
	/** Where this family originated — 'token' for uploaded JSON, 'workspace' for manually added */
	source?: 'token' | 'workspace';
}

export interface AchromaticFamily {
	name: string;
	/** All numeric shade keys → hex, sorted by shade number */
	shades: Record<number, string>;
	/** Number of shades in this family */
	shadeCount: number;
	/** True if this is an alpha/opacity variant family (e.g. Grey Alpha) */
	isAlpha?: boolean;
}

export interface ParseResult {
	families: ParsedFamily[];
	achromaticFamilies: AchromaticFamily[];
	errors: string[];
}

const CORE_SHADES = new Set(SHADE_LEVELS.map(String));

function isColourNode(obj: unknown): obj is { $type: string; $value: { hex: string } } {
	if (typeof obj !== 'object' || obj === null) return false;
	const o = obj as Record<string, unknown>;
	if (o.$type !== 'color') return false;
	if (typeof o.$value !== 'object' || o.$value === null) return false;
	const val = o.$value as Record<string, unknown>;
	return typeof val.hex === 'string' && /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(val.hex);
}

function extractFamily(name: string, obj: Record<string, unknown>): ParsedFamily | null {
	const shades: Record<number, string> = {};
	let found = 0;

	for (const [key, value] of Object.entries(obj)) {
		if (!CORE_SHADES.has(key)) continue;
		if (!isColourNode(value)) continue;
		const val = (value as { $value: { hex: string } }).$value;
		shades[Number(key)] = val.hex.toUpperCase();
		found++;
	}

	if (found === 0) return null;
	return {
		name,
		shades,
		complete: found === SHADE_LEVELS.length
	};
}

/**
 * Extract ALL numeric shade keys from a family object.
 * Used for achromatic/neutral families that have extended ranges (e.g. 0–800).
 */
function extractAllShades(name: string, obj: Record<string, unknown>): AchromaticFamily | null {
	const shades: Record<number, string> = {};
	let found = 0;

	for (const [key, value] of Object.entries(obj)) {
		if (!/^\d+$/.test(key)) continue;
		if (!isColourNode(value)) continue;
		const val = (value as { $value: { hex: string } }).$value;
		shades[Number(key)] = val.hex.toUpperCase();
		found++;
	}

	if (found === 0) return null;
	return { name, shades, shadeCount: found };
}

/**
 * Family-level achromatic detection.
 * If >= 60% of a family's shades have Oklch chroma below threshold,
 * the entire family is classified as neutral. Correctly handles
 * "tinted neutrals" like #27272A that have a slight hue bias.
 */
function isFamilyAchromatic(shades: Record<number, string>): boolean {
	const hexValues = Object.values(shades);
	if (hexValues.length === 0) return false;
	let achromaticCount = 0;
	for (const hex of hexValues) {
		try {
			const { r, g, b } = hexToRgb(hex);
			const { C } = rgbToOklch(r, g, b);
			if (C < ACHROMATIC_THRESHOLD) achromaticCount++;
		} catch { /* skip invalid */ }
	}
	return achromaticCount / hexValues.length >= 0.6;
}

function isFamilyCandidate(obj: unknown): obj is Record<string, unknown> {
	if (typeof obj !== 'object' || obj === null) return false;
	const entries = Object.entries(obj as Record<string, unknown>);
	// Accept families with core shade keys OR any numeric keys
	return entries.some(([key]) => CORE_SHADES.has(key) || /^\d+$/.test(key));
}

export function parseTokenJson(raw: string): ParseResult {
	const errors: string[] = [];
	const families: ParsedFamily[] = [];
	const achromaticFamilies: AchromaticFamily[] = [];

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return { families: [], achromaticFamilies: [], errors: ['Invalid JSON — could not parse the input.'] };
	}

	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		return { families: [], achromaticFamilies: [], errors: ['Expected a JSON object at the top level.'] };
	}

	const root = parsed as Record<string, unknown>;

	// Strategy 1: Look for a "Colour" or "Color" wrapper
	const colourKey = Object.keys(root).find(
		(k) => k.toLowerCase() === 'colour' || k.toLowerCase() === 'color'
	);

	const searchIn = colourKey
		? (root[colourKey] as Record<string, unknown>)
		: root;

	if (typeof searchIn !== 'object' || searchIn === null) {
		return { families: [], achromaticFamilies: [], errors: ['Could not find colour data in the JSON.'] };
	}

	for (const [name, value] of Object.entries(searchIn)) {
		if (!isFamilyCandidate(value)) continue;

		// Skip non-colour families
		if (/special/i.test(name)) continue;

		const isAlphaFamily = /alpha/i.test(name);

		// First, extract all numeric shades to check if achromatic
		const allShades = extractAllShades(name, value as Record<string, unknown>);
		if (!allShades || allShades.shadeCount === 0) continue;

		if (isAlphaFamily || isFamilyAchromatic(allShades.shades)) {
			// Achromatic / alpha family — import with all shade keys
			achromaticFamilies.push({ ...allShades, isAlpha: isAlphaFamily });
		} else {
			// Chromatic family — extract only core shades
			const family = extractFamily(name, value as Record<string, unknown>);
			if (family) {
				families.push(family);
				if (!family.complete) {
					const missing = SHADE_LEVELS.filter((s) => !(s in family.shades));
					errors.push(`${name}: missing shades ${missing.join(', ')}`);
				}
			}
		}

		// Check for nested sub-families (e.g. Grey/Alpha inside Grey)
		const parentObj = value as Record<string, unknown>;
		for (const [subName, subValue] of Object.entries(parentObj)) {
			if (/^\d+$/.test(subName) || subName.startsWith('$')) continue;
			if (typeof subValue !== 'object' || subValue === null) continue;
			if (!isFamilyCandidate(subValue)) continue;

			const composedName = `${name} ${subName}`;
			if (/special/i.test(subName)) continue;

			const isSubAlpha = /alpha/i.test(subName);
			const subShades = extractAllShades(composedName, subValue as Record<string, unknown>);
			if (!subShades || subShades.shadeCount === 0) continue;

			if (isSubAlpha || isFamilyAchromatic(subShades.shades)) {
				achromaticFamilies.push({ ...subShades, isAlpha: isSubAlpha });
			} else {
				const subFamily = extractFamily(composedName, subValue as Record<string, unknown>);
				if (subFamily) {
					families.push(subFamily);
					if (!subFamily.complete) {
						const missing = SHADE_LEVELS.filter((s) => !(s in subFamily.shades));
						errors.push(`${composedName}: missing shades ${missing.join(', ')}`);
					}
				}
			}
		}
	}

	if (families.length === 0 && achromaticFamilies.length === 0) {
		errors.push('No colour families found. Expected format: { Colour: { FamilyName: { "50": { $type: "color", $value: { hex: "..." } }, ... } } }');
	}

	return { families, achromaticFamilies, errors };
}

/**
 * Auto-detect whether a parsed JSON object is a primitives file or a semantic file.
 * Semantic files have `$extensions.com.figma.aliasData` on their colour nodes.
 */
export function detectTokenType(raw: string): 'primitive' | 'semantic' | 'invalid' {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return 'invalid';
	}
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return 'invalid';

	function hasAliasData(obj: unknown): boolean {
		if (typeof obj !== 'object' || obj === null) return false;
		const o = obj as Record<string, unknown>;
		// Check this node
		if (o.$type === 'color' && typeof o.$extensions === 'object' && o.$extensions !== null) {
			const ext = o.$extensions as Record<string, unknown>;
			if (typeof ext['com.figma.aliasData'] === 'object' && ext['com.figma.aliasData'] !== null) {
				return true;
			}
		}
		// Recurse into children (skip $-prefixed keys to avoid deep dives into metadata)
		for (const [key, val] of Object.entries(o)) {
			if (key.startsWith('$')) continue;
			if (hasAliasData(val)) return true;
		}
		return false;
	}

	return hasAliasData(parsed) ? 'semantic' : 'primitive';
}

/**
 * Convert parsed families into HueDot[] for the HueWheel.
 * Uses the 300 shade (the anchor shade) to compute each family's Oklch hue.
 * Falls back to 200, 100, 50 if 300 is missing.
 */
export function familiesToHueDots(families: ParsedFamily[]): HueDot[] {
	const dots: HueDot[] = [];
	for (const fam of families) {
		const hex = fam.shades[300] ?? fam.shades[200] ?? fam.shades[100] ?? fam.shades[50];
		if (!hex) continue;
		const { r, g, b } = hexToRgb(hex);
		const { C, H } = rgbToOklch(r, g, b);
		if (C < ACHROMATIC_THRESHOLD) continue; // skip achromatic — no meaningful hue
		dots.push({ name: fam.name, hue: H, hex, source: 'uploaded' });
	}
	return dots;
}
