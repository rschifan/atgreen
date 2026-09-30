<script lang="ts">
	import type * as GeoJSON from 'geojson';
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	import { apply_globe_style } from '../../js/globe_styles';
	import { LABEL_FONT, maplibregl } from '../../js/map';
	import { toCityPath } from '../../js/slug';
	import { globe_style } from '../../stores/settings';

	export let map: maplibregl.Map;
	export let data: GeoJSON.FeatureCollection;
	export let userInteracting: boolean;

	const empty_geojson: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
	const SUMMARY_SOURCE = 'SUMMARY_SOURCE';
	// The hit target round each city, invisible until hovered: a 2px dot is too
	// small to point at, this is not. Hovered, it glows green.
	const SUMMARY_HALO = 'SUMMARY_HALO';
	const SUMMARY_LAYER = 'SUMMARY_LAYER';
	const CITY_LABEL_LAYER = 'CITY_LABEL_LAYER';

	const hover: maplibregl.ExpressionSpecification = ['boolean', ['feature-state', 'hover'], false];

	let hovered_id: string | number | undefined;
	// Stops whatever the globe style keeps running (the pings animation).
	let stop_style = () => {};

	// Names come underscore-separated from the API ("Los_Angeles").
	const display_name = (name: string) => String(name ?? '').replaceAll('_', ' ');

	// setText, never setHTML: the name comes from the database.
	const popup = new maplibregl.Popup({
		closeButton: false,
		closeOnClick: false,
		offset: 10,
		className: 'city-tip'
	});

	function set_hover(id: string | number | undefined) {
		if (hovered_id !== undefined)
			map.setFeatureState({ source: SUMMARY_SOURCE, id: hovered_id }, { hover: false });
		hovered_id = id;
		if (id !== undefined) map.setFeatureState({ source: SUMMARY_SOURCE, id }, { hover: true });
	}

	onMount(() => {
		if (!map.getSource(SUMMARY_SOURCE))
			map.addSource(SUMMARY_SOURCE, {
				type: 'geojson',
				data: data ? data : empty_geojson
			});

		if (!map.getLayer(SUMMARY_HALO))
			map.addLayer({
				id: SUMMARY_HALO,
				type: 'circle',
				source: SUMMARY_SOURCE,
				paint: {
					'circle-radius': ['interpolate', ['exponential', 1.75], ['zoom'], 1, 7, 10, 60],
					'circle-color': '#42be65',
					'circle-blur': 1,
					'circle-opacity': ['case', hover, 0.95, 0]
				}
			});

		if (!map.getLayer(SUMMARY_LAYER))
			map.addLayer({
				id: SUMMARY_LAYER,
				type: 'circle',
				source: SUMMARY_SOURCE,
				paint: {
					'circle-radius': [
						'interpolate',
						['exponential', 1.75],
						['zoom'],
						1,
						['case', hover, 4, 1.7],
						10,
						50
					],
					'circle-color': '#ffffff',
					'circle-opacity': ['case', hover, 1, 0.85],
					'circle-stroke-color': 'rgba(0, 0, 0, 0.6)',
					'circle-stroke-width': 0.5
				}
			});

		// The look chosen on the Settings page, built on the layers above.
		stop_style = apply_globe_style(
			map,
			$globe_style,
			{ source: SUMMARY_SOURCE, halo: SUMMARY_HALO, core: SUMMARY_LAYER, hover, cities: data },
			matchMedia('(prefers-reduced-motion: reduce)').matches
		);

		// Names appear once the view is close enough to read them — during the
		// flight into a city, or when a user zooms in.
		if (!map.getLayer(CITY_LABEL_LAYER))
			map.addLayer({
				id: CITY_LABEL_LAYER,
				type: 'symbol',
				source: SUMMARY_SOURCE,
				minzoom: 3.5,
				layout: {
					'text-field': ['get', 'name'],
					'text-font': LABEL_FONT,
					'text-justify': 'auto',
					'text-variable-anchor': ['top', 'left', 'bottom', 'right'],
					'text-radial-offset': 0.6,
					// Was a legacy `{ base, stops }` zoom function, deprecated in the style
					// spec and rejected by MapLibre's types; this is the same curve.
					'text-size': ['interpolate', ['exponential', 1.75], ['zoom'], 2, 12, 10, 20, 20, 30]
				},
				paint: {
					'text-halo-width': 1.2,
					'text-halo-color': 'rgba(0, 0, 0, 0.85)',
					'text-color': '#f4f4f4'
				}
			});

		/*
			A city on the globe is a link to that city. Selecting one is a
			navigation, exactly like picking it in the search — this used to set
			`current_city` and stop there, which since the move to URL routing
			changed the header and nothing else.
		*/
		map.on('click', SUMMARY_HALO, (e: maplibregl.MapLayerMouseEvent) => {
			const name = e.features?.[0]?.properties?.name;
			if (name) goto(resolve('/[city]/measure', { city: toCityPath(name) }));
		});

		map.on('mousemove', SUMMARY_HALO, (e: maplibregl.MapLayerMouseEvent) => {
			const feature = e.features?.[0];
			// Only on entering a new city: re-adding the popup on every mousemove
			// would rebuild its DOM each time.
			if (!feature || feature.id === hovered_id || !map.getSource(SUMMARY_SOURCE)) return;
			/*
				Hold the globe still under the pointer: no new spin (userInteracting),
				and stop the one in progress. Otherwise the current one-second spin
				step carries the dot out from under a still cursor while its name is
				still showing, and the click lands on empty ground.
			*/
			userInteracting = true;
			map.stop();
			map.getCanvas().style.cursor = 'pointer';
			set_hover(feature.id);
			if (feature.geometry.type === 'Point')
				popup
					.setLngLat(feature.geometry.coordinates as [number, number])
					.setText(display_name(feature.properties?.name))
					.addTo(map);
		});

		map.on('mouseleave', SUMMARY_HALO, () => {
			map.getCanvas().style.cursor = '';
			if (map.getSource(SUMMARY_SOURCE)) set_hover(undefined);
			popup.remove();
			userInteracting = false;
		});
	});

	onDestroy(() => {
		stop_style();
		popup.remove();

		// The parent map component may already have called map.remove(), after which
		// every method below throws and takes the rest of the teardown with it. The
		// map.off(type, layerId) calls that used to be here removed nothing anyway:
		// Mapbox reads a two-argument off() as (type, listener), so a layer-id string
		// matched no registered handler. map.remove() drops all of them at once.
		try {
			for (const layer of [CITY_LABEL_LAYER, SUMMARY_LAYER, SUMMARY_HALO]) {
				if (map?.getLayer(layer)) map.removeLayer(layer);
			}
			if (map?.getSource(SUMMARY_SOURCE)) map.removeSource(SUMMARY_SOURCE);
		} catch {
			/* map already destroyed */
		}
	});
</script>

<style>
	/* The city name on hover: a small dark chip, readable over land and sea. */
	:global(.city-tip .maplibregl-popup-content) {
		padding: 0.375rem 0.625rem;
		border-radius: 4px;
		background: rgba(14, 20, 26, 0.92);
		color: #f4f4f4;
		font:
			500 0.8125rem/1.2 'IBM Plex Sans',
			'Helvetica Neue',
			Arial,
			sans-serif;
		letter-spacing: 0.01em;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
		pointer-events: none;
	}
	:global(.city-tip .maplibregl-popup-tip) {
		display: none;
	}
</style>
