/**
 * Figma plugin sync endpoint.
 *
 * POST: Receives extracted colour tokens from the Chromatic Figma plugin.
 * GET:  Returns the most recently synced data (polled by the web app).
 *
 * Data is held in-memory (server restart clears it). This is intentional —
 * the sync is ephemeral and only bridges the Figma plugin → browser tab gap.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface SyncPayload {
	primitives: Record<string, unknown>;
	lightSemantic: Record<string, unknown>;
	darkSemantic: Record<string, unknown>;
}

interface StoredSync extends SyncPayload {
	receivedAt: string;
}

let latestSync: StoredSync | null = null;

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

export const OPTIONS: RequestHandler = async () => {
	return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	if (!body || typeof body !== 'object') {
		throw error(422, 'Expected a JSON object');
	}

	const payload = body as Record<string, unknown>;
	if (!payload.primitives || typeof payload.primitives !== 'object') {
		throw error(422, 'Missing or invalid "primitives" field');
	}

	latestSync = {
		primitives: payload.primitives as Record<string, unknown>,
		lightSemantic: (payload.lightSemantic as Record<string, unknown>) ?? {},
		darkSemantic: (payload.darkSemantic as Record<string, unknown>) ?? {},
		receivedAt: new Date().toISOString(),
	};

	return json(
		{ success: true, receivedAt: latestSync.receivedAt },
		{ headers: CORS_HEADERS }
	);
};

export const GET: RequestHandler = async () => {
	if (!latestSync) {
		return json({ available: false }, { headers: CORS_HEADERS });
	}

	return json(
		{
			available: true,
			receivedAt: latestSync.receivedAt,
			primitives: latestSync.primitives,
			lightSemantic: latestSync.lightSemantic,
			darkSemantic: latestSync.darkSemantic,
		},
		{ headers: CORS_HEADERS }
	);
};
