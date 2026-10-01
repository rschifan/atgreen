import { describe, expect, it } from 'vitest';
import { ACOLOR_GREEN, AV_COLOR_GREEN, ToHEX } from './colors';

describe('ToHEX', () => {
	it('converts an RGB triple to a hex string', () => {
		expect(ToHEX([0, 0, 0])).toBe('#000000');
		expect(ToHEX([255, 255, 255])).toBe('#ffffff');
		expect(ToHEX(AV_COLOR_GREEN)).toBe(ACOLOR_GREEN);
	});

	it('zero-pads single-digit components', () => {
		expect(ToHEX([1, 2, 3])).toBe('#010203');
	});
});
