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

	it('renders the Family Name label', () => {
		const onChange = vi.fn();
		render(InputPanel, { props: { hexValue: '', colorName: 'Custom', onChange } });
		const labels = screen.getAllByText('Family Name');
		expect(labels.length).toBeGreaterThanOrEqual(1);
	});

	it('shows error message for invalid hex input', async () => {
		const onChange = vi.fn();
		render(InputPanel, { props: { hexValue: '', colorName: 'Custom', onChange } });
		const input = screen.getAllByPlaceholderText('#7E42EB')[0];
		await fireEvent.input(input, { target: { value: 'ZZZZZZ' } });
		const errors = screen.getAllByText('Enter a valid 6-character hex (e.g. #7E42EB)');
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
});
