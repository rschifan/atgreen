<script lang="ts">
	import { FitToScreen, View, ViewOff } from 'carbon-icons-svelte';
	import { format } from 'd3';
	import 'mapbox-gl/dist/mapbox-gl.css';
	import { afterUpdate, onDestroy, onMount, setContext } from 'svelte';
	import type { Unsubscriber } from 'svelte/store';
	import { BOUNDARY_MAP_COLOR } from '../../js/colors';
	import { get_default_map_props, key, mapbox } from '../../js/mapbox.js';
	import { adjust_zoom, create_empty_geojson } from '../../js/utils';
	import { current_city } from '../../stores/stores.js';
	import ButtonMap from './ButtonMap.svelte';

	export let mapLoaded = false;
	export let styleLoaded = false;
	export let height = 400;
	export let container: string;
	export let ref: object;
	export let data: object;
	export let green_types: [];
	export let minimum_size: number;
	export let selected_green_areas: [];

	let selected_feature: object | undefined = undefined;
	let width = 0;

	let unsubscribe_current_city_event: Unsubscriber;
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

	$: if (width && height && map) map.resize();

	$: if (data && data.features && data.features.length > 0) {
		const green_areas_source = map?.getSource(GREENAREAS_SOURCE);
		if (green_areas_source) {
			green_areas_source.setData(data);
			adjust_zoom(data, map);
		}
	}

	$: if (minimum_size >= 0) {
		filter_by_size(minimum_size);
	}

	$: if (green_types) {
		filter_by_greentype(green_types);
	}

	$: if (selected_green_areas) {
		filter_by_name(selected_green_areas);
	} else {
		if (map && map.getLayer(GREENAREAS_LAYER) && map.getLayer(GREENAREAS_LABELS_LAYER)) {
			map.setFilter(GREENAREAS_LABELS_LAYER);
			map.setFilter(GREENAREAS_LAYER);
		}
	}

	function subscribe_current_city_event() {
		unsubscribe_current_city_event = current_city.subscribe(() => {});
	}

	function filter_by_size(minv: number) {
		if (map && map.getLayer(GREENAREAS_LAYER))
			map.setFilter(GREENAREAS_LAYER, ['>=', ['get', 'size'], minv]);
		if (map && map.getLayer(GREENAREAS_LABELS_LAYER))
			map.setFilter(GREENAREAS_LABELS_LAYER, ['>=', ['get', 'size'], minv]);
	}

	function filter_by_greentype(types: []) {
		if (map && map.getLayer(GREENAREAS_LAYER))
			map.setFilter(GREENAREAS_LAYER, ['in', ['get', 'osm_value'], ['literal', green_types]]);

		if (map && map.getLayer(GREENAREAS_LABELS_LAYER))
			map.setFilter(GREENAREAS_LABELS_LAYER, [
				'in',
				['get', 'osm_value'],
				['literal', green_types]
			]);
	}

	function filter_by_name(greenareas: []) {
		if (map && map.getLayer(GREENAREAS_LAYER))
			map.setFilter(GREENAREAS_LAYER, ['in', ['get', 'osm_name'], ['literal', greenareas]]);

		if (map && map.getLayer(GREENAREAS_LABELS_LAYER))
			map.setFilter(GREENAREAS_LABELS_LAYER, ['in', ['get', 'osm_name'], ['literal', greenareas]]);
	}

	onMount(() => {
		console.log('BaseMap - mount');
		subscribe_current_city_event();
		init();
	});

	onDestroy(() => {
		if (unsubscribe_current_city_event) unsubscribe_current_city_event();
		console.log('BaseMap - destroy');
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
		let str = `<div class="popup-container">`;

		if (feature.properties.osm_name)
			str += `<span class="popup-ga-name">${feature.properties.osm_name}</span>`;

		str += `<div><span class="attr-name">type</span><span class="attr-value">${
			green_types_dict[feature.properties.osm_value]
		}</span></div>`;
		str += `<div><span class="attr-name">size</span><span class="attr-value">${format('.2f')(
			feature.properties.size
		)} ha</span></div>`;

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

<div bind:clientWidth={width} style="flex-grow: 1;">
	<div id={container} bind:clientWidth={width} style="height: 100%;" />

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
