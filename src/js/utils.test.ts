import { describe, expect, it } from 'vitest';
import { create_empty_geojson, create_geojson, get_green_types_code } from './utils';

describe('get_green_types_code', () => {
	// The codes are positional: the RPCs take this number, not the list.
	it('maps each supported combination to its code', () => {
		expect(get_green_types_code(['forests', 'grass', 'parks'] as never)).toBe(0);
		expect(get_green_types_code(['forests', 'parks'] as never)).toBe(1);
		expect(get_green_types_code(['grass', 'parks'] as never)).toBe(2);
		expect(get_green_types_code(['parks'] as never)).toBe(3);
		expect(get_green_types_code(['forests', 'grass'] as never)).toBe(4);
		expect(get_green_types_code(['forests'] as never)).toBe(5);
		expect(get_green_types_code(['grass'] as never)).toBe(6);
	});

	it('depends on the order of the input, not its contents', () => {
		// 'parks,forests' is the same selection as 'forests,parks' but matches no case,
		// so it silently falls through to 0 = all three types.
		expect(get_green_types_code(['parks', 'forests'] as never)).toBe(0);
	});

	it('returns undefined when given no list at all', () => {
		expect(get_green_types_code(undefined as never)).toBeUndefined();
	});

	// Known defect: [] is truthy, joins to '', matches no case and falls through to the
	// default 0 - which is the code for *all three* green types. Deselecting everything
	// therefore asks for everything. The UI should reject an empty selection instead.
	it.fails('should not treat an empty selection as "all types"', () => {
		expect(get_green_types_code([] as never)).not.toBe(0);
	});
});

describe('geojson helpers', () => {
	it('creates a well-formed empty FeatureCollection', () => {
		expect(create_empty_geojson()).toEqual({ type: 'FeatureCollection', features: [] });
	});

	it('wraps features in a FeatureCollection', () => {
		const features = [{ type: 'Feature', geometry: null, properties: {} }];
		expect(create_geojson(features as never)).toEqual({
			type: 'FeatureCollection',
			features
		});
	});

	it('returns a fresh object each time, so callers cannot alias one empty collection', () => {
		const a = create_empty_geojson();
		const b = create_empty_geojson();
		expect(a).not.toBe(b);
	});
});
