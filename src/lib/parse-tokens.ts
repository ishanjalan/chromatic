/**
 * Parse a Figma-exported Value.tokens.json (or similar) to extract
 * colour families and their 6 core shade hex values.
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
}

export interface ParseResult {
	families: ParsedFamily[];
	errors: string[];
}

const CORE_SHADES = new Set(SHADE_LEVELS.map(String));

function isColourNode(obj: unknown): obj is { $type: string; $value: { hex: string } } {
	if (typeof obj !== 'object' || obj === null) return false;
	const o = obj as Record<string, unknown>;
	if (o.$type !== 'color') return false;
	if (typeof o.$value !== 'object' || o.$value === null) return false;
	const val = o.$value as Record<string, unknown>;
	return typeof val.hex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(val.hex);
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

function isFamilyCandidate(obj: unknown): obj is Record<string, unknown> {
	if (typeof obj !== 'object' || obj === null) return false;
	const entries = Object.entries(obj as Record<string, unknown>);
	return entries.some(([key]) => CORE_SHADES.has(key));
}

export function parseTokenJson(raw: string): ParseResult {
	const errors: string[] = [];
	const families: ParsedFamily[] = [];

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return { families: [], errors: ['Invalid JSON — could not parse the input.'] };
	}

	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		return { families: [], errors: ['Expected a JSON object at the top level.'] };
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
		return { families: [], errors: ['Could not find colour data in the JSON.'] };
	}

	for (const [name, value] of Object.entries(searchIn)) {
		if (!isFamilyCandidate(value)) continue;
		const family = extractFamily(name, value as Record<string, unknown>);
		if (family) {
			// Skip achromatic/neutral families — they have no meaningful hue
			const anchorHex = family.shades[300] ?? family.shades[200] ?? family.shades[100] ?? family.shades[50];
			if (anchorHex) {
				const { r, g, b } = hexToRgb(anchorHex);
				const { C } = rgbToOklch(r, g, b);
				if (C < ACHROMATIC_THRESHOLD) {
					errors.push(`${name}: skipped (achromatic/neutral — no meaningful hue for scale generation)`);
					continue;
				}
			}

			families.push(family);
			if (!family.complete) {
				const missing = SHADE_LEVELS.filter((s) => !(s in family.shades));
				errors.push(`${name}: missing shades ${missing.join(', ')}`);
			}
		}
	}

	if (families.length === 0) {
		errors.push('No colour families found. Expected format: { Colour: { FamilyName: { "50": { $type: "color", $value: { hex: "..." } }, ... } } }');
	}

	return { families, errors };
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
