/**
 * Binning and transition-counting helpers for the Compare view.
 *
 * Extracted verbatim from Compare.svelte so they can be unit tested. Behaviour is
 * deliberately unchanged here, including the known defects the tests document —
 * those are fixed separately, with the tests flipping from `.fails` to passing.
 * The only change is that `get_frequencies` now takes `nbreaks` as an argument
 * instead of reading it from the component's `props` object.
 */

/** Index of the class `v` falls into, given ascending `breaks`. */
export function get_bucket(v: number, breaks: number[]): number {
	for (let i = 0; i < breaks.length - 1; i++) {
		if (v <= breaks[i + 1]) return i;
	}
	// Anything above the last break falls in the top class. The old code returned
	// 0 here — the *lowest* class — so a value outside the range the breaks were
	// computed from was drawn as its own opposite.
	return Math.max(0, breaks.length - 2);
}

export function get_buckets(values: number[], breaks: number[]): number[] {
	return values.map((v: number) => get_bucket(v, breaks));
}

/** Histogram over bucket indices. Length is `nbreaks + 1`. */
export function get_frequencies(array: number[], nbreaks: number): number[] {
	const frequencies: number[] = new Array(nbreaks + 1).fill(0);
	array.forEach((element) => {
		frequencies[element] += 1;
	});
	return frequencies;
}

/** Sum of the first `k` entries. */
export function sum_k(array: number[], k: number): number {
	if (k == 0) return 0;

	let acc = 0;
	for (let index = 0; index < k; index++) {
		acc += array[index];
	}
	return acc;
}

/**
 * Count how many cells move from each bucket in `arr1` to each bucket in `arr2`,
 * pairing them **by array position**.
 *
 * That pairing is only meaningful when both arrays describe the same cells in the
 * same order, which in the Compare view they do not: the two value arrays are
 * filtered independently, and different indexes cover different numbers of cells
 * (Turin: 3,755 for WHO, 3,867 for BE3). See the tests.
 */
export function count_transictions(
	arr1: number[],
	arr2: number[]
): Record<number, Record<number, number>> {
	const flows: Record<number, Record<number, number>> = {};

	if (arr1 && arr2) {
		for (let i = 0; i < arr1.length; i++) {
			const v1: number = arr1[i];
			const v2: number = arr2[i];

			if (v1 >= 0 && v2 >= 0)
				if (!(v1 in flows)) {
					flows[v1] = {};
					flows[v1][v2] = 1;
				} else {
					if (!(v2 in flows[v1])) flows[v1][v2] = 1;
					else flows[v1][v2] += 1;
				}
		}
	}

	return flows;
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
