/**
 * Parse a Figma-exported semantic token JSON (e.g. Light.tokens.json, Dark.tokens.json).
 *
 * Semantic tokens reference primitives via `$extensions.com.figma.aliasData.targetVariableName`.
 * The format is "Colour/FamilyName/Shade" (e.g. "Colour/Grey/750").
 *
 * This module extracts those references for cross-referencing against the primitives file.
 */

export interface SemanticToken {
	/** Dot-path through the JSON, e.g. "Text/primary" */
	path: string;
	/** Resolved hex value from the token */
	hex: string;
	/** Raw alias reference, e.g. "Colour/Grey/750" */
	primitiveRef: string;
	/** Parsed family name, e.g. "Grey" */
	family: string;
	/** Parsed shade key, e.g. "750" — kept as string to handle alpha variants like "750_69" */
	shadeKey: string;
	/** Figma scope hint (e.g. "TEXT_FILL", "ALL_FILLS") */
	scope: string | null;
}

export interface SemanticParseResult {
	/** Label for this file, e.g. "Light" or "Dark" */
	label: string;
	/** All extracted semantic tokens with their primitive references */
	tokens: SemanticToken[];
	/** Parse errors */
	errors: string[];
}

/**
 * Attempt to infer a label from the file name or content structure.
 * Falls back to the provided label.
 */
function inferLabel(fileName: string): string {
	const lower = fileName.toLowerCase();
	if (lower.includes('light')) return 'Light';
	if (lower.includes('dark')) return 'Dark';
	return fileName.replace(/\.tokens\.json$/i, '').replace(/\.json$/i, '');
}

/**
 * Recursively walk a semantic JSON tree and extract all colour tokens
 * that have aliasData pointing back to primitives.
 */
function walkTree(
	obj: unknown,
	pathParts: string[],
	tokens: SemanticToken[]
): void {
	if (typeof obj !== 'object' || obj === null) return;
	const o = obj as Record<string, unknown>;

	// Check if this is a colour token with aliasData
	if (o.$type === 'color' && typeof o.$value === 'object' && o.$value !== null) {
		const val = o.$value as Record<string, unknown>;
		const hex = typeof val.hex === 'string' ? val.hex.toUpperCase() : null;

		if (typeof o.$extensions === 'object' && o.$extensions !== null) {
			const ext = o.$extensions as Record<string, unknown>;
			const aliasData = ext['com.figma.aliasData'] as Record<string, unknown> | undefined;

			if (aliasData && typeof aliasData.targetVariableName === 'string') {
				const ref = aliasData.targetVariableName;
				// Parse "Colour/FamilyName/Shade" format
				const parts = ref.split('/');

				// Expected: ["Colour", "FamilyName", "Shade"]
				// But handle cases where the wrapper may differ
				let family = '';
				let shadeKey = '';

				if (parts.length >= 3) {
					family = parts[parts.length - 2];
					shadeKey = parts[parts.length - 1];
				} else if (parts.length === 2) {
					family = parts[0];
					shadeKey = parts[1];
				}

				// Extract scope
				const scopes = ext['com.figma.scopes'] as string[] | undefined;
				const scope = scopes && scopes.length > 0 ? scopes[0] : null;

				if (family && shadeKey) {
					tokens.push({
						path: pathParts.join('/'),
						hex: hex ?? '#000000',
						primitiveRef: ref,
						family,
						shadeKey,
						scope
					});
				}
			}
		}
		return; // Don't recurse into token values
	}

	// Recurse into child objects (skip $-prefixed metadata keys)
	for (const [key, value] of Object.entries(o)) {
		if (key.startsWith('$')) continue;
		walkTree(value, [...pathParts, key], tokens);
	}
}

/**
 * Parse a semantic token JSON file and extract all primitive references.
 */
export function parseSemanticJson(raw: string, fileName: string = 'Semantic'): SemanticParseResult {
	const label = inferLabel(fileName);
	const errors: string[] = [];
	const tokens: SemanticToken[] = [];

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return { label, tokens: [], errors: ['Invalid JSON — could not parse.'] };
	}

	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		return { label, tokens: [], errors: ['Expected a JSON object at the top level.'] };
	}

	walkTree(parsed, [], tokens);

	if (tokens.length === 0) {
		errors.push('No semantic tokens with primitive references found.');
	}

	return { label, tokens, errors };
}
