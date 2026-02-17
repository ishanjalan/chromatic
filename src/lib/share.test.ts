import { describe, it, expect } from 'vitest';
import { encodeShareState, decodeShareState } from './share';

describe('share module', () => {
	const workspace = [
		{ inputHex: '#3B82F6', name: 'Blue' },
		{ inputHex: '#EF4444', name: 'Red' }
	];
	const locked = new Set(['Red']);

	it('round-trips encode → decode', () => {
		const encoded = encodeShareState(workspace, locked);
		const decoded = decodeShareState(encoded);

		expect(decoded).not.toBeNull();
		expect(decoded!.workspace).toHaveLength(2);
		expect(decoded!.workspace[0]).toEqual({ hex: '#3B82F6', name: 'Blue' });
		expect(decoded!.workspace[1]).toEqual({ hex: '#EF4444', name: 'Red' });
		expect(decoded!.locked).toEqual(['Red']);
	});

	it('handles empty workspace and no locked', () => {
		const encoded = encodeShareState([], new Set());
		const decoded = decodeShareState(encoded);

		expect(decoded).not.toBeNull();
		expect(decoded!.workspace).toHaveLength(0);
		expect(decoded!.locked).toEqual([]);
	});

	it('returns null for invalid base64', () => {
		expect(decodeShareState('!!! not valid')).toBeNull();
	});

	it('returns null for valid base64 but invalid JSON', () => {
		expect(decodeShareState(btoa('not json'))).toBeNull();
	});

	it('returns null for valid JSON but wrong structure', () => {
		expect(decodeShareState(btoa(JSON.stringify({ foo: 'bar' })))).toBeNull();
	});

	it('filters out malformed workspace entries', () => {
		const payload = {
			workspace: [
				{ hex: '#123456', name: 'Valid' },
				{ hex: 123, name: 'Bad hex type' },
				{ name: 'No hex' }
			],
			locked: ['Valid']
		};
		const encoded = btoa(JSON.stringify(payload));
		const decoded = decodeShareState(encoded);

		expect(decoded!.workspace).toHaveLength(1);
		expect(decoded!.workspace[0].name).toBe('Valid');
	});

	it('handles unicode names', () => {
		const ws = [{ inputHex: '#FF0000', name: 'Rojo 🔴' }];
		const encoded = encodeShareState(ws, new Set());
		const decoded = decodeShareState(encoded);

		expect(decoded!.workspace[0].name).toBe('Rojo 🔴');
	});
});
