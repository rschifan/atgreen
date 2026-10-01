import { describe, expect, it } from 'vitest';
import { classify, join_on_cell } from './stats';

describe('classify', () => {
	const values = [1, 2, 3, 10, 11, 12, 50, 51, 100, 101];

	it('makes the classes it is asked for, with bounds from the lowest value to the highest', () => {
		const { breaks, freq } = classify(values, 4);
		expect(freq).toHaveLength(4);
		expect(breaks[0]).toBe(1);
		expect(breaks.at(-1)).toBe(101);
	});

	it('counts every value exactly once', () => {
		const { freq } = classify(values, 4);
		expect(freq.reduce((a, b) => a + b, 0)).toBe(values.length);
	});

	// The defect it replaces: a class's lowest value was counted in the class below.
	it('puts the lowest value of each class in that class', () => {
		const { breaks, group } = classify(values, 4);
		for (let k = 1; k < 4; k++) expect(group(breaks[k])).toBe(k);
	});

	it('gives the highest value the top class', () => {
		const { group } = classify(values, 4);
		expect(group(101)).toBe(3);
	});

	it('makes fewer classes when there are fewer distinct values', () => {
		expect(classify([5, 5, 7], 4).freq).toEqual([2, 1]);
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
