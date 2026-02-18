import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import InputPanel from './InputPanel.svelte';

afterEach(cleanup);

describe('InputPanel', () => {
	it('renders the hex input field', () => {
		const onChange = vi.fn();
		render(InputPanel, { props: { hexValue: '', colorName: 'Custom', onChange } });
		const inputs = screen.getAllByPlaceholderText('#7E42EB');
		expect(inputs.length).toBeGreaterThanOrEqual(1);
	});

	it('renders the name input field', () => {
		const onChange = vi.fn();
		render(InputPanel, { props: { hexValue: '', colorName: 'Custom', onChange } });
		const inputs = screen.getAllByPlaceholderText('Custom');
		expect(inputs.length).toBeGreaterThanOrEqual(1);
	});

	it('renders the Anchor Colour label', () => {
		const onChange = vi.fn();
		render(InputPanel, { props: { hexValue: '', colorName: 'Custom', onChange } });
		const labels = screen.getAllByText('Anchor Colour (300 Shade)');
		expect(labels.length).toBeGreaterThanOrEqual(1);
	});

	it('renders the Name label', () => {
		const onChange = vi.fn();
		render(InputPanel, { props: { hexValue: '', colorName: 'Custom', onChange } });
		const labels = screen.getAllByText('Name');
		expect(labels.length).toBeGreaterThanOrEqual(1);
	});

	it('shows error message for invalid hex input', async () => {
		const onChange = vi.fn();
		render(InputPanel, { props: { hexValue: '', colorName: 'Custom', onChange } });
		const input = screen.getAllByPlaceholderText('#7E42EB')[0];
		await fireEvent.input(input, { target: { value: 'ZZZZZZ' } });
		const errors = screen.getAllByText('Invalid hex');
		expect(errors.length).toBeGreaterThanOrEqual(1);
	});

	it('fires onChange callback with valid hex input', async () => {
		const onChange = vi.fn();
		render(InputPanel, { props: { hexValue: '', colorName: 'TestName', onChange } });
		const input = screen.getAllByPlaceholderText('#7E42EB')[0];
		await fireEvent.input(input, { target: { value: '#3B82F6' } });
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
			hex: '#3B82F6',
			name: 'TestName'
		}));
	});

	it('does not fire onChange for invalid hex input', async () => {
		const onChange = vi.fn();
		render(InputPanel, { props: { hexValue: '', colorName: 'Custom', onChange } });
		const input = screen.getAllByPlaceholderText('#7E42EB')[0];
		await fireEvent.input(input, { target: { value: 'not-a-hex' } });
		expect(onChange).not.toHaveBeenCalled();
	});

	it('renders a colour picker input', () => {
		const onChange = vi.fn();
		render(InputPanel, { props: { hexValue: '', colorName: 'Custom', onChange } });
		const pickers = document.querySelectorAll('input[type="color"]');
		expect(pickers.length).toBeGreaterThanOrEqual(1);
	});

	it('renders helper text for hex input', () => {
		const onChange = vi.fn();
		render(InputPanel, { props: { hexValue: '', colorName: 'Custom', onChange } });
		const helpers = screen.getAllByText('The base colour from which all 6 shades will be generated.');
		expect(helpers.length).toBeGreaterThanOrEqual(1);
	});

	it('fires onChange on name input when hex is valid', async () => {
		const onChange = vi.fn();
		render(InputPanel, { props: { hexValue: '#3B82F6', colorName: 'Blue', onChange } });
		const hexInput = screen.getAllByPlaceholderText('#7E42EB')[0];
		await fireEvent.input(hexInput, { target: { value: '#3B82F6' } });
		onChange.mockClear();
		const nameInput = screen.getAllByPlaceholderText('Custom')[0];
		await fireEvent.input(nameInput, { target: { value: 'NewBlue' } });
		expect(onChange).toHaveBeenCalled();
	});

	it('fires onChange on colour picker input', async () => {
		const onChange = vi.fn();
		render(InputPanel, { props: { hexValue: '', colorName: 'Custom', onChange } });
		const picker = document.querySelector('input[type="color"]') as HTMLInputElement;
		expect(picker).not.toBeNull();
		await fireEvent.input(picker, { target: { value: '#FF0000' } });
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
			hex: expect.stringMatching(/^#[0-9A-F]{6}$/)
		}));
	});

	it('exposes setHex method that triggers onChange', () => {
		const onChange = vi.fn();
		const { component } = render(InputPanel, { props: { hexValue: '', colorName: 'TestName', onChange } });
		(component as unknown as { setHex: (hex: string) => void }).setHex('#10B981');
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
			hex: '#10B981',
			name: 'TestName'
		}));
	});
});
