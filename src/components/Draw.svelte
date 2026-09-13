<!-- newgreen_mindis_osm, newgreen_exposure_esa,   newgreen_per_person_osm -->

<script lang="ts">
	import Legend from './plotting/Legend.svelte';
	import { format } from 'd3';
	import { mapbox } from 'mapbox-gl';
	import {
		Button,
		ComboBox,
		MultiSelect,
		Slider,
		ToastNotification
	} from 'carbon-components-svelte';
	import union from '@turf/union';

	import { PlayFilled } from 'carbon-icons-svelte';
	import { onDestroy, onMount } from 'svelte';
	import type { Unsubscriber } from 'svelte/store';
	import {
		get_indexposure_esa,
		get_indmindistance_osm,
		get_indperperson_osm,
		newgreen_exposure_esa,
		newgreen_perperson_osm,
		newgreen_mindistance_osm
	} from '../js/api';
	import { AccessibilityIndexType, ClassificationScheme } from '../js/types';
	import { current_city, loading } from '../stores/stores';
	import DrawMap from './maps/DrawMap.svelte';
	import ReferenceMap from './maps/ReferenceMap.svelte';
	import BaseLegend from './plotting/BaseLegend.svelte';
	import {
		adjust_zoom,
		create_empty_geojson,
		create_geojson,
		get_green_types_code
	} from '../js/utils';
	import {
		get_accessibility_layer_fill_color,
		get_accessibility_layer_fill_opacity
	} from '../js/layers';
	import bbox from '@turf/bbox';

	let accesseibility_index_types = [
		{ id: AccessibilityIndexType.MINIMUM_DISTANCE, text: 'minimum distance' },
		{ id: AccessibilityIndexType.EXPOSURE, text: 'exposure' },
		{ id: AccessibilityIndexType.PER_PERSON, text: 'per person' }
	];

	let green_types = [
		{ id: 'parks', text: 'parks' },
		{ id: 'forests', text: 'forests' },
		{ id: 'grass', text: 'grass' }
	];

	export let metadata;

	let current_index_type = 0;
	let current_green_types = ['parks', 'forests', 'grass'];
	let current_green_types_code: number;
	// 0	{parks,forests,grass}
	// 1	{parks,forests}
	// 2	{parks,grass}
	// 3	{parks}
	// 4	{forests,grass}
	// 5	{forests}
	// 6	{grass}
	let current_time_budget = 5;
	let current_greenarea_size = 0.5;
	let time_budget_slider_disabled: boolean =
		current_index_type == AccessibilityIndexType.MINIMUM_DISTANCE;

	let current_target: number;

	let reference_data: object;
	let reference_map: mapbox.Map;
	let new_data: object;
	let new_map: mapbox.Map;

	let create_button_disabled: boolean;

	let referenceMapStyleLoaded = false;
	let referenceMapLoaded = false;
	let newMapStyleLoaded = false;
	let newMapLoaded = false;
	let empty_resultset_error = false;

	let green_types_combobox_disabled = false;
	let innerHeight: number;
	let innerWidth: number;
	let cell_id: number | undefined = undefined;
	let unsubscribe_current_city: Unsubscriber;

	const empty_geojson = create_empty_geojson();

	interface Feature {
		type: string;
		geometry: object;
		properties: object;
	}
	interface GeoJSON {
		type: string;
		features: Feature[];
	}

	let map_width: number;
	let map_height: number;

	$: create_button_disabled =
		$current_city && $current_city.text && newMapLoaded && referenceMapLoaded;
	$: green_types_combobox_disabled = current_index_type == AccessibilityIndexType.EXPOSURE;
	$: time_budget_slider_disabled = current_index_type == AccessibilityIndexType.MINIMUM_DISTANCE;

	$: if (map_width && map_height && reference_map && new_map) {
		reference_map.resize();
		new_map.resize();
		console.log(map_width, map_height);
	}

	function accessibility_diffmap(geojson1: GeoJSON, geojson2: GeoJSON) {
		const features: Feature[] = [];

		const A = geojson1.features.sort((a, b) => b.properties.id - a.properties.id);
		const B = geojson2.features.sort((a, b) => b.properties.id - a.properties.id);

		console.log('diff length', A.length, B.length);

		let i = 0;
		let j = 0;
		while (i < A.length && j < B.length) {
			const feature1 = A[i];
			const feature2 = B[j];
			const idA = feature1.properties.id;
			const idB = feature2.properties.id;
			const vA = feature1.properties.v;
			const vB = feature2.properties.v;
			if (idA == idB) {
				const diff = vB - vA;
				if (Math.abs(diff) > 0.01) {
					features.push({
						type: 'Feature',
						geometry: feature1.geometry,
						properties: {
							id: feature1.properties.id,
							v: format('.1f')(diff)
						}
					});
				}
				i += 1;
				j += 1;
			} else {
				console.log(idA, idB, vA, vB, i, j);
				if (idA > idB) i += 1;
				else j += 1;
			}
		}

		// A.forEach((feature1: Feature, index: number) => {
		// 	const feature2 = B[index];

		// 	if (feature1.properties.id == feature2.properties.id) {
		// 		const diff = feature2.properties.v - feature1.properties.v;

		// 		if (Math.abs(diff) > 0.01) {
		// 			features.push({
		// 				type: 'Feature',
		// 				geometry: feature1.geometry,
		// 				properties: {
		// 					id: feature1.properties.id,
		// 					v: format('.1f')(diff)
		// 				}
		// 			});
		// 		}
		// 	}
		// });
		return create_geojson(features);
	}

	function union_geojson(geojson: GeoJSON) {
		let mergedGeometry: object | null = null;

		geojson.features.forEach((feature) => {
			if (mergedGeometry === null) {
				mergedGeometry = feature.geometry;
			} else {
				mergedGeometry = union(mergedGeometry, feature.geometry).geometry;
			}
		});

		return {
			type: 'Feature',
			geometry: mergedGeometry,
			properties: {} // You can add properties as needed
		};
	}

	function add_diff_layer(data: object, map: mapbox.Map, labels = false) {
		if (!map.getSource(DIFF_SOURCE))
			map.addSource(DIFF_SOURCE, {
				type: 'geojson',
				data: data,
				generateId: true
			});
		else map.getSource(DIFF_SOURCE).setData(data);
		if (!map.getSource('source'))
			map.addSource('source', {
				type: 'geojson',
				data: union_geojson(data),
				generateId: true
			});
		else map.getSource('source').setData(union_geojson(data));
		if (!map.getLayer(DIFF_LAYER))
			map.addLayer(
				{
					id: DIFF_LAYER,
					type: 'line',
					source: 'source',
					paint: {
						'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1, 16, 4, 22, 5]
					}
				},
				SELECTED_CELL_LAYER
			);
		if (labels)
			if (!map.getLayer(DIFF_TEXT_LAYER))
				map.addLayer({
					id: DIFF_TEXT_LAYER,
					type: 'symbol',
					source: DIFF_SOURCE,
					layout: {
						'text-field': ['get', 'v'],
						'text-size': ['interpolate', ['linear'], ['zoom'], 11, 0, 13, 11, 15, 20],
						'text-anchor': 'center',
						'text-font': ['Arial Unicode MS Bold']
					},
					paint: { 'text-color': 'white', 'text-halo-color': 'black', 'text-halo-width': 1 }
				});
	}

	const ACCESSIBILITY_SOURCE = 'ACCESSIBILITY_SOURCE';
	const ACCESSIBILITY_LAYER = 'ACCESSIBILITY_LAYER';
	const SELECTED_CELL_SOURCE = 'SELECTED_CELL_SOURCE';
	const SELECTED_CELL_LAYER = 'SELECTED_CELL_LAYER';
	const DIFF_SOURCE = 'DIFF_SOURCE';
	const DIFF_LAYER = 'DIFF_LAYER';
	const DIFF_TEXT_LAYER = 'DIFF_TEXT_LAYER';

	function update_colormap(accessibility_values: number[], map: mapbox.Map, layer: mapbox.Layer) {
		if (map && map.getLayer(layer)) {
			let threshold: number;
			switch (current_index_type) {
				case AccessibilityIndexType.MINIMUM_DISTANCE:
					threshold = 5;
					break;
				case AccessibilityIndexType.EXPOSURE:
					threshold = 0.5;
					break;
				case AccessibilityIndexType.PER_PERSON:
					threshold = 9;
					break;
				default:
					threshold = 0;
					break;
			}

			map.setPaintProperty(
				layer,
				'fill-color',
				get_accessibility_layer_fill_color(
					accessibility_values,
					current_index_type,
					current_index_type == AccessibilityIndexType.PER_PERSON
						? ClassificationScheme.LOGARITHMIC
						: ClassificationScheme.LINEAR,
					threshold
				)
			);
		}
	}

	function update_opacity(map: mapbox.Map, layer: mapbox.Layer) {
		if (map && map.getLayer(layer))
			map.setPaintProperty(layer, 'fill-opacity', get_accessibility_layer_fill_opacity());
	}

	function add_selected_cell_layer(data: object, map: mapbox.Map) {
		if (!map.getSource(SELECTED_CELL_SOURCE))
			map.addSource(SELECTED_CELL_SOURCE, {
				type: 'geojson',
				data: data,
				generateId: true
			});
		else map.getSource(SELECTED_CELL_SOURCE).setData(data);

		if (!map.getLayer(SELECTED_CELL_LAYER)) {
			map.addLayer({
				id: SELECTED_CELL_LAYER,
				type: 'line',
				source: SELECTED_CELL_SOURCE,
				paint: {
					'line-color': 'white',
					'line-width': 2
				}
			});
		}
	}

	function add_accessibility_layer(data: object, map: mapbox.Map) {
		if (data && map) {
			if (!map.getSource(ACCESSIBILITY_SOURCE))
				map.addSource(ACCESSIBILITY_SOURCE, {
					type: 'geojson',
					data: data,
					generateId: true
				});
			else map.getSource(ACCESSIBILITY_SOURCE).setData(data);

			if (!map.getLayer(ACCESSIBILITY_LAYER)) {
				map.addLayer({
					id: ACCESSIBILITY_LAYER,
					type: 'fill',
					source: ACCESSIBILITY_SOURCE,
					paint: { 'fill-outline-color': 'rgba(0, 0, 0, 0)' }
				});
			}

			const accessibility_values: number[] = [...data.features.map((o: any) => o.properties.v)];

			update_colormap(accessibility_values, map, ACCESSIBILITY_LAYER);
			update_opacity(map, ACCESSIBILITY_LAYER);
		}
	}

	function update_map_click(selected_cell_feature) {
		if (new_data && new_map && reference_data && reference_map) {
			add_accessibility_layer(new_data, new_map);
			add_selected_cell_layer(selected_cell_feature, new_map);

			let diff = accessibility_diffmap(reference_data, new_data);

			add_diff_layer(diff, new_map, true);
			add_diff_layer(diff, reference_map);
			console.log('diff', diff);
			adjust_zoom(diff, new_map);
			adjust_zoom(diff, reference_map);
		}
	}

	onDestroy(() => {
		if (unsubscribe_current_city) unsubscribe_current_city();
		// remove all layers and sources
	});

	onMount(() => {
		switch (current_index_type) {
			case AccessibilityIndexType.MINIMUM_DISTANCE:
				current_target = 5;
				break;
			case AccessibilityIndexType.EXPOSURE:
				current_target = 1;
				break;
			case AccessibilityIndexType.PER_PERSON:
				current_target = 10;
				break;
			default:
				current_target = 5;
		}

		unsubscribe_current_city = current_city.subscribe((value) => {
			cell_id = undefined;
			new_data = empty_geojson;
			reference_data = empty_geojson;

			if (value && reference_map && referenceMapLoaded && referenceMapStyleLoaded)
				reference_map.flyTo({
					center: value.feature.geometry.coordinates,
					pitch: 0,
					bearing: 0,
					animate: false
				});
		});
	});

	function remove_layers(map: mapbox.Map) {
		if (map?.getLayer(DIFF_LAYER)) map.removeLayer(DIFF_LAYER);
		if (map?.getLayer(DIFF_TEXT_LAYER)) map.removeLayer(DIFF_TEXT_LAYER);
		if (map?.getSource(DIFF_SOURCE)) map.removeSource(DIFF_SOURCE);
		if (map?.getLayer(SELECTED_CELL_LAYER)) map.removeLayer(SELECTED_CELL_LAYER);
		if (map?.getSource(SELECTED_CELL_SOURCE)) map.removeSource(SELECTED_CELL_SOURCE);
		if (map?.getLayer(ACCESSIBILITY_LAYER)) map.removeLayer(ACCESSIBILITY_LAYER);
		if (map?.getSource(ACCESSIBILITY_SOURCE)) map.removeSource(ACCESSIBILITY_SOURCE);
	}

	function remove_all_layers() {
		remove_layers(reference_map);
		remove_layers(new_map);
	}

	function compute() {
		empty_resultset_error = false;
		reference_data = empty_geojson;
		remove_all_layers();

		let city = $current_city.text;

		current_green_types_code = get_green_types_code(current_green_types);

		loading.set(true);

		let f;
		switch (current_index_type) {
			case AccessibilityIndexType.MINIMUM_DISTANCE:
				f = get_indmindistance_osm(city, current_greenarea_size, current_green_types_code);
				break;
			case AccessibilityIndexType.EXPOSURE:
				f = get_indexposure_esa(city, current_greenarea_size, current_time_budget);
				break;
			case AccessibilityIndexType.PER_PERSON:
				f = get_indperperson_osm(
					city,
					current_greenarea_size,
					current_time_budget,
					current_green_types_code
				);
				break;
			default:
				f = get_indmindistance_osm(city, current_greenarea_size, current_green_types_code);
				break;
		}

		// `f.then(r => r.json().then(...))` did not return the inner promise, so
		// .finally fired when the HEADERS arrived - the overlay vanished while a
		// multi-megabyte body was still downloading and parsing - and a rejection
		// inside the inner chain (an HTML error page, an aborted transfer) never
		// reached .catch and became an unhandled rejection. No call site checked
		// response.ok either, so a 500 body was parsed as if it were data.
		(async () => {
			try {
				const response = await f;
				if (!response.ok) throw new Error(`index request failed: HTTP ${response.status}`);
				const response_json = await response.json();
				if (response_json && response_json.features && response_json.features.length > 0) {
					reference_data = response_json;
					add_accessibility_layer(reference_data, reference_map);
					adjust_zoom(reference_data, reference_map);
				} else {
					empty_resultset_error = true;
				}
			} catch (error) {
				empty_resultset_error = true;
				console.error('Draw: index request failed', error);
			} finally {
				loading.set(false);
			}
		})();
	}

	function handle_click_new_cell(payload) {
		cell_id = payload.detail.cellid;
		let green_types_code = get_green_types_code(current_green_types);
		let selected_cell_feature = payload.detail.feature;

		add_selected_cell_layer(selected_cell_feature, reference_map);

		loading.set(true);

		let f;
		switch (current_index_type) {
			case AccessibilityIndexType.MINIMUM_DISTANCE:
				f = newgreen_mindistance_osm(
					$current_city.text,
					current_greenarea_size,
					green_types_code,
					cell_id
				);
				break;
			case AccessibilityIndexType.EXPOSURE:
				f = newgreen_exposure_esa(
					$current_city.text,
					current_greenarea_size,
					current_time_budget,
					Math.min(current_greenarea_size, 4),
					cell_id
				);
				break;
			case AccessibilityIndexType.PER_PERSON:
				f = newgreen_perperson_osm(
					$current_city.text,
					current_greenarea_size,
					current_time_budget,
					green_types_code,
					Math.min(current_greenarea_size, 4),
					cell_id
				);
				break;
			default:
				f = newgreen_mindistance_osm(
					$current_city.text,
					current_greenarea_size,
					green_types_code,
					cell_id
				);
				break;
		}

		// Same fix as compute(): return the inner promise, check the status, and clear
		// the overlay only once the body has actually been parsed and rendered.
		(async () => {
			try {
				const response = await f;
				if (!response.ok) throw new Error(`greenify request failed: HTTP ${response.status}`);
				new_data = await response.json();
				update_map_click(selected_cell_feature);
			} catch (error) {
				console.error('Draw: greenify request failed', error);
			} finally {
				loading.set(false);
			}
		})();
	}

	function update_center(payload) {
		if (new_map && new_map.getCenter() != payload.detail.center)
			new_map?.setCenter(payload.detail.center);
	}

	function update_zoom(payload) {
		if (new_map && new_map.getZoom() != payload.detail.zoom) new_map?.setZoom(payload.detail.zoom);
	}

	function reset() {
		new_data = undefined;
		reference_data = undefined;
		cell_id = undefined;
		remove_all_layers();
	}
