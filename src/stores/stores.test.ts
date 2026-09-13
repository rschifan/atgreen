import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { loading } from './stores';

describe('loading store', () => {
	it('starts idle', () => {
		loading.reset();
		expect(get(loading)).toBe(false);
	});

	it('is busy while a request is outstanding', () => {
		loading.reset();
		loading.set(true);
		expect(get(loading)).toBe(true);
		loading.set(false);
		expect(get(loading)).toBe(false);
	});

	// The bug this replaces: as a plain boolean, the first of several concurrent
	// responses set it false and the overlay vanished while the rest were still
	// running. Selecting a city fires three requests at once, so this was the
	// normal case rather than an edge one.
	it('stays busy until every concurrent request has finished', () => {
		loading.reset();
		loading.set(true); // city profile
		loading.set(true); // indexes
		loading.set(true); // accessibility grid

		loading.set(false);
		expect(get(loading), 'still busy after 1 of 3 finished').toBe(true);
		loading.set(false);
		expect(get(loading), 'still busy after 2 of 3 finished').toBe(true);
		loading.set(false);
		expect(get(loading), 'idle once all 3 finished').toBe(false);
	});

	// Several call sites clear the flag without having set it. Left unguarded that
	// drives the counter negative, and the next genuine request cannot lift it back
	// above zero — the overlay would never appear again.
	it('cannot be driven negative by an unbalanced clear', () => {
		loading.reset();
		loading.set(false);
		loading.set(false);
		expect(get(loading)).toBe(false);

		loading.set(true);
		expect(get(loading), 'a real request must still show the overlay').toBe(true);
		loading.set(false);
		expect(get(loading)).toBe(false);
	});

	it('reset drops every outstanding ticket', () => {
		loading.reset();
		loading.set(true);
		loading.set(true);
		loading.reset();
		expect(get(loading)).toBe(false);
	});
});
