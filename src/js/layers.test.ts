import { describe, expect, it } from 'vitest';
import {
	build_greenareas_filter,
	extent,
	get_colormap_rule,
	is_clamped_high,
	robust_bounds,
	spread,
	to_scale
} from './layers';
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

describe('robust_bounds', () => {
	// A bulk of values with one extreme outlier, the shape every index has.
	const bulk = Array.from({ length: 98 }, (_, i) => i + 1); // 1..98
	const withOutlier = [...bulk, 1000];

	it('clamps an outlier off the top instead of letting it own the palette', () => {
		expect(robust_bounds(withOutlier, 5).max).toBeLessThan(1000);
		// Raw max was 1000; the ramp now ends near the bulk of the data.
		expect(robust_bounds(withOutlier, 5).max).toBeLessThanOrEqual(100);
	});

	it('keeps the target strictly inside the ramp', () => {
		// IPP's real shape: the target sits BELOW the 2nd percentile, so clamping
		// the low end would delete the whole below-target side of the scale.
		const values = [0, 0, 100, 500, 800, 900, 1200, 5000, 40551];
		const { min, max } = robust_bounds(values, 9);
		expect(min).toBeLessThanOrEqual(9);
		expect(max).toBeGreaterThanOrEqual(9);
	});

	it("clamps the long tail that made ESA's ramp useless", () => {
		// ESA's real shape on Turin: 3867 cells, target 0.5 ha, bulk between 0 and
		// ~20, a thin tail out to 35.9. A percentile needs a real sample to mean
		// anything — with a dozen values p98 IS the maximum, and nothing is clipped.
		const bulk = Array.from({ length: 980 }, (_, i) => (i / 979) * 20);
		const tail = Array.from({ length: 20 }, (_, i) => 21 + i * 0.75); // out to 35.9
		const { min, max } = robust_bounds([...bulk, ...tail], 0.5);

		expect(min).toBeLessThanOrEqual(0.5); // the below-target side survives
		expect(max).toBeLessThan(35.9); // the tail no longer owns the palette
		expect(max).toBeGreaterThan(15); // ...but the bulk is still covered
	});

	it('survives empty, non-finite and single-value input', () => {
		expect(robust_bounds([], 5)).toEqual({ min: 0, max: 1 });
		expect(robust_bounds([NaN, Infinity], 5)).toEqual({ min: 0, max: 1 });
		const one = robust_bounds([7, 7, 7], 7);
		expect(one.min).toBe(7);
		expect(one.max).toBe(7);
	});

	it('reports when the top was clipped, so the legend can say so', () => {
		expect(is_clamped_high(withOutlier, 5)).toBe(true);
		expect(is_clamped_high(bulk.slice(0, 5), 3)).toBe(false);
	});
});