</script>

<svelte:window bind:innerHeight bind:innerWidth />

<div class="blocks-container">
	<div class="block">
		<ComboBox
			style="min-width: 150px;"
			titleText="Index type"
			placeholder="Select the type of accessibility index"
			bind:selectedId={current_index_type}
			items={accesseibility_index_types}
			on:select={() => {
				reset();
			}}
		/>
	</div>

	<div class="block">
		<MultiSelect
			selectedIds={current_green_types}
			titleText="Green area types"
			label="Select green types"
			items={green_types}
			disabled={green_types_combobox_disabled}
			on:select={() => {
				reset();
			}}
		/>
	</div>

	<div class="block">
		<Slider
			labelText="Minimum size (ha)"
			min={0.5}
			max={4}
			maxLabel="4"
			bind:value={current_greenarea_size}
			on:change={() => {
				reset();
			}}
		/>
	</div>

	<div class="block">
		<Slider
			labelText="Time budget (min)"
			min={0}
			max={15}
			maxLabel="15"
			bind:value={current_time_budget}
			disabled={time_budget_slider_disabled}
			on:change={() => {
				reset();
			}}
		/>
	</div>

	<div class="block">
		<Button
			disabled={!create_button_disabled}
			tooltipPosition="right"
			tooltipAlignment="end"
			icon={PlayFilled}
			iconDescription="Create your own accessibility index"
			on:click={() => {
				if ($current_city) {
					cell_id = undefined;
					compute();
				}
			}}>Draw</Button
		>
	</div>
