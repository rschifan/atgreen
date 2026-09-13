<script lang="ts">
	import { useWatcher } from 'alova';
	import { onDestroy, onMount } from 'svelte';
	import { get_accessibility_layer } from '../../js/api';
	import {
		current_accessibility_index,
		current_accessibility_index_data,
		current_cell,
		current_city,
		loading
	} from '../../stores/stores';

	import centroid from '@turf/centroid';
	import { FitToScreen, View, ViewOff } from 'carbon-icons-svelte';
	import { format } from 'd3';
	import type { Unsubscriber } from 'svelte/store';
	import {
		get_accessibility_layer_fill_color,
		get_accessibility_layer_fill_opacity
	} from '../../js/layers';
	import { mapbox } from '../../js/mapbox';
	import ButtonMap from '../maps/ButtonMap.svelte';
	// import centroid from '@turf/centroid';
	// import { onDestroy } from 'svelte/internal';
	// import type { Unsubscriber } from 'svelte/store';
	// import { get_city_accessibility_index } from '../../js/api';
	// import MapButton from '../base/MapButton.svelte';
	import { AccessibilityIndexType } from '../../js/types';
	import { adjust_zoom } from '../../js/utils';

	const empty_geojson = { type: 'FeatureCollection', features: [] };
	const ACCESSIBILITY_INDEX_SOURCE = 'ACCESSIBILITY_INDEX_SOURCE';
	const ACCESSIBILITY_INDEX_LAYER = 'ACCESSIBILITY_INDEX_LAYER';

	let visibilityToggle = true;
	let hovered_accessibility_cell_id = 0;
	let selected_cell_id: number;
	export let metadata;
	export let map: mapbox.Map;

	const popup = new mapbox.Popup({
		closeButton: false,
		closeOnClick: false
	});

	function update(data: any) {
		if (metadata && $current_accessibility_index && map) {
			const accessibility_values: number[] = [...data.features.map((o: any) => o.properties.v)];

			if (map) {
				const accessibility_layer = map.getLayer(ACCESSIBILITY_INDEX_LAYER);

				if (accessibility_layer) {
					map.setPaintProperty(
						ACCESSIBILITY_INDEX_LAYER,
						'fill-color',
						get_accessibility_layer_fill_color(
							accessibility_values,
							type,
							classification,
							threshold
						)
					);
					map.setPaintProperty(
						ACCESSIBILITY_INDEX_LAYER,
						'fill-opacity',
						get_accessibility_layer_fill_opacity()
					);
				}
			}
		}
	}

	$: {
		if (map && map.getLayer(ACCESSIBILITY_INDEX_LAYER))
			map.setLayoutProperty(
				ACCESSIBILITY_INDEX_LAYER,
				'visibility',
				visibilityToggle ? 'visible' : 'none'
			);
	}

	$: if (map) {
		if (!map.getSource(ACCESSIBILITY_INDEX_SOURCE))
			map.addSource(ACCESSIBILITY_INDEX_SOURCE, {
				type: 'geojson',
				data: empty_geojson,
				generateId: true
			});

		if (!map.getLayer(ACCESSIBILITY_INDEX_LAYER))
			map.addLayer({
				id: ACCESSIBILITY_INDEX_LAYER,
				type: 'fill',
				source: ACCESSIBILITY_INDEX_SOURCE,
				paint: { 'fill-outline-color': 'rgba(0, 0, 0, 0)' }
			});
	}

	// `immediate: true` fired a request on mount before either the city or the index was
	// known, so one city selection was paid for three times (~827 KB each for Turin).
	// `immediate: false` alone is not enough either: this component now mounts only once
	// its tab is opened, by which point both stores are already populated and neither
	// fires again - so nothing would ever trigger the fetch. Drive it explicitly instead,
	// keyed on (city, band) so a repeat of the same pair is not re-requested.
	let accessibility_layer_request = useWatcher(
		() =>
			get_accessibility_layer($current_city?.text, metadata?.getBand($current_accessibility_index)),
		[current_city, current_accessibility_index],
		{
			debounce: 500,
			immediate: false
		}
	);

	let last_requested_key: string | undefined = undefined;
	$: {
		const _city = $current_city?.text;
		const _band = metadata?.getBand($current_accessibility_index);
		const _key = `${_city}|${_band}`;
		if (_city && _band !== undefined && _key !== last_requested_key) {
			last_requested_key = _key;
			accessibility_layer_request.send();
		}
	}

	let unsubscribe_current_city_event: Unsubscriber;
	let unsubscribe_current_accessibility_index_event: Unsubscriber;
	let unsubscribe_accessibility_layer_request_event: Unsubscriber;
	let unsubscribe_current_cell_event: Unsubscriber;

	$: target = metadata?.getTarget($current_accessibility_index);
	$: threshold = target?.threshold;
	$: predicate = target?.get_predicate();
	$: index = target?.index;
	$: type = index?.type;
	$: unit = index?.unit;
	$: size = index?.size;
	$: distance = index?.distance;
	$: classification = index?.classification;

	onMount(() => {
		console.log('AccessibilityLayer - onMount');

		unsubscribe_current_cell_event = current_cell.subscribe((value) => {
			if (value && value.x != -1 && value.y != -1)
				map.setPaintProperty(ACCESSIBILITY_INDEX_LAYER, 'fill-opacity', [
					'case',
					['==', ['feature-state', 'selected'], true],
					1.0,
					['==', ['feature-state', 'hover'], true],
					1.0,
					0.15
				]);
			else {
				map.setPaintProperty(
					ACCESSIBILITY_INDEX_LAYER,
					'fill-opacity',
					get_accessibility_layer_fill_opacity()
				);
				if (selected_cell_id)
					map.setFeatureState(
						{ source: ACCESSIBILITY_INDEX_SOURCE, id: selected_cell_id },
						{ selected: false }
					);
				selected_cell_id = undefined;

				if ($current_accessibility_index_data) adjust_zoom($current_accessibility_index_data, map);
			}
		});
		unsubscribe_current_city_event = current_city.subscribe((value) => {});
		unsubscribe_current_accessibility_index_event = current_accessibility_index.subscribe(
			(value) => {}
		);
		unsubscribe_accessibility_layer_request_event = accessibility_layer_request.data.subscribe(
			(value) => {
				if (value && value.features && value.features.length > 0) {
					const accessibility_source = map.getSource(ACCESSIBILITY_INDEX_SOURCE);
					if (accessibility_source) {
						console.log('AccessibilityLayer data loaded', value);
						accessibility_source.setData(value);
						adjust_zoom(value, map);
						update(value);

						current_accessibility_index_data.set(value);
					} else console.log('accessibility source not valid', accessibility_source);
				}
				loading.set(false);
			}
		);

		$current_city;

		map.on('click', ACCESSIBILITY_INDEX_LAYER, (e) => {
			if (e.features && e.features.length > 0) {
				popup?.remove();

				let current_feature = e.features[0];
				let clicked_cell_id = current_feature.id;

				current_cell.set({
					x: current_feature.properties.x,
					y: current_feature.properties.y
				});

				if (selected_cell_id)
					map.setFeatureState(
						{ source: ACCESSIBILITY_INDEX_SOURCE, id: selected_cell_id },
						{ selected: false }
					);

				if (clicked_cell_id == hovered_accessibility_cell_id)
					map.setFeatureState(
						{ source: ACCESSIBILITY_INDEX_SOURCE, id: clicked_cell_id },
						{ hover: false }
					);

				selected_cell_id = clicked_cell_id;
				if (selected_cell_id)
					map.setFeatureState(
						{ source: ACCESSIBILITY_INDEX_SOURCE, id: selected_cell_id },
						{ selected: true }
					);
			}
		});

		map.on('mouseenter', ACCESSIBILITY_INDEX_LAYER, (e: mapbox.MapMouseEvent) => {
			if (!e.features || e.features.length <= 0) return;

			let current_feature = e.features[0];
			let cell_id = current_feature.id;

			map.getCanvas().style.cursor = 'pointer';

			if (hovered_accessibility_cell_id && hovered_accessibility_cell_id != 0) {
				map.setFeatureState(
					{ source: ACCESSIBILITY_INDEX_SOURCE, id: hovered_accessibility_cell_id },
					{ hover: false }
				);
			}
			map.setFeatureState({ source: ACCESSIBILITY_INDEX_SOURCE, id: cell_id }, { hover: true });

			hovered_accessibility_cell_id = cell_id;

			update_popup(current_feature);
		});

		map.on('mouseleave', ACCESSIBILITY_INDEX_LAYER, (e: mapbox.MapMouseEvent) => {
			map.getCanvas().style.cursor = '';

			popup?.remove();

			if (map && map.getSource(ACCESSIBILITY_INDEX_SOURCE))
				map.setFeatureState(
					{ source: ACCESSIBILITY_INDEX_SOURCE, id: hovered_accessibility_cell_id },
					{ hover: false }
				);
			hovered_accessibility_cell_id = 0;
		});

		map.on('mousemove', ACCESSIBILITY_INDEX_LAYER, (e: mapbox.MapMouseEvent) => {
			if (!e.features || e.features.length <= 0) return;

			let current_feature = e.features[0];
			let cell_id = current_feature.id;

			if (hovered_accessibility_cell_id != 0) {
				map.setFeatureState(
					{ source: ACCESSIBILITY_INDEX_SOURCE, id: hovered_accessibility_cell_id },
					{ hover: false }
				);
			}
			map.setFeatureState({ source: ACCESSIBILITY_INDEX_SOURCE, id: cell_id }, { hover: true });
			hovered_accessibility_cell_id = cell_id;
			update_popup(current_feature);
		});
	});

	onDestroy(() => {
		console.log('AccessibilityLayer - destroy');

		if (unsubscribe_current_city_event) unsubscribe_current_city_event();
		if (unsubscribe_accessibility_layer_request_event)
			unsubscribe_accessibility_layer_request_event();
		if (unsubscribe_current_accessibility_index_event)
			unsubscribe_current_accessibility_index_event();
		if (unsubscribe_current_cell_event) unsubscribe_current_cell_event();

		map.off('mousemove', ACCESSIBILITY_INDEX_LAYER);
		map.off('mouseleave', ACCESSIBILITY_INDEX_LAYER);
		map.off('mouseenter', ACCESSIBILITY_INDEX_LAYER);
		map.off('click', ACCESSIBILITY_INDEX_LAYER);

		map.removeLayer(ACCESSIBILITY_INDEX_LAYER);
		map.removeSource(ACCESSIBILITY_INDEX_SOURCE);

		current_accessibility_index_data.set(undefined);
	});

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
		const target = metadata?.getTarget($current_accessibility_index);
		const threshold = target?.threshold;
		const index = target?.index;
		const unit = index?.unit;
		const type = index?.type;
		const size = index?.size;
		const distance = index?.distance;

		const value = feature.properties.v;

		let value_string = '';

		if (type == AccessibilityIndexType.MINIMUM_DISTANCE) {
			if (value == 0)
				value_string =
					'A green area of at least <span style="font-weight:bold">' +
					size +
					' ha </span> is reachable within the cell.';
			else
				value_string =
					'The distance to the closest park of at least <span style="font-weight:bold">' +
					size +
					' ha </span> is about <span style="font-weight:bold">' +
					format('.1f')(value) +
					' ' +
					unit +
					'</span> walking.';
		} else if (type == AccessibilityIndexType.EXPOSURE) {
			value_string = `This cell has access to <span style="font-weight:bold">${value} ${unit} </span> of green within of <span style="font-weight:bold">${distance} </span> min walking.`;
		} else {
			value_string = `Each inhabitant of this cell has access to <span style="font-weight:bold">${value} ${unit} </span> of green within of <span style="font-weight:bold">${distance} </span> min walking.`;
		}

		let target_string;
		let target_predicate;

		if (type == AccessibilityIndexType.MINIMUM_DISTANCE) target_predicate = value <= threshold;
		else target_predicate = value >= threshold;
		target_string = target_predicate
			? 'This cell <span style="font-weight:bold">does</span> meet the target for ' +
			  $current_accessibility_index
			: 'This cell <span style="font-weight:bold">does not </span> meet the target for ' +
			  $current_accessibility_index +
			  ' (' +
			  value +
			  ' ' +
			  unit +
			  ' ' +
			  (type == AccessibilityIndexType.MINIMUM_DISTANCE ? '>' : '<') +
			  ' ' +
			  threshold +
			  ' ' +
			  unit +
			  ')';

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

	function setVisibilityLayer() {
		visibilityToggle = !visibilityToggle;
	}

	function center_and_zoom() {
		if ($current_accessibility_index_data) adjust_zoom($current_accessibility_index_data, map);
	}
</script>

{#if $current_accessibility_index_data}
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
