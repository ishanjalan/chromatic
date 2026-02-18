import { describe, it, expect } from 'vitest';
import { parseSemanticJson } from './parse-semantic-tokens';

function makeToken(path: string[], family: string, shade: string, hex = '#000000') {
	let obj: Record<string, unknown> = {
		$type: 'color',
		$value: { colorSpace: 'srgb', components: [0, 0, 0], alpha: 1, hex },
		$extensions: {
			'com.figma.aliasData': {
				targetVariableName: `Colour/${family}/${shade}`
			},
			'com.figma.scopes': ['ALL_FILLS']
		}
	};
	for (let i = path.length - 1; i >= 0; i--) {
		obj = { [path[i]]: obj };
	}
	return obj;
}

describe('parseSemanticJson', () => {
	it('extracts tokens with primitive references', () => {
		const json = JSON.stringify(makeToken(['Text', 'primary'], 'Grey', '750', '#1D1D1D'));
		const result = parseSemanticJson(json, 'Light.tokens.json');

		expect(result.tokens).toHaveLength(1);
		expect(result.tokens[0].family).toBe('Grey');
		expect(result.tokens[0].shadeKey).toBe('750');
		expect(result.tokens[0].path).toBe('Text/primary');
		expect(result.tokens[0].hex).toBe('#1D1D1D');
		expect(result.tokens[0].scope).toBe('ALL_FILLS');
		expect(result.errors).toHaveLength(0);
	});

	it('infers "Light" label from filename', () => {
		const result = parseSemanticJson('{}', 'Light.tokens.json');
		expect(result.label).toBe('Light');
	});

	it('infers "Dark" label from filename', () => {
		const result = parseSemanticJson('{}', 'Dark.tokens.json');
		expect(result.label).toBe('Dark');
	});

	it('falls back to cleaned filename for label', () => {
		const result = parseSemanticJson('{}', 'Custom.tokens.json');
		expect(result.label).toBe('Custom');
	});

	it('returns error for invalid JSON', () => {
		const result = parseSemanticJson('not json{{{', 'test');
		expect(result.tokens).toHaveLength(0);
		expect(result.errors.length).toBeGreaterThan(0);
		expect(result.errors[0]).toContain('Invalid JSON');
	});

	it('returns error for non-object JSON', () => {
		const result = parseSemanticJson('[1,2,3]', 'test');
		expect(result.tokens).toHaveLength(0);
		expect(result.errors[0]).toContain('JSON object');
	});

	it('returns error when no tokens are found', () => {
		const result = parseSemanticJson('{"empty": {}}', 'test');
		expect(result.tokens).toHaveLength(0);
		expect(result.errors.some((e) => e.includes('No semantic tokens'))).toBe(true);
	});

	it('extracts multiple tokens from nested structure', () => {
		const json = JSON.stringify({
			Text: {
				primary: {
					$type: 'color',
					$value: { hex: '#1D1D1D' },
					$extensions: { 'com.figma.aliasData': { targetVariableName: 'Colour/Grey/750' }, 'com.figma.scopes': ['TEXT_FILL'] }
				},
				secondary: {
					$type: 'color',
					$value: { hex: '#1D1D1DB0' },
					$extensions: { 'com.figma.aliasData': { targetVariableName: 'Colour/Grey/750' }, 'com.figma.scopes': ['TEXT_FILL'] }
				}
			},
			Background: {
				surface: {
					$type: 'color',
					$value: { hex: '#FFFFFF' },
					$extensions: { 'com.figma.aliasData': { targetVariableName: 'Colour/Grey/0' }, 'com.figma.scopes': ['ALL_FILLS'] }
				}
			}
		});

		const result = parseSemanticJson(json, 'Light.tokens.json');
		expect(result.tokens).toHaveLength(3);
		expect(result.tokens.map((t) => t.path).sort()).toEqual([
			'Background/surface',
			'Text/primary',
			'Text/secondary'
		]);
	});

	it('handles 2-part reference format (no Colour prefix)', () => {
		const json = JSON.stringify({
			test: {
				$type: 'color',
				$value: { hex: '#FF0000' },
				$extensions: { 'com.figma.aliasData': { targetVariableName: 'Red/300' } }
			}
		});
		const result = parseSemanticJson(json);
		expect(result.tokens).toHaveLength(1);
		expect(result.tokens[0].family).toBe('Red');
		expect(result.tokens[0].shadeKey).toBe('300');
	});

	it('skips tokens without aliasData', () => {
		const json = JSON.stringify({
			test: {
				$type: 'color',
				$value: { hex: '#FF0000' },
				$extensions: { 'com.figma.scopes': ['ALL_FILLS'] }
			}
		});
		const result = parseSemanticJson(json);
		expect(result.tokens).toHaveLength(0);
	});

	it('defaults hex to #000000 when $value.hex is not a string', () => {
		const json = JSON.stringify({
			test: {
				$type: 'color',
				$value: { hex: 123 },
				$extensions: { 'com.figma.aliasData': { targetVariableName: 'Colour/Red/300' } }
			}
		});
		const result = parseSemanticJson(json);
		expect(result.tokens).toHaveLength(1);
		expect(result.tokens[0].hex).toBe('#000000');
	});

	it('sets scope to null when scopes array is missing', () => {
		const json = JSON.stringify({
			test: {
				$type: 'color',
				$value: { hex: '#FF0000' },
				$extensions: { 'com.figma.aliasData': { targetVariableName: 'Colour/Red/300' } }
			}
		});
		const result = parseSemanticJson(json);
		expect(result.tokens).toHaveLength(1);
		expect(result.tokens[0].scope).toBeNull();
	});

	it('sets scope to null when scopes array is empty', () => {
		const json = JSON.stringify({
			test: {
				$type: 'color',
				$value: { hex: '#FF0000' },
				$extensions: {
					'com.figma.aliasData': { targetVariableName: 'Colour/Red/300' },
					'com.figma.scopes': []
				}
			}
		});
		const result = parseSemanticJson(json);
		expect(result.tokens).toHaveLength(1);
		expect(result.tokens[0].scope).toBeNull();
	});

	it('skips tokens where targetVariableName is not a string', () => {
		const json = JSON.stringify({
			test: {
				$type: 'color',
				$value: { hex: '#FF0000' },
				$extensions: { 'com.figma.aliasData': { targetVariableName: 123 } }
			}
		});
		const result = parseSemanticJson(json);
		expect(result.tokens).toHaveLength(0);
	});

	it('skips tokens with single-segment reference (no family/shade)', () => {
		const json = JSON.stringify({
			test: {
				$type: 'color',
				$value: { hex: '#FF0000' },
				$extensions: { 'com.figma.aliasData': { targetVariableName: 'JustOnePart' } }
			}
		});
		const result = parseSemanticJson(json);
		expect(result.tokens).toHaveLength(0);
	});

	it('skips color tokens without $extensions', () => {
		const json = JSON.stringify({
			test: {
				$type: 'color',
				$value: { hex: '#FF0000' }
			}
		});
		const result = parseSemanticJson(json);
		expect(result.tokens).toHaveLength(0);
	});

	it('skips non-color token types', () => {
		const json = JSON.stringify({
			test: {
				$type: 'dimension',
				$value: '16px'
			}
		});
		const result = parseSemanticJson(json);
		expect(result.tokens).toHaveLength(0);
	});
});
