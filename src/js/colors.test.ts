import { describe, expect, it } from 'vitest';
import { ACOLOR_GREEN, AV_COLOR_GREEN, to_hex } from './colors';

describe('to_hex', () => {
	it('converts an RGB triple to a hex string', () => {
		expect(to_hex([0, 0, 0])).toBe('#000000');
		expect(to_hex([255, 255, 255])).toBe('#ffffff');
		expect(to_hex(AV_COLOR_GREEN)).toBe(ACOLOR_GREEN);
	});

	it('zero-pads single-digit components', () => {
		expect(to_hex([1, 2, 3])).toBe('#010203');
	});
});
