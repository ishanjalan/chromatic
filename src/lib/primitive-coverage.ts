/**
 * Cross-reference engine: compares primitives against semantic token references
 * to determine which primitive colours are actually used and which are unused.
 */

import type { ParsedFamily, AchromaticFamily } from './parse-tokens';
import type { SemanticParseResult, SemanticToken } from './parse-semantic-tokens';

/* ─── Interfaces ─── */

export interface PrimitiveUsage {
	family: string;
	shade: string;
	hex: string;
	/** Semantic tokens that reference this primitive, grouped by mode label */
	usedIn: { mode: string; path: string; scope: string | null }[];
}

export interface FamilyCoverage {
	family: string;
	total: number;
	used: number;
	unused: number;
	/** Percentage of shades used (0–100) */
	pct: number;
}

export interface CoverageAnalysis {
	/** Primitives referenced by at least one semantic token */
	used: PrimitiveUsage[];
	/** Primitives not referenced by any semantic token */
	unused: PrimitiveUsage[];
	/** Per-family coverage breakdown */
	byFamily: FamilyCoverage[];
	/** Semantic tokens that reference primitives not found in the uploaded file */
	unknownRefs: { mode: string; path: string; ref: string }[];
	/** Summary stats */
	stats: {
		totalPrimitives: number;
		usedCount: number;
		unusedCount: number;
		pct: number;
		modesAnalysed: string[];
	};
}

/* ─── Engine ─── */

/**
 * Build a flat map of all known primitives from both chromatic and achromatic families.
 * Key format: "FamilyName/Shade" (e.g. "Grey/750", "Purple/300")
 */
function buildPrimitiveMap(
	families: ParsedFamily[],
	achromaticFamilies: AchromaticFamily[]
): Map<string, { family: string; shade: string; hex: string }> {
	const map = new Map<string, { family: string; shade: string; hex: string }>();

	for (const fam of families) {
		for (const [shade, hex] of Object.entries(fam.shades)) {
			map.set(`${fam.name}/${shade}`, { family: fam.name, shade, hex });
		}
	}

	for (const fam of achromaticFamilies) {
		for (const [shade, hex] of Object.entries(fam.shades)) {
			map.set(`${fam.name}/${shade}`, { family: fam.name, shade, hex });
		}
	}

	return map;
}

/**
 * Analyse coverage of primitives by semantic tokens.
 *
 * @param families - Chromatic primitive families
 * @param achromaticFamilies - Achromatic/neutral primitive families
 * @param semanticResults - Parsed semantic token files (Light, Dark, etc.)
 */
export function analyseCoverage(
	families: ParsedFamily[],
	achromaticFamilies: AchromaticFamily[],
	semanticResults: SemanticParseResult[]
): CoverageAnalysis {
	const primitiveMap = buildPrimitiveMap(families, achromaticFamilies);

	// Track which primitives are used, keyed by "Family/Shade"
	const usageMap = new Map<string, PrimitiveUsage>();
	const unknownRefs: { mode: string; path: string; ref: string }[] = [];

	// Initialize all primitives as unused
	for (const [key, prim] of primitiveMap) {
		usageMap.set(key, {
			family: prim.family,
			shade: prim.shade,
			hex: prim.hex,
			usedIn: []
		});
	}

	// Walk semantic tokens and mark referenced primitives as used
	for (const result of semanticResults) {
		for (const token of result.tokens) {
			const key = `${token.family}/${token.shadeKey}`;

			if (usageMap.has(key)) {
				usageMap.get(key)!.usedIn.push({
					mode: result.label,
					path: token.path,
					scope: token.scope
				});
			} else {
				// This semantic token references a primitive we don't know about
				// (could be an alpha variant or a missing family)
				unknownRefs.push({
					mode: result.label,
					path: token.path,
					ref: token.primitiveRef
				});
			}
		}
	}

	// Split into used and unused
	const used: PrimitiveUsage[] = [];
	const unused: PrimitiveUsage[] = [];

	for (const prim of usageMap.values()) {
		if (prim.usedIn.length > 0) {
			used.push(prim);
		} else {
			unused.push(prim);
		}
	}

	// Per-family breakdown
	const familyMap = new Map<string, { total: number; used: number }>();
	for (const prim of usageMap.values()) {
		if (!familyMap.has(prim.family)) {
			familyMap.set(prim.family, { total: 0, used: 0 });
		}
		const f = familyMap.get(prim.family)!;
		f.total++;
		if (prim.usedIn.length > 0) f.used++;
	}

	const byFamily: FamilyCoverage[] = [...familyMap.entries()]
		.map(([family, { total, used: u }]) => ({
			family,
			total,
			used: u,
			unused: total - u,
			pct: total > 0 ? Math.round((u / total) * 100) : 0
		}))
		.sort((a, b) => a.pct - b.pct); // least used first — surfaces cleanup opportunities

	const totalPrimitives = primitiveMap.size;
	const usedCount = used.length;

	return {
		used,
		unused,
		byFamily,
		unknownRefs,
		stats: {
			totalPrimitives,
			usedCount,
			unusedCount: totalPrimitives - usedCount,
			pct: totalPrimitives > 0 ? Math.round((usedCount / totalPrimitives) * 100) : 0,
			modesAnalysed: semanticResults.map((r) => r.label)
		}
	};
}
