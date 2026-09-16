<script lang="ts">
	import { FitToScreen, View, ViewOff } from 'carbon-icons-svelte';
	import { format } from 'd3';
	import { afterUpdate, onDestroy, onMount, setContext } from 'svelte';
	import type { Unsubscriber } from 'svelte/store';
	import { BOUNDARY_MAP_COLOR } from '../../js/colors';
	import { build_greenareas_filter } from '../../js/layers';
	import { get_default_map_props, key, mapbox } from '../../js/mapbox.js';
	import { adjust_zoom, create_empty_geojson, refit_zoom, html } from '../../js/utils';
	import { current_city } from '../../stores/stores.js';
	import ButtonMap from './ButtonMap.svelte';

	export let mapLoaded = false;
	export let styleLoaded = false;
	let height: number;
	export let container: string;
	export let ref: object;
	export let data: object;
	export let green_types: [];
	export let minimum_size: number;
	export let selected_green_areas: [];

	let selected_feature: object | undefined = undefined;
	let width = 0;

	const GREENAREAS_SOURCE = 'GREENAREAS_SOURCE';
	const GREENAREAS_LAYER = 'GREENAREAS_LAYER';
	const GREENAREAS_LABELS_LAYER = 'GREENAREAS_LABELS_LAYER';

	let colors = ['#74c476', '#31a354', '#006d2c', 'white'];
	let green_types_dict = {
		0: 'village_green',
		1: 'garden',
		2: 'park',
		3: 'recreation_ground',
		4: 'grass',
		5: 'shrubbery',
		6: 'grassland',
		7: 'meadow',
		8: 'wood',
		9: 'forest'
	};
	let visibilityToggle = true;
	let hovered_accessibility_cell_id = 0;
	let map: mapbox.Map;

	const popup = new mapbox.Popup({
		closeButton: false,
		closeOnClick: false
	});

	const osm2element = {
		0: 'way',
		1: 'relation'
	};

	$: if (width && height && map) {
		map.resize();
		refit_zoom(map);
	}

	$: if (data && data.features && data.features.length > 0) {
		const green_areas_source = map?.getSource(GREENAREAS_SOURCE);
		if (green_areas_source) {
			green_areas_source.setData(data);
			adjust_zoom(data, map);
		}
	}

	/*
		ONE filter, not three. Each control used to call `setFilter` from its own
		reactive block with a complete replacement expression, and `setFilter` does
		not merge — so whichever block ran last silently discarded the others.
		Reproduced on production: set the slider to "576 ha and larger", untick one
		type, and every small area returns while the slider still reads 576.

		`build_greenareas_filter` composes them and is unit tested without a map.
	*/
	$: apply_filter(map, green_types, minimum_size, selected_green_areas);

	function apply_filter(
		target: mapbox.Map | undefined,
		types: number[] | undefined,
		min_size: number | undefined,
		names: string[] | undefined
	) {
		if (!target) return;
		const filter = build_greenareas_filter(types, min_size, names);
		for (const layer of [GREENAREAS_LAYER, GREENAREAS_LABELS_LAYER]) {
			if (target.getLayer(layer)) target.setFilter(layer, filter);
		}
	}

	onMount(() => {
		init();
	});

	onDestroy(() => {
		// Mapbox holds a WebGL context, tile workers and XHR queues; none of it is
		// released by dropping the DOM node. Browsers cap simultaneous contexts and
		// silently kill the oldest, which surfaces later as a blank map far from the
		// cause. Now that tabs mount lazily, maps are created and destroyed often, so
		// this matters more than when all six lived for the page's lifetime.
		map?.remove();
	});

	afterUpdate(() => {
		if (data && map) adjust_zoom(data, map, false);
	});

	function init() {
		map = new mapbox.Map(
			get_default_map_props(container, $current_city.feature.geometry.coordinates)
		);
		ref = map;

		map.on('style.load', () => {
			styleLoaded = true;

			if (!map.getSource(GREENAREAS_SOURCE))
				map.addSource(GREENAREAS_SOURCE, {
					type: 'geojson',
					data: data ? data : create_empty_geojson(),
					generateId: true
				});
			else map.getSource(GREENAREAS_SOURCE).setData(data);

			if (!map.getLayer(GREENAREAS_LAYER))
				map.addLayer({
					id: GREENAREAS_LAYER,
					type: 'fill',
					source: GREENAREAS_SOURCE,
					paint: {
						'fill-color': ['case', ['==', ['feature-state', 'hover'], true], 'white', colors[0]],
						'fill-opacity': 0.4
					}
				});
			if (!map.getLayer(GREENAREAS_LABELS_LAYER))
				map.addLayer({
					id: GREENAREAS_LABELS_LAYER,
					type: 'symbol',
					source: GREENAREAS_SOURCE,
					layout: {
						'text-field': ['get', 'osm_name'],
						'text-justify': 'auto',
						'text-size': {
							stops: [
								[0, 10],
								[22, 14]
							]
						}
					},
					paint: {
						'text-halo-width': 1,
						'text-halo-color': BOUNDARY_MAP_COLOR,
						'text-color': 'white'
					}
				});
		});

		map.on('load', async () => {
			mapLoaded = true;
		});

		map.on('click', GREENAREAS_LAYER, (e) => {
			if (e.features && e.features.length > 0) {
				popup?.remove();

				let current_feature = e.features[0];

				window.open(
					`https://www.openstreetmap.org/${osm2element[current_feature.properties.osm_element]}/${
						current_feature.properties.osm_id
					}`,
					'_blank'
				);
			}
		});

		map.on('mouseenter', GREENAREAS_LAYER, (e: mapbox.MapMouseEvent) => {
			if (!e.features || e.features.length <= 0) return;

			let current_feature = e.features[0];
			let cell_id = current_feature.id;

			map.getCanvas().style.cursor = 'pointer';

			if (hovered_accessibility_cell_id && hovered_accessibility_cell_id != 0) {
				map.setFeatureState(
					{ source: GREENAREAS_SOURCE, id: hovered_accessibility_cell_id },
					{ hover: false }
				);
			}
			map.setFeatureState({ source: GREENAREAS_SOURCE, id: cell_id }, { hover: true });

			hovered_accessibility_cell_id = cell_id;

			selected_feature = current_feature;

			update_popup(selected_feature, e);
		});

		map.on('mouseleave', GREENAREAS_LAYER, () => {
			map.getCanvas().style.cursor = '';

			if (map && map.getSource(GREENAREAS_SOURCE))
				map.setFeatureState(
					{ source: GREENAREAS_SOURCE, id: hovered_accessibility_cell_id },
					{ hover: false }
				);
			hovered_accessibility_cell_id = 0;
			selected_feature = undefined;
			popup?.remove();
		});

		map.on('mousemove', GREENAREAS_LAYER, (e: mapbox.MapMouseEvent) => {
			if (!e.features || e.features.length <= 0) return;

			let current_feature = e.features[0];
			let cell_id = current_feature.id;

			if (hovered_accessibility_cell_id != 0) {
				map.setFeatureState(
					{ source: GREENAREAS_SOURCE, id: hovered_accessibility_cell_id },
					{ hover: false }
				);
			}
			map.setFeatureState({ source: GREENAREAS_SOURCE, id: cell_id }, { hover: true });
			hovered_accessibility_cell_id = cell_id;

			if (
				selected_feature &&
				current_feature.properties.osm_id != selected_feature.properties.osm_id
			)
				move_popup(e);
			else update_popup(selected_feature, e);
		});
	}

	function move_popup(evt) {
		const anchor = evt?.lngLat;
		if (anchor) popup.setLngLat(anchor);
	}
	function update_popup(current_feature, evt) {
		if (current_feature) {
			popup?.remove();

			const anchor = evt.lngLat;

			if (anchor) popup.setLngLat(anchor).setHTML(create_html_popup(current_feature)).addTo(map);
		}
	}
	function create_html_popup(feature: {}) {
		// `html` escapes every interpolation. This string goes to Mapbox's setHTML,
		// which assigns to innerHTML, and `osm_name` is OpenStreetMap free text —
		// anyone with an account can rename a park to markup. The enforced CSP
		// carries script-src 'unsafe-inline', so an injected handler would run.
		let str = html`<div class="popup-container"></div>`;

		if (feature.properties.osm_name)
			str += html`<span class="popup-ga-name">${feature.properties.osm_name}</span>`;

		str += html`<div>
			<span class="attr-name">type</span
			><span class="attr-value">${green_types_dict[feature.properties.osm_value]}</span>
		</div>`;
		str += html`<div>
			<span class="attr-name">size</span
			><span class="attr-value">${format('.2f')(feature.properties.size)} ha</span>
		</div>`;

		str += `</div>`;

		return str;
	}

	setContext(key, {
		getMap: () => map
	});

	function setVisibilityLayer() {
		visibilityToggle = !visibilityToggle;
	}

	function center_and_zoom() {
		if (data) adjust_zoom(data, map);
	}
