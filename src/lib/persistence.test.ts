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

	describe('clearAll', () => {
		it('clears both workspace and token JSON', () => {
			saveWorkspace([mockScale]);
			saveTokenJson('test');
			clearAll();
			expect(loadWorkspace()).toEqual([]);
			expect(loadTokenJson()).toBeNull();
		});
	});

	describe('error handling', () => {
		it('survives localStorage.setItem throwing', () => {
			const original = Storage.prototype.setItem;
			Storage.prototype.setItem = () => { throw new Error('QuotaExceeded'); };
			expect(() => saveWorkspace([mockScale])).not.toThrow();
			expect(() => saveTokenJson('test')).not.toThrow();
			Storage.prototype.setItem = original;
		});

		it('survives localStorage.getItem throwing', () => {
			const original = Storage.prototype.getItem;
			Storage.prototype.getItem = () => { throw new Error('SecurityError'); };
			expect(loadWorkspace()).toEqual([]);
			expect(loadTokenJson()).toBeNull();
			Storage.prototype.getItem = original;
		});
	});
});
