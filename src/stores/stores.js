import { writable } from 'svelte/store';

export const current_city = writable();
export const current_accessibility_index = writable();
export const current_accessibility_index_data = writable();
export const current_cell = writable();
export const loading = writable(false);
export const hovered_feature = writable();