import bbox from '@turf/bbox';
import type { mapbox } from './mapbox';

/**
 * The bounds each map was last fitted to, so a container resize can re-apply
 * them. A WeakMap keyed on the map instance means a torn-down map takes its
 * entry with it.
 */
const LAST_FIT = new WeakMap<mapbox.Map, [number, number, number, number]>();

/**
 * Padding scaled to the viewport rather than a flat 100px.
 *
 * A fixed 100px was 20% of a 1024px-wide map and 28% of the 724px stage the
 * rail layout leaves, so the same data drew visibly smaller after the redesign.
 * A twelfth of the smaller dimension keeps the framing constant at any size,
 * and is floored so a very small map still gets breathing room.
 */
function fit_padding(map: mapbox.Map) {
	const c = map.getCanvas();
	return Math.max(24, Math.round(Math.min(c.clientWidth, c.clientHeight) / 12));
}

function fit(map: mapbox.Map, bb: [number, number, number, number], animate: boolean) {
	const padding = fit_padding(map);
	map.fitBounds(bb, {
		maxZoom: 14,
		padding: { top: padding, bottom: padding, left: padding, right: padding },
		pitch: 0,
		bearing: 0,
		animate
	});
}

export function adjust_zoom(data: any, map: mapbox.Map, animate = false) {
	if (!map) return;
	try {
		if (data && data.features && data.features.length > 0) {
			const bb = bbox(data) as [number, number, number, number];
			LAST_FIT.set(map, bb);
			fit(map, bb, animate);
		}
	} catch (error) {
		// Reported, not swallowed: a map that silently fails to frame its data is
		// the failure mode this codebase keeps producing. `console.error` survives
		// the build deliberately, and the e2e suite asserts on it.
		console.error('adjust_zoom:', error);
	}
}

/**
 * Re-apply the last fit after the container changed size.
 *
 * `map.resize()` tells the map its viewport grew; it does not re-frame what is
 * in it. So the first fit — which ran while the stage was still settling, or
 * before the window was dragged wider — stayed, and the data sat small in a
 * large map. Nothing re-fitted on resize before this.
 */
export function refit_zoom(map: mapbox.Map) {
	const bb = map && LAST_FIT.get(map);
	if (bb) {
		try {
			fit(map, bb, false);
		} catch (error) {
			console.error('refit_zoom:', error);
		}
	}
}

export function get_green_types_code(green_types: []) {
	// An empty selection used to join to '', match no case, and fall through to the
	// default 0 — which is the code for *all three* types. Deselecting everything
	// therefore asked for everything. Undefined lets the caller refuse the request
	// rather than silently invert it.
	if (green_types && green_types.length === 0) return undefined;
	if (green_types) {
		const types = green_types.join(',');
		switch (types) {
			case 'forests,grass,parks':
				return 0;
			case 'forests,parks':
				return 1;
			case 'grass,parks':
				return 2;
			case 'parks':
				return 3;
			case 'forests,grass':
				return 4;
			case 'forests':
				return 5;
			case 'grass':
				return 6;
		}
		return 0;
	}
}

export function create_empty_geojson() {
	return { type: 'FeatureCollection', features: [] };
}

export function create_geojson(features: []) {
	return { type: 'FeatureCollection', features: features };
}
