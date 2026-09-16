import { describe, expect, it } from 'vitest';
import { build_greenareas_filter, extent, get_colormap_rule, spread, to_scale } from './layers';
import { AccessibilityIndexType, ClassificationScheme } from './types';

describe('extent', () => {
	it('finds min and max', () => {
		expect(extent([3, 1, 4, 1, 5])).toEqual({ min: 1, max: 5 });
	});

	it('ignores NaN and non-numbers rather than poisoning the range', () => {
		expect(extent([2, NaN, 8])).toEqual({ min: 2, max: 8 });
	});

	it('falls back to a well-formed range for empty input', () => {
		// Infinity in a Mapbox expression is a broken layer, not an empty one.
		expect(extent([])).toEqual({ min: 0, max: 1 });
	});

	// The reason this exists: Math.max(...data) passes each value as an argument.
	// Measured on node 22 — 100k arguments fine, 125k throws. Grids are thousands
	// today, so the old code was about one large city from a blank map.
	it('handles arrays far larger than the argument limit', () => {
		const big = Array.from({ length: 200_000 }, (_, i) => i);
		expect(() => extent(big)).not.toThrow();
		expect(extent(big)).toEqual({ min: 0, max: 199_999 });
	});
});

describe('to_scale', () => {
	it('is the identity for a linear ramp', () => {
		expect(to_scale(12.5, ClassificationScheme.LINEAR)).toBe(12.5);
	});

	it('takes log2 for a logarithmic ramp', () => {
		expect(to_scale(8, ClassificationScheme.LOGARITHMIC)).toBe(3);
	});

	it('clamps non-positive values instead of claiming they are log2(1)', () => {
		// The old code substituted 0 for a zero input, which reads as the value 1.
		expect(to_scale(0, ClassificationScheme.LOGARITHMIC)).toBe(0);
		expect(to_scale(-5, ClassificationScheme.LOGARITHMIC)).toBe(0);
	});
});

describe('spread', () => {
	it('leaves already-ascending stops alone', () => {
		expect(spread(0, 5, 10)).toEqual([0, 5, 10]);
	});

	it('separates a middle stop that sits at or below the low stop', () => {
		const [a, b, c] = spread(5, 5, 10);
		expect(a).toBeLessThan(b);
		expect(b).toBeLessThan(c);
	});

	it('separates a fully degenerate range', () => {
		const [a, b, c] = spread(7, 7, 7);
		expect(a).toBeLessThan(b);
		expect(b).toBeLessThan(c);
	});
});

describe('get_colormap_rule', () => {
	const stops = (rule: unknown[]) => [rule[3], rule[5], rule[7]] as number[];

	it('produces strictly ascending stops for ordinary data', () => {
		const rule = get_colormap_rule(
			[0, 5, 10, 20],
			AccessibilityIndexType.MINIMUM_DISTANCE,
			ClassificationScheme.LINEAR,
			5
		);
		const [a, b, c] = stops(rule);
		expect(a).toBeLessThan(b);
		expect(b).toBeLessThan(c);
	});

	// A target every cell already meets, or none does, is a real situation — not an
	// edge case. Mapbox throws on non-ascending interpolate stops and the layer
	// never paints.
	it('stays ascending when every value beats the target', () => {
		const rule = get_colormap_rule(
			[1, 2, 3],
			AccessibilityIndexType.MINIMUM_DISTANCE,
			ClassificationScheme.LINEAR,
			999
		);
		const [a, b, c] = stops(rule);
		expect(a).toBeLessThan(b);
		expect(b).toBeLessThan(c);
	});

	it('stays ascending when no value reaches the target', () => {
		const rule = get_colormap_rule(
			[100, 200],
			AccessibilityIndexType.EXPOSURE,
			ClassificationScheme.LINEAR,
			-50
		);
		const [a, b, c] = stops(rule);
		expect(a).toBeLessThan(b);
		expect(b).toBeLessThan(c);
	});

	it('stays ascending when every cell holds the same value', () => {
		const rule = get_colormap_rule(
			[4, 4, 4],
			AccessibilityIndexType.PER_PERSON,
			ClassificationScheme.LOGARITHMIC,
			4
		);
		const [a, b, c] = stops(rule);
		expect(a).toBeLessThan(b);
		expect(b).toBeLessThan(c);
	});

	it('does not throw on a grid larger than the argument limit', () => {
		const big = Array.from({ length: 150_000 }, (_, i) => i % 60);
		expect(() =>
			get_colormap_rule(
				big,
				AccessibilityIndexType.MINIMUM_DISTANCE,
				ClassificationScheme.LINEAR,
				5
			)
		).not.toThrow();
	});
});

describe('build_greenareas_filter', () => {
	it('combines every active control instead of replacing them', () => {
		// The bug: three reactive blocks each called setFilter with a complete
		// expression, so the last one to run discarded the others. Reproduced on
		// production — slider at "576 ha and larger" plus a type change brought
		// every small area back.
		const filter = build_greenareas_filter([1, 2], 10, ['Parco Valentino']);
		expect(filter?.[0]).toBe('all');
		expect(filter).toHaveLength(4);
		expect(filter).toContainEqual(['in', ['get', 'osm_value'], ['literal', [1, 2]]]);
		expect(filter).toContainEqual(['>=', ['get', 'size'], 10]);
		expect(filter).toContainEqual(['in', ['get', 'osm_name'], ['literal', ['Parco Valentino']]]);
	});

	it('keeps the size constraint when the type selection changes', () => {
		const before = build_greenareas_filter([0, 1, 2], 576, undefined);
		const after = build_greenareas_filter([0, 1], 576, undefined);
		for (const f of [before, after]) expect(f).toContainEqual(['>=', ['get', 'size'], 576]);
	});

	it('omits controls that are not filtering', () => {
		expect(build_greenareas_filter(undefined, undefined, undefined)).toBeNull();
		// A minimum of zero excludes nothing, so it must not add a condition that
		// would drop features with no size at all.
		expect(build_greenareas_filter(undefined, 0, undefined)).toBeNull();
		expect(build_greenareas_filter(undefined, NaN, undefined)).toBeNull();
	});

	it('treats an empty selection as "match nothing", not "match everything"', () => {
		// Deselecting every type must empty the map, not silently show all of it —
		// the same inversion that get_green_types_code used to produce.
		expect(build_greenareas_filter([], undefined, undefined)).toEqual([
			'all',
			['in', ['get', 'osm_value'], ['literal', []]]
		]);
	});
});
