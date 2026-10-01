<!-- newgreen_mindis_osm, newgreen_exposure_esa,   newgreen_per_person_osm -->

<script lang="ts">
	import type * as GeoJSON from 'geojson';
	import { LABEL_FONT } from '../js/map.js';
	import { format } from 'd3';
	import ToolPane from './ToolPane.svelte';
	// Type-only. MapLibre ships its own type definitions, so type positions import
	// straight from the package; value imports go through js/map, which registers
	// the map worker before any map is built.
	import type * as maplibregl from 'maplibre-gl';
	import union from '@turf/union';

	import PencilIcon from '@lucide/svelte/icons/pencil';
	import { toast } from 'svelte-sonner';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { cityLabel } from '../js/slug';
	import GreenTypesField from './fields/GreenTypesField.svelte';
	import IndexTypeField from './fields/IndexTypeField.svelte';
	import RangeField from './fields/RangeField.svelte';
	import TimeBudgetField from './fields/TimeBudgetField.svelte';
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
	import {
		AccessibilityIndexType,
		DEFAULT_TARGET,
		INDEX_UNIT,
		ClassificationScheme
	} from '../js/types';
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
	let time_budget_slider_disabled: boolean;

	let current_target: number;

	let reference_data: CellCollection;
	let reference_map: maplibregl.Map;
	let new_data: CellCollection;
	let new_map: maplibregl.Map;

	let create_button_disabled: boolean;

	let referenceMapStyleLoaded = false;
	let referenceMapLoaded = false;
	let newMapStyleLoaded = false;
	let newMapLoaded = false;
	// An index that came back empty, or a request that failed, is said once in a
	// toast rather than left as a notification block in the rail.
	function no_index() {
		toast.error('No index generated', {
			description: `No park with these characteristics found in ${cityLabel($current_city?.text)}.`
		});
	}

	let green_types_combobox_disabled: boolean;
	let cell_id: number | undefined = undefined;
	let unsubscribe_current_city: Unsubscriber;

	const empty_geojson = create_empty_geojson();

	/*
		The accessibility grid as MapLibre receives it: GeoJSON whose features carry
		a cell `id` and a value `v`. These were hand-rolled interfaces NAMED
		`GeoJSON` and `Feature`, which shadowed the real GeoJSON types for this
		whole file — so nothing here could be checked against what MapLibre
		actually accepts.
	*/
	type CellProperties = { id: number; v: number };
	type CellFeature = GeoJSON.Feature<GeoJSON.Geometry, CellProperties>;
	type CellCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, CellProperties>;

	$: create_button_disabled =
		$current_city && $current_city.text && newMapLoaded && referenceMapLoaded;
	$: green_types_combobox_disabled = current_index_type == AccessibilityIndexType.EXPOSURE;
	$: time_budget_slider_disabled = current_index_type == AccessibilityIndexType.MINIMUM_DISTANCE;

	/*
		The resize block that used to live here bound the wrapper's clientWidth and
		clientHeight and called resize() on both maps — and logged them on every
		frame of a drag. Each map now measures its own root and resizes itself, so
		this was doing the same work from further away.
	*/

	function accessibility_diffmap(geojson1: CellCollection, geojson2: CellCollection) {
		const features: CellFeature[] = [];

		const A = geojson1.features.sort((a, b) => b.properties.id - a.properties.id);
		const B = geojson2.features.sort((a, b) => b.properties.id - a.properties.id);

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

	function union_geojson(geojson: CellCollection): GeoJSON.Feature | GeoJSON.FeatureCollection {
		type Area = GeoJSON.Polygon | GeoJSON.MultiPolygon;
		let merged: Area | null = null;

		// for…of rather than forEach, so the type checker can follow `merged`.
		for (const feature of geojson.features) {
			const area = feature.geometry as Area;
			// turf returns null when a union degenerates; keep what we had rather
			// than dereferencing it, which is what `.geometry` on null used to do.
			merged = merged === null ? area : (union(merged, area)?.geometry ?? merged);
		}

		// Nothing to merge: an empty collection, not a Feature with a null
		// geometry — that looks like GeoJSON but MapLibre will not accept it.
		if (merged === null) return create_empty_geojson();
		return { type: 'Feature', geometry: merged, properties: {} };
	}

	function add_diff_layer(data: CellCollection, map: maplibregl.Map, labels = false) {
		if (!map.getSource(DIFF_SOURCE))
			map.addSource(DIFF_SOURCE, {
				type: 'geojson',
				data: data,
				generateId: true
			});
		else map.getSource<maplibregl.GeoJSONSource>(DIFF_SOURCE)?.setData(data);
		if (!map.getSource('source'))
			map.addSource('source', {
				type: 'geojson',
				data: union_geojson(data),
				generateId: true
			});
		else map.getSource<maplibregl.GeoJSONSource>('source')?.setData(union_geojson(data));
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
						// Was 'Arial Unicode MS Bold': a Mapbox-hosted glyph name that no
						// open font server provides, so these labels would render blank.
						'text-font': LABEL_FONT
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

	function update_colormap(accessibility_values: number[], map: maplibregl.Map, layer: string) {
		if (map && map.getLayer(layer)) {
			// One table, shared with Create and with the onMount switch that used to
			// sit below — which disagreed with this one on two of three values.
			const threshold = DEFAULT_TARGET[current_index_type] ?? 5;

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

	function update_opacity(map: maplibregl.Map, layer: string) {
		if (map && map.getLayer(layer))
			map.setPaintProperty(layer, 'fill-opacity', get_accessibility_layer_fill_opacity());
	}

	function add_selected_cell_layer(data: GeoJSON.GeoJSON, map: maplibregl.Map) {
		if (!map.getSource(SELECTED_CELL_SOURCE))
			map.addSource(SELECTED_CELL_SOURCE, {
				type: 'geojson',
				data: data,
				generateId: true
			});
		else map.getSource<maplibregl.GeoJSONSource>(SELECTED_CELL_SOURCE)?.setData(data);

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

	function add_accessibility_layer(data: CellCollection, map: maplibregl.Map) {
		if (data && map) {
			if (!map.getSource(ACCESSIBILITY_SOURCE))
				map.addSource(ACCESSIBILITY_SOURCE, {
					type: 'geojson',
					data: data,
					generateId: true
				});
			else map.getSource<maplibregl.GeoJSONSource>(ACCESSIBILITY_SOURCE)?.setData(data);

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
			adjust_zoom(diff, new_map);
			adjust_zoom(diff, reference_map);
		}
	}

	onDestroy(() => {
		if (unsubscribe_current_city) unsubscribe_current_city();
		// remove all layers and sources
	});

	/*
		Reactive, not a switch in onMount. That hook ran once, when
		`current_index_type` is always 0, so its exposure and per-person branches
		were dead — and its values disagreed with the ones update_colormap used
		for the very same thing (1 vs 0.5 ha, 10 vs 9 sq m). /rpc/getindexes says
		0.5 and 9, so update_colormap was right and this was not.
	*/
	$: current_target = DEFAULT_TARGET[current_index_type] ?? 5;

	onMount(() => {
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

	function remove_layers(map: maplibregl.Map) {
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
		reference_data = empty_geojson;
		remove_all_layers();

		let city = $current_city.text;

		current_green_types_code = get_green_types_code(current_green_types);
		// An empty green-type selection now yields undefined rather than silently
		// meaning "all three". Refuse the request and say so, instead of sending
		// green_code=undefined to the API.
		if (current_green_types_code === undefined) {
			no_index();
			return;
		}

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
					no_index();
				}
			} catch (error) {
				no_index();
				console.error('Draw: index request failed', error);
			} finally {
				loading.set(false);
			}
		})();
	}

	function handle_click_new_cell(payload) {
		cell_id = payload.detail.cellid;
		let green_types_code = get_green_types_code(current_green_types);
		if (green_types_code === undefined) {
			no_index();
			return;
		}
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
		// `getCenter() != payload.detail.center` compared two LngLat objects by
		// identity, so it was always true and setCenter ran on every `move` event of
		// the reference map. Compare the coordinates, with a tolerance below one
		// rendered pixel at this zoom.
		if (!new_map) return;
		const to = payload.detail.center;
		const at = new_map.getCenter();
		if (Math.abs(at.lng - to.lng) > 1e-9 || Math.abs(at.lat - to.lat) > 1e-9) {
			new_map.setCenter(to);
		}
	}

	function update_zoom(payload) {
		if (new_map && Math.abs(new_map.getZoom() - payload.detail.zoom) > 1e-9)
			new_map.setZoom(payload.detail.zoom);
	}

	function reset() {
		new_data = undefined;
		reference_data = undefined;
		cell_id = undefined;
		remove_all_layers();
	}
</script>

<ToolPane>
	<svelte:fragment slot="rail">
		<IndexTypeField bind:value={current_index_type} onchange={reset} />
		<GreenTypesField
			bind:value={current_green_types}
			disabled={green_types_combobox_disabled}
			onchange={reset}
		/>
		<RangeField
			title="Minimum size"
			unit="ha"
			min={0.5}
			max={50}
			step={0.5}
			bind:value={current_greenarea_size}
			onchange={reset}
		/>
		<TimeBudgetField
			bind:value={current_time_budget}
			disabled={time_budget_slider_disabled}
			onchange={reset}
		/>

		<Button disabled={!create_button_disabled} onclick={compute}><PencilIcon /> Draw</Button>

		<p class="hint">
			{#if reference_data && reference_data.features && reference_data.features.length > 0}
				Click a cell on the Before map to greenify it.
			{:else}
				Choose your parameters and press Draw.
			{/if}
		</p>
	</svelte:fragment>

	<div class="pair">
		<div class="cell">
			<ReferenceMap
				container="draw_reference_map"
				bind:ref={reference_map}
				bind:mapLoaded={referenceMapLoaded}
				bind:styleLoaded={referenceMapStyleLoaded}
				on:new_green_cell={handle_click_new_cell}
				on:update_center={update_center}
				on:update_zoom={update_zoom}
			>
				<Badge variant="secondary" class="caption">Before</Badge>

				{#if reference_data && reference_data.features && reference_data.features.length > 0}
					<BaseLegend
						bind:index_type={current_index_type}
						bind:threshold={current_target}
						data={reference_data}
					/>
				{/if}
			</ReferenceMap>
		</div>

		<div class="cell">
			<!--
				DrawMap has no createEventDispatcher, so the on:update_center /
				on:update_zoom handlers that used to be here never fired. The sync is
				one-way by design: ReferenceMap (Before) drives DrawMap (After).
			-->
			<DrawMap
				container="draw_new_map"
				bind:ref={new_map}
				bind:mapLoaded={newMapLoaded}
				bind:styleLoaded={newMapStyleLoaded}
			>
				<Badge variant="secondary" class="caption">After</Badge>
				{#if new_data && new_data.features && new_data.features.length > 0}
					<BaseLegend
						bind:index_type={current_index_type}
						bind:threshold={current_target}
						data={new_data}
					/>
				{/if}
			</DrawMap>
		</div>
	</div></ToolPane
>

<style>
	/*
		Both maps are always present and always equal halves. The After column
		was `visibility: hidden` until a cell was picked, which still reserves
		its box — so Before was permanently half-width with nothing beside it.
		The grid also replaces an `innerWidth > 500` row/column switch, one of
		ten JS breakpoints that re-rendered their component on every resize.
	*/
	.pair {
		/*
			Absolute, not flex-grow: the stage is a positioning context rather than
			a flex container, and the map roots inside these cells are themselves
			absolute, so a content-sized grid collapses to nothing.
		*/
		position: absolute;
		inset: 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2px;
	}

	.cell {
		position: relative;
		overflow: hidden;
		min-width: 0;
	}

	@media (max-width: 41.99rem) {
		.pair {
			grid-template-columns: 1fr;
			grid-template-rows: 1fr 1fr;
		}
	}

	.hint {
		margin: 0;
		font-size: 0.8125rem;
		line-height: 1.4;
		color: var(--muted-foreground);
	}

	/* "Before" / "After": a caption over each map, never a click target. */
	.pair :global(.caption) {
		position: absolute;
		top: 0.75rem;
		left: 0.75rem;
		z-index: 10;
		pointer-events: none;
	}
</style>
