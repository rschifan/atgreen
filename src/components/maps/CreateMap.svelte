<script lang="ts">
	import centroid from '@turf/centroid';
	import { FitToScreen, View, ViewOff } from 'carbon-icons-svelte';
	import { format } from 'd3';
	import 'mapbox-gl/dist/mapbox-gl.css';
	import { onDestroy, onMount, setContext } from 'svelte';
	import type { Unsubscriber } from 'svelte/store';
	import {
		get_accessibility_layer_fill_color,
		get_accessibility_layer_fill_opacity
	} from '../../js/layers.js';
	import { get_default_map_props, key, mapbox } from '../../js/mapbox.js';
	import { AccessibilityIndexType, ClassificationScheme, UnitType } from '../../js/types.js';
	import { adjust_zoom } from '../../js/utils.js';
	import { current_city } from '../../stores/stores.js';
	import ButtonMap from './ButtonMap.svelte';

	let map: mapbox.Map;

	export let mapLoaded: boolean = false;
	export let styleLoaded: boolean = false;
	export let height: number = 500;
	export let container: string;
	export let ref: object;
	export let data: object;
	export let index_type: number;
	export let threshold: number;
	export let unit: string;
	export let size: number;
	export let distance: number;

	let width: number = 0;

	let unsubscribe_current_city_event: Unsubscriber;
	const NEW_INDEX_SOURCE = 'NEW_INDEX_SOURCE';
	const NEW_INDEX_LAYER = 'NEW_INDEX_LAYER';
	let visibilityToggle: boolean = true;
	let hovered_accessibility_cell_id: number = 0;

	const popup = new mapbox.Popup({
		closeButton: false,
		closeOnClick: false
	});

	$: if (index_type) {
		switch (index_type) {
			case AccessibilityIndexType.MINIMUM_DISTANCE:
				unit = UnitType.MINUTES;
				break;
			case AccessibilityIndexType.EXPOSURE:
				unit = UnitType.HECTARS;
				break;
			case AccessibilityIndexType.PER_PERSON:
				unit = UnitType.SQUARE_METERS;
				break;

			default:
				break;
		}
	}
	function subscribe_current_city_event() {
		unsubscribe_current_city_event = current_city.subscribe(() => {});
	}

	function get_predicate() {
		if (index_type == AccessibilityIndexType.MINIMUM_DISTANCE) return '<=';
		else return '>=';
	}

	function update_colormap(accessibility_values: number[]) {
		if (map && map.getLayer(NEW_INDEX_LAYER))
			map.setPaintProperty(
				NEW_INDEX_LAYER,
				'fill-color',
				get_accessibility_layer_fill_color(
					accessibility_values,
					index_type,
					index_type == AccessibilityIndexType.PER_PERSON
						? ClassificationScheme.LOGARITHMIC
						: ClassificationScheme.LINEAR,
					threshold
				)
			);
	}

	function update_opacity() {
		if (map && map.getLayer(NEW_INDEX_LAYER))
			map.setPaintProperty(NEW_INDEX_LAYER, 'fill-opacity', get_accessibility_layer_fill_opacity());
	}
	function update_datasource() {
		let source = map.getSource(NEW_INDEX_SOURCE);
		if (source) {
			source.setData(data);
		}
	}

	$: {
		if (map && map.getLayer(NEW_INDEX_LAYER))
			map.setLayoutProperty(NEW_INDEX_LAYER, 'visibility', visibilityToggle ? 'visible' : 'none');
	}
	$: {
		if (threshold && data && data.features.length > 0) {
			const accessibility_values: number[] = [...data.features.map((o: any) => o.properties.v)];

			update_opacity();
			update_colormap(accessibility_values);
		}
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

	function init() {
		map = new mapbox.Map(
			get_default_map_props(container, $current_city.feature.geometry.coordinates)
		);

		if (data) map.setCenter(centroid(data).geometry.coordinates);

		map.on('style.load', () => {
			styleLoaded = true;
		});

		map.on('load', async () => {
			mapLoaded = true;

			if (!map.getSource(NEW_INDEX_SOURCE))
				map.addSource(NEW_INDEX_SOURCE, {
					type: 'geojson',
					data: data,
					generateId: true
				});

			if (!map.getLayer(NEW_INDEX_LAYER)) {
				map.addLayer({
					id: NEW_INDEX_LAYER,
					type: 'fill',
					source: NEW_INDEX_SOURCE,
					paint: { 'fill-outline-color': 'rgba(0, 0, 0, 0)' }
				});
			}

			const accessibility_layer = map.getLayer(NEW_INDEX_LAYER);

			if (accessibility_layer) {
				const accessibility_values: number[] = [...data.features.map((o: any) => o.properties.v)];

				update_datasource();
				update_colormap(accessibility_values);
				update_opacity();
				adjust_zoom(data, map);

				map.setLayoutProperty(NEW_INDEX_LAYER, 'visibility', 'visible');
			}

			map.on('mouseenter', NEW_INDEX_LAYER, (e: mapbox.MapMouseEvent) => {
				if (!e.features || e.features.length <= 0) return;

				let current_feature = e.features[0];
				let cell_id = current_feature.id;

				map.getCanvas().style.cursor = 'pointer';

				update_popup(current_feature);

				if (hovered_accessibility_cell_id && hovered_accessibility_cell_id != 0) {
					map.setFeatureState(
						{ source: NEW_INDEX_SOURCE, id: hovered_accessibility_cell_id },
						{ hover: false }
					);
				}
				map.setFeatureState({ source: NEW_INDEX_SOURCE, id: cell_id }, { hover: true });

				hovered_accessibility_cell_id = cell_id;
			});

			map.on('mouseleave', NEW_INDEX_LAYER, () => {
				map.getCanvas().style.cursor = '';

				popup.remove();

				if (map && map.getSource(NEW_INDEX_SOURCE))
					map.setFeatureState(
						{ source: NEW_INDEX_SOURCE, id: hovered_accessibility_cell_id },
						{ hover: false }
					);
				hovered_accessibility_cell_id = 0;
			});

			map.on('mousemove', NEW_INDEX_LAYER, (e: mapbox.MapMouseEvent) => {
				if (!e.features || e.features.length <= 0) return;

				let current_feature = e.features[0];
				let cell_id = current_feature.id;

				update_popup(current_feature);

				if (hovered_accessibility_cell_id != 0) {
					map.setFeatureState(
						{ source: NEW_INDEX_SOURCE, id: hovered_accessibility_cell_id },
						{ hover: false }
					);
				}
				map.setFeatureState({ source: NEW_INDEX_SOURCE, id: cell_id }, { hover: true });
				hovered_accessibility_cell_id = cell_id;
			});
		});
		// map.scrollZoom.disable();

		ref = map;
	}

	setContext(key, {
		getMap: () => map
	});

	$: if (width && height && map) map.resize();

	function setVisibilityLayer() {
		visibilityToggle = !visibilityToggle;
	}

	function center_and_zoom() {
		if (data) adjust_zoom(data, map);
	}

	function update_popup(current_feature) {
		if (current_feature) {
			popup?.remove();

			const anchor = centroid(current_feature);

			if (anchor)
				popup
					.setLngLat(anchor.geometry.coordinates)
					.setHTML(create_html_popup(current_feature))
					.addTo(map);
		}
	}

	function create_html_popup(feature: {}) {
		let target_string;
		let target_predicate;
		const value = feature.properties.v;

		let value_string: string = '';

		if (index_type == AccessibilityIndexType.MINIMUM_DISTANCE) {
			if (value == 0)
				value_string = `A green area of at least <span style="font-weight:bold"> ${size} ha </span> is reachable within the cell.`;
			else
				value_string = `The distance to the closest park of at least <span style="font-weight:bold"> ${size} ha </span> is about <span style="font-weight:bold"> ${format(
					'.1f'
				)(value)} ${unit} </span> walking.`;
		} else if (index_type == AccessibilityIndexType.EXPOSURE) {
			value_string = `This cell has access to <span style="font-weight:bold">${format('.1f')(
				value
			)} ${unit} </span> of green within of <span style="font-weight:bold">${distance} </span> min walking.`;
		} else {
			value_string = `Each inhabitant of this cell has access to <span style="font-weight:bold">${format(
				'.1f'
			)(
				value
			)} ${unit} </span> of green within of <span style="font-weight:bold">${distance} </span> min walking.`;
		}

		if (index_type == AccessibilityIndexType.MINIMUM_DISTANCE)
			target_predicate = value <= threshold;
		else target_predicate = value >= threshold;
		target_string = target_predicate
			? `This cell <span style="font-weight:bold">does</span> meet your target (${format('.1f')(
					value
			  )} ${unit} ${
					index_type == AccessibilityIndexType.MINIMUM_DISTANCE ? '<' : '>'
			  } ${threshold} ${unit} )`
			: `This cell <span style="font-weight:bold">does not </span> meet your target (${format(
					'.1f'
			  )(value)} ${unit} ${
					index_type == AccessibilityIndexType.MINIMUM_DISTANCE ? '>' : '<'
			  } ${threshold} ${unit} )`;

		return (
			'<div style="color:black;padding:0px;margin:0px;"><p style="font-size:1em">' +
			value_string +
			'</p>' +
			'<p style="font-size:1em; margin-top:0.5rem">' +
			target_string +
			'</p>' +
			'</div>'
		);
	}
</script>

<div bind:clientWidth={width} style="flex: 1 1 auto;height:{height}px;">
	<div id={container} bind:clientWidth={width} style="height: 100%;" />

	{#if map}
		<slot />
	{/if}
</div>
{#if map}
	<ButtonMap
		title={visibilityToggle ? 'Hide the accessibility layer' : 'Show the accessibility layer'}
		action={setVisibilityLayer}
		{map}
		icon={visibilityToggle ? ViewOff : View}
	/>
	<ButtonMap title="Center and zoom" action={center_and_zoom} {map} icon={FitToScreen} />
{/if}

<style>
</style>
