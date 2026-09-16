import { ACOLOR_GREEN, ACOLOR_MID, ACOLOR_RED, TEXT_MAP_COLOR } from './colors';
import { ClassificationScheme, AccessibilityIndexType } from './types';

export function get_target_rule(operator: string, threshold: number) {
	return [operator, ['get', 'v'], threshold];
}

/** Min and max in one pass, without spreading the array onto the call stack. */
export function extent(data: number[]): { min: number; max: number } {
	let min = Infinity;
	let max = -Infinity;
	for (const v of data) {
		if (typeof v !== 'number' || Number.isNaN(v)) continue;
		if (v < min) min = v;
		if (v > max) max = v;
	}
	// An empty (or all-NaN) array has no extent; 0..1 keeps the ramp well-formed
	// rather than emitting Infinity into a Mapbox expression.
	if (min === Infinity) return { min: 0, max: 1 };
	return { min, max };
}

/**
 * Value as the colour ramp sees it. In logarithmic mode the old code substituted
 * 0 for a non-positive value, which is log2(1) — a silent lie about where the
 * value sits. Non-positive values have no logarithm, so they clamp to the
 * smallest positive value the scale can express instead.
 */
export function to_scale(v: number, classification: string): number {
	if (classification !== ClassificationScheme.LOGARITHMIC) return v;
	if (!Number.isFinite(v) || v <= 0) return 0;
	return Math.log2(v);
}

/** Force three stops to be strictly ascending, preserving order. */
export function spread(a: number, b: number, c: number): [number, number, number] {
	const eps = Math.max(Math.abs(c - a), 1) * 1e-6;
	const mid = b <= a ? a + eps : b;
	const high = c <= mid ? mid + eps : c;
	return [a, mid, high];
}

export function get_colormap_rule(
	data: number[],
	type: AccessibilityIndexType,
	classification: string,
	threshold: number
) {
	// `Math.max(...data)` passes every value as an argument. Measured on node 22:
	// 100,000 arguments is fine, 125,000 throws "Maximum call stack size exceeded".
	// Grids are in the thousands today (Milan, the largest checked, is 13,220), so
	// this was a cliff roughly one large city away, presenting as a blank map.
	const { min, max } = extent(data);

	const low = to_scale(min, classification);
	const high = to_scale(max, classification);
	// Mapbox requires strictly ascending stops. The threshold is a target, not a
	// property of the data, so a city whose values all beat it (max < threshold) or
	// all miss it (threshold < min) produced a non-ascending ramp and the whole
	// layer failed to paint. Clamp it inside the range, and nudge a degenerate
	// range apart so min < mid < max always holds.
	const mid = Math.min(Math.max(to_scale(threshold, classification), low), high);
	const [a, b, c] = spread(low, mid, high);

	return [
		'interpolate',
		['linear'],

		classification == ClassificationScheme.LINEAR ? ['get', 'v'] : ['log2', ['get', 'v']],

		a,
		type == AccessibilityIndexType.MINIMUM_DISTANCE ? ACOLOR_GREEN : ACOLOR_RED,
		b,
		ACOLOR_MID,
		c,
		type == AccessibilityIndexType.MINIMUM_DISTANCE ? ACOLOR_RED : ACOLOR_GREEN
	];
}

export function get_accessibility_layer_fill_color(
	data: number[],
	type: AccessibilityIndexType,
	classification: string,
	threshold: number
) {
	return [
		'case',
		['==', ['feature-state', 'hover'], true],
		'white',
		['==', ['feature-state', 'selected'], true],
		'#AF5D63',
		get_colormap_rule(data, type, classification, threshold)
	];
}

export function get_accessibility_layer_fill_opacity() {
	return ['interpolate', ['linear'], ['zoom'], 10, 1, 17, 0];
}

// export function get_accessibility_layer_fill_opacity(
//     predicate: string, threshold: number
// ) {

// return [
// 'case',
// ['==', ['feature-state', 'selected'], true],
// 0.4,
// ['==', ['feature-state', 'hover'], true],
// 1.0,
// ['case', get_target_rule(predicate, threshold), 0.8, 0.4]
// ]
// }
