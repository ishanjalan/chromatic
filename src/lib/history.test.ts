import { describe, it, expect } from 'vitest';
import { ColourHistory } from './history';

describe('ColourHistory', () => {
	it('starts empty with no navigation possible', () => {
		const h = new ColourHistory();
		expect(h.canGoBack).toBe(false);
		expect(h.canGoForward).toBe(false);
		expect(h.size).toBe(0);
		expect(h.back()).toBeNull();
		expect(h.forward()).toBeNull();
	});

	it('push adds entries and allows back navigation', () => {
		const h = new ColourHistory();
		h.push('#FF0000', 'Red');
		h.push('#00FF00', 'Green');

		expect(h.size).toBe(2);
		expect(h.canGoBack).toBe(true);
		expect(h.canGoForward).toBe(false);

		const prev = h.back();
		expect(prev).toEqual({ hex: '#FF0000', name: 'Red' });
		expect(h.canGoForward).toBe(true);
	});

	it('forward moves cursor ahead after going back', () => {
		const h = new ColourHistory();
		h.push('#FF0000', 'Red');
		h.push('#00FF00', 'Green');
		h.push('#0000FF', 'Blue');

		h.back(); // -> Green
		h.back(); // -> Red

		const fwd = h.forward();
		expect(fwd).toEqual({ hex: '#00FF00', name: 'Green' });

		const fwd2 = h.forward();
		expect(fwd2).toEqual({ hex: '#0000FF', name: 'Blue' });

		expect(h.canGoForward).toBe(false);
	});

	it('pushing after going back truncates forward history', () => {
		const h = new ColourHistory();
		h.push('#FF0000', 'Red');
		h.push('#00FF00', 'Green');
		h.push('#0000FF', 'Blue');

		h.back(); // -> Green
		h.push('#FFFF00', 'Yellow');

		expect(h.canGoForward).toBe(false);
		expect(h.size).toBe(3); // Red, Green, Yellow (Blue truncated)

		const prev = h.back();
		expect(prev).toEqual({ hex: '#00FF00', name: 'Green' });
	});

	it('does not push duplicate consecutive entries', () => {
		const h = new ColourHistory();
		h.push('#FF0000', 'Red');
		h.push('#FF0000', 'Red');
		h.push('#FF0000', 'Red');

		expect(h.size).toBe(1);
	});

	it('respects maxSize', () => {
		const h = new ColourHistory(5);
		for (let i = 0; i < 10; i++) {
			h.push(`#${i.toString().padStart(6, '0')}`, `Color${i}`);
		}
		expect(h.size).toBe(5);
	});

	it('back returns null at the beginning', () => {
		const h = new ColourHistory();
		h.push('#FF0000', 'Red');

		expect(h.canGoBack).toBe(false);
		expect(h.back()).toBeNull();
	});

	it('forward returns null at the end', () => {
		const h = new ColourHistory();
		h.push('#FF0000', 'Red');
		h.push('#00FF00', 'Green');

		expect(h.canGoForward).toBe(false);
		expect(h.forward()).toBeNull();
	});

	it('currentIndex tracks cursor position', () => {
		const h = new ColourHistory();
		expect(h.currentIndex).toBe(-1);

		h.push('#FF0000', 'Red');
		expect(h.currentIndex).toBe(0);

		h.push('#00FF00', 'Green');
		expect(h.currentIndex).toBe(1);

		h.back();
		expect(h.currentIndex).toBe(0);
	});
});