</script>

<div class="map-root" bind:clientWidth={width} bind:clientHeight={height}>
	<div id={container} class="map-canvas" />

	{#if map}
		<slot />
	{/if}
</div>
{#if map}
	<ButtonMap
		title={visibilityToggle ? 'Hide the green areas layer' : 'Show the green areas layer'}
		action={setVisibilityLayer}
		{map}
		icon={visibilityToggle ? ViewOff : View}
	/>
	<ButtonMap title="Center and zoom" action={center_and_zoom} {map} icon={FitToScreen} />
{/if}

<style>
	/*
		The map fills its stage absolutely, so no ancestor has to cooperate by
		passing a height down. `height` is measured rather than declared, which
		finally gives the `$: if (width && height && map) map.resize()` guard a
		real input instead of the constant 500 it used to compare.
	*/
	.map-root {
		position: absolute;
		inset: 0;
	}

	/*
		This targets the map's own container, NOT "every div inside .map-root".

		It used to be `.map-root > :global(div)`, and <slot /> renders its content
		as a direct child of .map-root too — so the rule also sized the slotted
		legend and Draw's map header. BaseLegend is `position: absolute; bottom:
		1.5rem; max-width: 25rem` with a dark translucent background: given
		`height: 100%` it became a 400px-wide, full-height dark rectangle down the
		middle of the map, anchored at the bottom so its colour ramp overshot the
		top edge. That is the black rectangle on the Before map, and the reason the
		colour bar rendered at the top instead of above the bottom.
	*/
	.map-canvas {
		width: 100%;
		height: 100%;
	}

	:global(.attr-name) {
		color: black;
		font-weight: 800;
		display: inline-block;
		width: 3em;
	}
	:global(.popup-ga-name) {
		color: black;
		font-weight: 900;
	}
	:global(.attr-value) {
		color: black;
	}
</style>
