import { describe, expect, it } from 'vitest';
import { ACOLOR_GREEN, AV_COLOR_GREEN, ToHEX, ToRGB, ToRGBA } from './colors';

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

describe('ToRGB', () => {
	it('parses six-digit hex, with or without the hash', () => {
		expect(ToRGB('#54b435')).toEqual([84, 180, 53]);
		expect(ToRGB('54b435')).toEqual([84, 180, 53]);
	});

	it('is case-insensitive', () => {
		expect(ToRGB('#54B435')).toEqual([84, 180, 53]);
	});

	it('returns undefined for input it cannot parse, rather than throwing', () => {
		expect(ToRGB('nonsense')).toBeUndefined();
		expect(ToRGB('#12')).toBeUndefined();
	});

	// Known gap: three-digit shorthand is valid CSS and is not handled. Callers do not
	// check for undefined, so a shorthand colour would propagate as undefined.
	it.fails('should accept three-digit shorthand hex', () => {
		expect(ToRGB('#fff')).toEqual([255, 255, 255]);
	});

	it('round-trips with ToHEX', () => {
		expect(ToRGB(ToHEX([12, 34, 56]))).toEqual([12, 34, 56]);
	});
});

describe('ToRGBA', () => {
	it('renders a css rgba() string at the given opacity', () => {
		expect(ToRGBA([1, 2, 3], 0.5)).toBe('rgba(1,2,3,0.5)');
		expect(ToRGBA([84, 180, 53], 1)).toBe('rgba(84,180,53,1)');
	});
});
