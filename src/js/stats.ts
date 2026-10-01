/**
 * The statistics behind the Compare view: pair two indexes cell by cell, and
 * class each one's values into natural-break groups.
 */
import { range, scaleThreshold } from 'd3';
import { ckmeans } from 'simple-statistics';

/**
 * One index's values in `groups` natural-break classes (ckmeans): the class
 * bounds, each value's class, and how many values fall in each.
 *
 * The map's colours and the group bar under it both read `group`, so a cell and
 * its bar always agree. They used to disagree at every break: the colours took
 * a class's lowest value into that class, while the bar's own bucketing put it
 * in the class below. The colour scale also had one colour too few, so the
 * city's top value had none.
 */
export function classify(values: number[], groups: number) {
	// ckmeans cannot make more classes than there are distinct values.
	const clusters = ckmeans(values, Math.max(1, Math.min(groups, new Set(values).size)));
	const breaks = [...clusters.map((c) => c[0]), clusters[clusters.length - 1].at(-1) as number];
	const group = scaleThreshold<number, number>()
		.domain(breaks.slice(1, -1))
		.range(range(clusters.length));
	const freq: number[] = new Array(clusters.length).fill(0);
	for (const v of values) freq[group(v)] += 1;
	return { breaks, group, freq };
}

/** A grid cell's value in each of the two indexes being compared. */
export interface JoinedCell {
	x: number;
	y: number;
	a: number;
	b: number;
}

/**
 * Pair up two indexes cell by cell.
 *
 * Compare used to zip the two value arrays by position after filtering each one
 * independently for `v >= 0`. That is only valid if both describe the same cells
 * in the same order, and they do not: different indexes cover different numbers
 * of cells (Turin: 3,755 for WHO against 3,867 for BE3), so past the first
 * divergence every pair compared two different places, and the surplus was
 * silently dropped by the shorter array.
 *
 * Features carry no stable `id` property — only `x`, `y` and `v` — so the grid
 * coordinates are the join key. Cells missing from either side, or flagged
 * no-data on either side, are excluded: a comparison needs both halves.
 */
export function join_on_cell(
	featuresA: { properties: { x: number; y: number; v: number } }[],
	featuresB: { properties: { x: number; y: number; v: number } }[]
): JoinedCell[] {
	const byCell = new Map<string, number>();
	for (const f of featuresA ?? []) {
		const { x, y, v } = f.properties;
		if (v >= 0) byCell.set(`${x}:${y}`, v);
	}

	const joined: JoinedCell[] = [];
	for (const f of featuresB ?? []) {
		const { x, y, v } = f.properties;
		if (v < 0) continue;
		const a = byCell.get(`${x}:${y}`);
		if (a === undefined) continue;
		joined.push({ x, y, a, b: v });
	}
	return joined;
}
