/**
 * Shareable URL encoding/decoding for Chromatic workspace state.
 *
 * Encodes workspace scales (as hex+name pairs) and locked families
 * into a compact base64 URL hash parameter.  Token JSON is excluded
 * (too large for URLs) — recipients get the workspace/locked state
 * and can upload their own tokens independently.
 */

export interface SharePayload {
	/** Workspace entries — only the input hex and name are needed to regenerate scales */
	workspace: Array<{ hex: string; name: string }>;
	/** Family names whose 300 shade is locked */
	locked: string[];
}

/**
 * Encode workspace + locked families into a URL-safe base64 string.
 */
export function encodeShareState(
	workspace: Array<{ inputHex: string; name: string }>,
	lockedFamilies: Set<string>
): string {
	const payload: SharePayload = {
		workspace: workspace.map((s) => ({ hex: s.inputHex, name: s.name })),
		locked: [...lockedFamilies]
	};

	const json = JSON.stringify(payload);
	// btoa works on latin1 — encode to UTF-8 via TextEncoder first for safety
	const bytes = new TextEncoder().encode(json);
	const binary = String.fromCharCode(...bytes);
	return btoa(binary);
}

/**
 * Decode a base64 share string back into a SharePayload.
 * Returns null on any parse or format error.
 */
export function decodeShareState(encoded: string): SharePayload | null {
	try {
		const binary = atob(encoded);
		const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
		const json = new TextDecoder().decode(bytes);
		const parsed = JSON.parse(json);

		if (!parsed || typeof parsed !== 'object') return null;
		if (!Array.isArray(parsed.workspace)) return null;

		// Validate each workspace entry
		const workspace: SharePayload['workspace'] = [];
		for (const entry of parsed.workspace) {
			if (typeof entry?.hex !== 'string' || typeof entry?.name !== 'string') continue;
			workspace.push({ hex: entry.hex, name: entry.name });
		}

		const locked: string[] = Array.isArray(parsed.locked)
			? parsed.locked.filter((l: unknown) => typeof l === 'string')
			: [];

		return { workspace, locked };
	} catch {
		return null;
	}
}

/**
 * Build a full shareable URL from the current page URL and encoded state.
 */
export function buildShareUrl(encoded: string): string {
	const url = new URL(window.location.href);
	url.hash = `share=${encoded}`;
	return url.toString();
}
