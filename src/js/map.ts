/*
	The one place a map library is imported. Every component goes through this
	module, which is what made replacing Mapbox a contained change.

	MapLibre GL JS is the BSD-licensed community fork of mapbox-gl v1, maintained
	by the MapLibre organisation under the Linux Foundation. It replaces
	mapbox-gl 2.15, whose licence forbids use without a Mapbox account and token,
	and whose token was embedded in this public bundle with no URL restriction —
	unmetered quota billed to the university.
*/
import 'maplibre-gl/dist/maplibre-gl.css';
import * as maplibregl from 'maplibre-gl';
// `?worker&url` makes Vite bundle the worker WITH its own imports into a single
// file and hand back that file's URL. MapLibre 6 ships its worker as a module
// that imports `./maplibre-gl-shared.mjs`, and locates it with
// `new URL(variable, import.meta.url)` — a pattern Vite cannot rewrite, because
// the first argument is not a string literal. Left alone, the production build
// would request a worker that was never emitted and every map would stay blank.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

// Browser-only: the module is also evaluated during server rendering, where
// there is no worker to configure.
if (typeof window !== 'undefined') {
	maplibregl.setWorkerUrl(workerUrl);
}

/*
	The basemap: OpenFreeMap's dark style (https://openfreemap.org).

	OpenStreetMap vector tiles, free, with no API key, no account and no usage
	limits. Everything — style, tiles, glyphs, sprites — comes from one host,
	tiles.openfreemap.org, which the site's Content-Security-Policy has to allow
	in connect-src and img-src; without that the basemap is blocked in
	production while working fine on the dev server, which has no CSP.

	The trade-off, chosen deliberately: every visitor's browser contacts
	OpenFreeMap as they pan, and the service is donation-funded with no uptime
	guarantee. If it is down, the basemap is down — the accessibility data is
	drawn from this site's own /rpc/ and still renders. Self-hosting is the
	alternative, measured at ~5.8 GB for street detail around every city plus
	the world at globe zooms; docs/BASEMAP.md has the numbers.
*/
export const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/dark';

/*
	Glyph stack every data label uses. OpenFreeMap serves Noto Sans Regular —
	it is the one font its dark style uses. A symbol layer that names no font falls back to "Open Sans Regular,
	Arial Unicode MS Regular" — Mapbox glyph names that neither open font set
	provides — so its labels would render as nothing, with no error.
*/
export const LABEL_FONT = ['Noto Sans Regular'];

export function get_default_map_props(
	container: string,
	center: maplibregl.LngLatLike
): maplibregl.MapOptions {
	return {
		style: BASEMAP_STYLE,
		zoom: 10,
		bearing: 0,
		pitch: 0,
		container: container,
		center: center,
		attributionControl: { compact: true }
	};
}

/**
 * The popup every data layer shows on hover: no close button, no click to
 * dismiss; it follows the pointer's feature and goes when the pointer leaves.
 * Its look is set once, in app.css.
 */
export function hover_popup() {
	return new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });
}

/**
 * Hover feedback for one layer: the pointer cursor, and a `hover` feature-state
 * on the feature under the pointer that moves with it and clears when it leaves.
 *
 * `on_change(feature, event)` hears each change of feature, and
 * `on_change(undefined)` the leave: the moment to show or drop a popup. The
 * listeners go with the map (`map.remove()`), so there is nothing to undo.
 *
 * This replaces four hand-written copies, which kept the hovered id in a
 * variable seeded with 0 and read 0 as "nothing hovered" — but `generateId`
 * numbers features from 0, so the first feature's hover state never cleared.
 */
export function track_hover(
	map: maplibregl.Map,
	layer: string,
	source: string,
	on_change?: (
		feature: maplibregl.MapGeoJSONFeature | undefined,
		event?: maplibregl.MapLayerMouseEvent
	) => void
): { clear: () => void } {
	let hovered: string | number | undefined;
	const clear = () => {
		if (hovered !== undefined && map.getSource(source))
			map.setFeatureState({ source, id: hovered }, { hover: false });
		hovered = undefined;
	};
	map.on('mousemove', layer, (e) => {
		const feature = e.features?.[0];
		if (!feature || feature.id === hovered) return;
		clear();
		hovered = feature.id;
		map.setFeatureState({ source, id: hovered }, { hover: true });
		map.getCanvas().style.cursor = 'pointer';
		on_change?.(feature, e);
	});
	map.on('mouseleave', layer, () => {
		map.getCanvas().style.cursor = '';
		clear();
		on_change?.(undefined);
	});
	return { clear };
}

export { maplibregl };
