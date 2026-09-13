import { describe, expect, it } from 'vitest';
import {
	count_transictions,
	get_bucket,
	get_buckets,
	get_frequencies,
	join_on_cell,
	sum_k
} from './stats';

describe('get_bucket', () => {
	const breaks = [0, 10, 20, 30, 40]; // 4 classes: [0,10] (10,20] (20,30] (30,40]

	it('places a value in the class whose upper bound it first falls under', () => {
		expect(get_bucket(0, breaks)).toBe(0);
		expect(get_bucket(10, breaks)).toBe(0);
		expect(get_bucket(10.1, breaks)).toBe(1);
		expect(get_bucket(20, breaks)).toBe(1);
		expect(get_bucket(40, breaks)).toBe(3);
	});

	// Known defect: a value above the last break falls through the loop and returns 0,
	// the *lowest* class, rather than the highest. Reachable whenever the breaks are
	// computed from one dataset and applied to another.
	it('puts a value above the last break in the highest class', () => {
		expect(get_bucket(99, breaks)).toBe(3);
	});
});

describe('get_buckets', () => {
	it('maps every value through get_bucket', () => {
		expect(get_buckets([5, 15, 25], [0, 10, 20, 30])).toEqual([0, 1, 2]);
	});

	it('returns an empty array for no values', () => {
		expect(get_buckets([], [0, 10])).toEqual([]);
	});
});

describe('get_frequencies', () => {
	it('counts how many values landed in each class', () => {
		expect(get_frequencies([0, 0, 1, 2, 2, 2], 4)).toEqual([2, 1, 3, 0, 0]);
	});

	it('allocates nbreaks + 1 slots', () => {
		expect(get_frequencies([], 4)).toHaveLength(5);
	});
});

describe('sum_k', () => {
	it('sums the first k entries', () => {
		expect(sum_k([1, 2, 3, 4], 0)).toBe(0);
		expect(sum_k([1, 2, 3, 4], 1)).toBe(1);
		expect(sum_k([1, 2, 3, 4], 4)).toBe(10);
	});
});

describe('count_transictions', () => {
	it('counts movements between buckets, pairing by position', () => {
		//      cell: 0  1  2  3
		const a = [0, 0, 1, 2];
		const b = [0, 1, 1, 2];
		expect(count_transictions(a, b)).toEqual({
			0: { 0: 1, 1: 1 },
			1: { 1: 1 },
			2: { 2: 1 }
		});
	});

	it('ignores pairs where either side is negative (no-data)', () => {
		expect(count_transictions([-1, 0], [0, 0])).toEqual({ 0: { 0: 1 } });
		expect(count_transictions([0, 0], [-2, 0])).toEqual({ 0: { 0: 1 } });
	});

	it('tolerates empty input', () => {
		expect(count_transictions([], [])).toEqual({});
	});

	// Pairing by position is only valid when both arrays describe the same cells in the
	// same order. In Compare.svelte they do not: each index's values are filtered for
	// >= 0 independently, and different indexes cover different cell counts (Turin:
	// 3,755 for WHO vs 3,867 for BE3). The extra entries are silently dropped and every
	// pair after the first divergence compares two *different* places.
	it('silently truncates to the shorter array - the reason Compare must join on (x, y)', () => {
		const flows = count_transictions([0, 1, 2], [0, 1]);
		expect(flows).toEqual({ 0: { 0: 1 }, 1: { 1: 1 } });
		// the third cell contributed nothing, with no error and no warning
	});
});

describe('join_on_cell', () => {
	const cell = (x: number, y: number, v: number) => ({ properties: { x, y, v } });

	it('pairs cells by their grid coordinates', () => {
		const a = [cell(1, 1, 10), cell(1, 2, 20)];
		const b = [cell(1, 2, 200), cell(1, 1, 100)]; // deliberately a different order
		expect(join_on_cell(a, b)).toEqual([
			{ x: 1, y: 2, a: 20, b: 200 },
			{ x: 1, y: 1, a: 10, b: 100 }
		]);
	});

	// The bug this replaces. Zipping by position paired WHO's cell 3 with BE3's
	// cell 3 even when those were different places, because the two indexes cover
	// different cell counts (Turin: 3,755 against 3,867).
	it('keeps only cells present in both indexes', () => {
		const a = [cell(1, 1, 10), cell(1, 2, 20), cell(9, 9, 90)];
		const b = [cell(1, 1, 100), cell(1, 2, 200)];
		const joined = join_on_cell(a, b);
		expect(joined).toHaveLength(2);
		expect(joined.map((d) => [d.x, d.y])).toEqual([
			[1, 1],
			[1, 2]
		]);
	});

	it('drops no-data cells from either side', () => {
		const a = [cell(1, 1, -2), cell(1, 2, 20)];
		const b = [cell(1, 1, 100), cell(1, 2, -1)];
		expect(join_on_cell(a, b)).toEqual([]);
	});

	it('never mispairs, however the inputs are ordered', () => {
		const a = [cell(3, 3, 33), cell(1, 1, 11), cell(2, 2, 22)];
		const b = [cell(2, 2, 220), cell(3, 3, 330), cell(1, 1, 110)];
		for (const d of join_on_cell(a, b)) {
			expect(d.b, `cell ${d.x},${d.y}`).toBe(d.a * 10);
		}
	});

	it('tolerates empty or missing input', () => {
		expect(join_on_cell([], [])).toEqual([]);
		expect(join_on_cell(undefined as never, undefined as never)).toEqual([]);
	});
});
