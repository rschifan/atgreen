import { writable } from 'svelte/store';

export const current_city = writable();
export const current_accessibility_index = writable();
export const current_accessibility_index_data = writable();
export const current_cell = writable();
export const hovered_feature = writable();

/**
 * Whether anything is in flight.
 *
 * This was a plain boolean, which is wrong whenever two requests overlap — the
 * normal case here, since selecting a city fires the city profile, the indexes
 * and the accessibility grid at once. The first response to arrive set it to
 * false and the overlay vanished while the others were still running.
 *
 * It is a counter underneath and a boolean to subscribers, so every existing
 * `loading.set(true)` / `loading.set(false)` call site keeps working: `true`
 * takes a ticket, `false` returns one, and the overlay shows while any ticket is
 * outstanding. The counter is floored at zero so an unbalanced `set(false)` —
 * of which there are a few — cannot drive it negative and wedge the overlay on.
 */
function createLoadingStore() {
	const count = writable(0);

	return {
		subscribe(run) {
			return count.subscribe((n) => run(n > 0));
		},
		set(value) {
			count.update((n) => (value ? n + 1 : Math.max(0, n - 1)));
		},
		/** Drop every outstanding ticket; for teardown, where balance is not guaranteed. */
		reset() {
			count.set(0);
		}
	};
}

export const loading = createLoadingStore();
