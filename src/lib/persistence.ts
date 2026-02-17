/**
 * localStorage persistence for workspace scales and uploaded token JSON.
 *
 * All reads are wrapped in try/catch to handle private browsing,
 * quota exceeded, and corrupt data gracefully.
 */

import type { ScaleResult } from './scale';

const WORKSPACE_KEY = 'csg-workspace-v1';
const TOKEN_JSON_KEY = 'csg-token-json-v1';
const LOCKED_300_KEY = 'csg-locked-300-v1';

export function saveWorkspace(scales: ScaleResult[]): void {
	try {
		localStorage.setItem(WORKSPACE_KEY, JSON.stringify(scales));
	} catch {
		// quota exceeded or private browsing — silently fail
	}
}

export function loadWorkspace(): ScaleResult[] {
	try {
		const raw = localStorage.getItem(WORKSPACE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed;
	} catch {
		return [];
	}
}

export function saveTokenJson(json: string): void {
	try {
		localStorage.setItem(TOKEN_JSON_KEY, json);
	} catch {
		// silently fail
	}
}

export function loadTokenJson(): string | null {
	try {
		return localStorage.getItem(TOKEN_JSON_KEY);
	} catch {
		return null;
	}
}

export function clearTokenJson(): void {
	try {
		localStorage.removeItem(TOKEN_JSON_KEY);
	} catch {
		// silently fail
	}
}

export function saveLocked300(families: Set<string>): void {
	try {
		localStorage.setItem(LOCKED_300_KEY, JSON.stringify([...families]));
	} catch {
		// silently fail
	}
}

export function loadLocked300(): Set<string> {
	try {
		const raw = localStorage.getItem(LOCKED_300_KEY);
		if (!raw) return new Set();
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return new Set();
		return new Set(parsed);
	} catch {
		return new Set();
	}
}

export function clearAll(): void {
	try {
		localStorage.removeItem(WORKSPACE_KEY);
		localStorage.removeItem(TOKEN_JSON_KEY);
		localStorage.removeItem(LOCKED_300_KEY);
	} catch {
		// silently fail
	}
}