</div>

{#if empty_resultset_error}
	<ToastNotification
		fullWidth
		lowContrast
		kind="error"
		title="Impossible to generate the accessibility index"
		subtitle="No park with these characteristics found in {$current_city.text}."
		caption={new Date().toLocaleString()}
		on:close={() => {
			empty_resultset_error = false;
		}}
	/>
{/if}

<div style="flex-grow: 1;display: flex;flex-direction: {innerWidth > 500 ? 'row' : 'column'};">
	<div
		style="flex-grow: 1;padding-right:{innerWidth > 500
			? '10px'
			: '0px'};display: flex;flex-direction: column;"
		bind:clientWidth={map_width}
		bind:clientHeight={map_height}
	>
		<ReferenceMap
			container="draw_reference_map"
			bind:ref={reference_map}
			bind:mapLoaded={referenceMapLoaded}
			bind:styleLoaded={referenceMapStyleLoaded}
			on:new_green_cell={handle_click_new_cell}
			on:update_center={update_center}
			on:update_zoom={update_zoom}
		>
			<div class="map_header">
				<p style="background-color: gray;text-align: center;width:50%;margin: auto;">Before</p>
				{#if reference_data && reference_data.features && reference_data.features.length > 0}
					<p style="background-color: black;text-align: center;">
						Click on a cell to greenify the area.
					</p>
				{:else}
					<p style="background-color: black;text-align: center;">
						Personalize your accessibility index and click Draw.
					</p>
				{/if}
			</div>

			{#if reference_data && reference_data.features && reference_data.features.length > 0}
				<BaseLegend
					bind:index_type={current_index_type}
					bind:threshold={current_target}
					data={reference_data}
					width={innerWidth > 500 ? 400 : innerWidth / 2}
				/>
			{/if}
		</ReferenceMap>
	</div>

	<div
		style="flex-grow: 1;padding-left:{innerWidth > 500
			? '10px'
			: '0px'};display: flex;flex-direction: column;visibility: {cell_id ? 'visible' : 'hidden'};"
	>
		<DrawMap
			container="draw_new_map"
			bind:ref={new_map}
			bind:mapLoaded={newMapLoaded}
			bind:styleLoaded={newMapStyleLoaded}
			on:update_center={update_center}
			on:update_zoom={update_zoom}
		>
			{#if new_data && new_data.features && new_data.features.length > 0}
				<div class="map_header">
					<p style="background-color: gray;text-align: center;width:50%;margin: auto;">After</p>
					<!-- <p>Hover around the selected cell to inspect the differences in accessibility.</p> -->
				</div>

				<BaseLegend
					bind:index_type={current_index_type}
					bind:threshold={current_target}
					data={reference_data}
					width={innerWidth > 500 ? 400 : innerWidth / 2}
				/>
			{/if}
		</DrawMap>
	</div>
</div>

<style>
	div.map_header {
		position: absolute;
		top: 0px;
		margin: 0px;
		padding: 10px;
		width: 100%;
		z-index: 100;
	}

	div {
		padding: 10px 0px;
	}

	div.blocks-container {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		flex-basis: auto;
		align-items: end;
	}
	div.block {
		flex-grow: 1;
		padding: 10px 10px;
	}

	p {
		margin-top: 10px;
	}

	:global(.bx--slider-text-input, .bx-slider-text-input) {
		padding: 0%;
		font-size: smaller;
	}

	:global(.bx--slider) {
		min-width: 10rem;
		max-width: 15rem;
	}

	:global(.bx--row) {
		margin-bottom: 10px;
		gap: 5px;
	}
</style>
