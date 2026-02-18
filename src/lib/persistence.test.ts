import { describe, it, expect, beforeEach, vi } from 'vitest';

// Create a proper in-memory localStorage mock
function createLocalStorageMock() {
	const store: Record<string, string> = {};
	return {
		getItem: (key: string): string | null => store[key] ?? null,
		setItem: (key: string, value: string): void => { store[key] = value; },
		removeItem: (key: string): void => { delete store[key]; },
		clear: (): void => { for (const k of Object.keys(store)) delete store[k]; },
		get length() { return Object.keys(store).length; },
		key: (i: number) => Object.keys(store)[i] ?? null
	};
}

const mockStorage = createLocalStorageMock();
Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, writable: true, configurable: true });

import {
	saveWorkspace,
	loadWorkspace,
	saveTokenJson,
	loadTokenJson,
	clearTokenJson,
	saveLocked300,
	loadLocked300,
	saveLegendDismissed,
	loadLegendDismissed,
	saveSemanticJsons,
	loadSemanticJsons,
	clearSemanticJsons,
	clearAll
} from './persistence';
import type { ScaleResult } from './scale';

const mockScale: ScaleResult = {
	name: 'TestBlue',
	inputHex: '#3B82F6',
	hue: 230,
	isAchromatic: false,
	shades: []
} as ScaleResult;

describe('persistence', () => {
	beforeEach(() => {
		mockStorage.clear();
	});

	describe('workspace', () => {
		it('saves and loads workspace', () => {
			saveWorkspace([mockScale]);
			const loaded = loadWorkspace();
			expect(loaded).toHaveLength(1);
			expect(loaded[0].name).toBe('TestBlue');
		});

		it('returns empty array when nothing is saved', () => {
			expect(loadWorkspace()).toEqual([]);
		});

		it('overwrites previous workspace', () => {
			saveWorkspace([mockScale]);
			saveWorkspace([]);
			expect(loadWorkspace()).toEqual([]);
		});

		it('handles corrupt data gracefully', () => {
			localStorage.setItem('csg-workspace-v1', 'not-json{{');
			expect(loadWorkspace()).toEqual([]);
		});

		it('handles non-array data gracefully', () => {
			localStorage.setItem('csg-workspace-v1', '"just a string"');
			expect(loadWorkspace()).toEqual([]);
		});
	});

	describe('token JSON', () => {
		it('saves and loads token JSON', () => {
			saveTokenJson('{"Colour": {}}');
			expect(loadTokenJson()).toBe('{"Colour": {}}');
		});

		it('returns null when nothing is saved', () => {
			expect(loadTokenJson()).toBeNull();
		});

		it('clears token JSON', () => {
			saveTokenJson('test');
			clearTokenJson();
			expect(loadTokenJson()).toBeNull();
		});
	});

	describe('locked 300 families', () => {
		it('saves and loads a set of locked families', () => {
			saveLocked300(new Set(['Red', 'Blue']));
			const loaded = loadLocked300();
			expect(loaded).toBeInstanceOf(Set);
			expect(loaded.has('Red')).toBe(true);
			expect(loaded.has('Blue')).toBe(true);
			expect(loaded.size).toBe(2);
		});

		it('returns empty set when nothing is saved', () => {
			expect(loadLocked300().size).toBe(0);
		});

		it('handles corrupt data gracefully', () => {
			localStorage.setItem('csg-locked-300-v1', '{not-an-array}');
			expect(loadLocked300().size).toBe(0);
		});

		it('handles non-array data gracefully', () => {
			localStorage.setItem('csg-locked-300-v1', '"just a string"');
			expect(loadLocked300().size).toBe(0);
		});
	});

	describe('legend dismissed', () => {
		it('saves and loads dismissed state (true)', () => {
			saveLegendDismissed(true);
			expect(loadLegendDismissed()).toBe(true);
		});

		it('saves and loads dismissed state (false)', () => {
			saveLegendDismissed(false);
			expect(loadLegendDismissed()).toBe(false);
		});

		it('returns false when nothing is saved', () => {
			expect(loadLegendDismissed()).toBe(false);
		});
	});

	describe('semantic JSONs', () => {
		const mockFiles = [
			{ fileName: 'Light.tokens.json', json: '{"Text": {}}' },
			{ fileName: 'Dark.tokens.json', json: '{"Text": {}}' }
		];

		it('saves and loads semantic JSON files', () => {
			saveSemanticJsons(mockFiles);
			const loaded = loadSemanticJsons();
			expect(loaded).toHaveLength(2);
			expect(loaded[0].fileName).toBe('Light.tokens.json');
			expect(loaded[1].json).toBe('{"Text": {}}');
		});

		it('returns empty array when nothing is saved', () => {
			expect(loadSemanticJsons()).toEqual([]);
		});

		it('clears semantic JSONs', () => {
			saveSemanticJsons(mockFiles);
			clearSemanticJsons();
			expect(loadSemanticJsons()).toEqual([]);
		});

		it('handles corrupt data gracefully', () => {
			localStorage.setItem('csg-semantic-json-v1', 'not-json{{');
			expect(loadSemanticJsons()).toEqual([]);
		});

		it('handles non-array data gracefully', () => {
			localStorage.setItem('csg-semantic-json-v1', '{"obj": true}');
			expect(loadSemanticJsons()).toEqual([]);
		});
	});

	describe('clearAll', () => {
		it('clears workspace, token JSON, locked families, and semantic JSONs', () => {
			saveWorkspace([mockScale]);
			saveTokenJson('test');
			saveLocked300(new Set(['Red']));
			saveSemanticJsons([{ fileName: 'f', json: '{}' }]);
			clearAll();
			expect(loadWorkspace()).toEqual([]);
			expect(loadTokenJson()).toBeNull();
			expect(loadLocked300().size).toBe(0);
			expect(loadSemanticJsons()).toEqual([]);
		});
	});

	describe('error handling', () => {
		it('survives localStorage.setItem throwing', () => {
			const original = mockStorage.setItem;
			mockStorage.setItem = () => { throw new Error('QuotaExceeded'); };
			expect(() => saveWorkspace([mockScale])).not.toThrow();
			expect(() => saveTokenJson('test')).not.toThrow();
			expect(() => saveLocked300(new Set(['x']))).not.toThrow();
			expect(() => saveLegendDismissed(true)).not.toThrow();
			expect(() => saveSemanticJsons([])).not.toThrow();
			mockStorage.setItem = original;
		});

		it('survives localStorage.getItem throwing', () => {
			const original = mockStorage.getItem;
			mockStorage.getItem = () => { throw new Error('SecurityError'); };
			expect(loadWorkspace()).toEqual([]);
			expect(loadTokenJson()).toBeNull();
			expect(loadLocked300().size).toBe(0);
			expect(loadLegendDismissed()).toBe(false);
			expect(loadSemanticJsons()).toEqual([]);
			mockStorage.getItem = original;
		});

		it('survives localStorage.removeItem throwing', () => {
			const original = mockStorage.removeItem;
			mockStorage.removeItem = () => { throw new Error('Error'); };
			expect(() => clearTokenJson()).not.toThrow();
			expect(() => clearSemanticJsons()).not.toThrow();
			expect(() => clearAll()).not.toThrow();
			mockStorage.removeItem = original;
		});
	});
});
