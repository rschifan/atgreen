<script lang="ts">
	/**
	 * What one more green area would change. "Before" shows an index the user
	 * builds; a click on one of its cells recomputes the index as if that cell were
	 * green, shown "After", with the cells that changed outlined and labelled.
	 */
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import union from '@turf/union';
	import type * as GeoJSON from 'geojson';
	// Type-only: value imports go through js/map, which registers the map worker.
	import type * as maplibregl from 'maplibre-gl';
	import { toast } from 'svelte-sonner';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { get_custom_index, get_greened_index } from '../js/api';
	import {
		get_accessibility_layer_fill_color,
		get_accessibility_layer_fill_opacity
	} from '../js/layers';
	import { LABEL_FONT } from '../js/map.js';
	import { cityLabel } from '../js/slug';
	import { AccessibilityIndexType, DEFAULT_TARGET, INDEX_CLASSIFICATION } from '../js/types';
	import { adjust_zoom, create_empty_geojson, get_green_types_code } from '../js/utils';
	import { current_city, loading } from '../stores/stores';
	import GreenTypesField from './fields/GreenTypesField.svelte';
	import IndexTypeField from './fields/IndexTypeField.svelte';
	import RangeField from './fields/RangeField.svelte';
	import TimeBudgetField from './fields/TimeBudgetField.svelte';
	import BaseMap from './maps/BaseMap.svelte';
	import ReferenceMap from './maps/ReferenceMap.svelte';
	import Legend from './plotting/Legend.svelte';
	import ToolPane from './ToolPane.svelte';

	/*
		The accessibility grid as MapLibre receives it: GeoJSON whose features carry
		a cell `id` and a value `v`.
	*/
	type CellProperties = { id: number; v: number };
	type CellFeature = GeoJSON.Feature<GeoJSON.Geometry, CellProperties>;
	type CellCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, CellProperties>;

	const ACCESSIBILITY_SOURCE = 'ACCESSIBILITY_SOURCE';
	const ACCESSIBILITY_LAYER = 'ACCESSIBILITY_LAYER';
	const SELECTED_CELL_SOURCE = 'SELECTED_CELL_SOURCE';
	const SELECTED_CELL_LAYER = 'SELECTED_CELL_LAYER';
	const DIFF_SOURCE = 'DIFF_SOURCE';
	const DIFF_OUTLINE_SOURCE = 'DIFF_OUTLINE_SOURCE';
	const DIFF_LAYER = 'DIFF_LAYER';
	const DIFF_TEXT_LAYER = 'DIFF_TEXT_LAYER';

	let current_index_type = AccessibilityIndexType.MINIMUM_DISTANCE;
	let current_green_types = ['parks', 'forests', 'grass'];
	let current_time_budget = 5;
	let current_greenarea_size = 0.5;

	let reference_data: CellCollection | undefined;
	let reference_map: maplibregl.Map | undefined;
	let new_data: CellCollection | undefined;
	let new_map: maplibregl.Map | undefined;
	let referenceMapLoaded = false;
	let newMapLoaded = false;

	// Draw resets on every rail change, so the rail always describes what is shown.
	$: target = DEFAULT_TARGET[current_index_type];
	$: can_draw = !!$current_city && newMapLoaded && referenceMapLoaded;

	// Another city: clear both maps and take the Before map there (After follows it).
	$: if ($current_city) {
		reset();
		reference_map?.flyTo({
			center: $current_city.feature.geometry.coordinates,
			pitch: 0,
			bearing: 0,
			animate: false
		});
	}

	// An index that came back empty, or a request that failed, is said once in a
	// toast rather than left as a notification block in the rail.
	function no_index() {
		toast.error('No index generated', {
			description: `No park with these characteristics found in ${cityLabel($current_city?.text)}.`
		});
	}

	const values = (data: CellCollection) => data.features.map((f) => f.properties.v);

	/** The cells whose value changed by more than rounding, with the change as `v`. */
	function accessibility_diffmap(before: CellCollection, after: CellCollection): CellCollection {
		const features: CellFeature[] = [];
		const A = [...before.features].sort((a, b) => b.properties.id - a.properties.id);
		const B = [...after.features].sort((a, b) => b.properties.id - a.properties.id);

		let i = 0;
		let j = 0;
		while (i < A.length && j < B.length) {
			const a = A[i];
			const b = B[j];
			if (a.properties.id === b.properties.id) {
				const diff = b.properties.v - a.properties.v;
				if (Math.abs(diff) > 0.01)
					features.push({
						type: 'Feature',
						geometry: a.geometry,
						properties: { id: a.properties.id, v: Math.round(diff * 10) / 10 }
					});
				i += 1;
				j += 1;
			} else if (a.properties.id > b.properties.id) i += 1;
			else j += 1;
		}
		return { type: 'FeatureCollection', features };
	}

	/** The changed cells merged into one outline. */
	function union_geojson(geojson: CellCollection): GeoJSON.Feature | GeoJSON.FeatureCollection {
		type Area = GeoJSON.Polygon | GeoJSON.MultiPolygon;
		let merged: Area | null = null;
		for (const feature of geojson.features) {
			const area = feature.geometry as Area;
			// turf returns null when a union degenerates; keep what we had.
			merged = merged === null ? area : (union(merged, area)?.geometry ?? merged);
		}
		// Nothing to merge: an empty collection, not a Feature with a null geometry,
		// which looks like GeoJSON but MapLibre will not accept.
		if (merged === null) return create_empty_geojson();
		return { type: 'Feature', geometry: merged, properties: {} };
	}

	/** Add a GeoJSON source, or replace its data if it is already there. */
	function set_source(map: maplibregl.Map, id: string, data: GeoJSON.GeoJSON) {
		const source = map.getSource<maplibregl.GeoJSONSource>(id);
		if (source) source.setData(data);
		else map.addSource(id, { type: 'geojson', data, generateId: true });
	}

	function add_diff_layer(diff: CellCollection, map: maplibregl.Map, labels = false) {
		set_source(map, DIFF_SOURCE, diff);
		set_source(map, DIFF_OUTLINE_SOURCE, union_geojson(diff));
		if (!map.getLayer(DIFF_LAYER))
			map.addLayer(
				{
					id: DIFF_LAYER,
					type: 'line',
					source: DIFF_OUTLINE_SOURCE,
					paint: { 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1, 16, 4, 22, 5] }
				},
				map.getLayer(SELECTED_CELL_LAYER) ? SELECTED_CELL_LAYER : undefined
			);
		if (labels && !map.getLayer(DIFF_TEXT_LAYER))
			map.addLayer({
				id: DIFF_TEXT_LAYER,
				type: 'symbol',
				source: DIFF_SOURCE,
				layout: {
					'text-field': ['get', 'v'],
					'text-size': ['interpolate', ['linear'], ['zoom'], 11, 0, 13, 11, 15, 20],
					'text-anchor': 'center',
					'text-font': LABEL_FONT
				},
				paint: { 'text-color': 'white', 'text-halo-color': 'black', 'text-halo-width': 1 }
			});
	}

	function add_selected_cell_layer(cell: GeoJSON.GeoJSON, map: maplibregl.Map) {
		set_source(map, SELECTED_CELL_SOURCE, cell);
		if (!map.getLayer(SELECTED_CELL_LAYER))
			map.addLayer({
				id: SELECTED_CELL_LAYER,
				type: 'line',
				source: SELECTED_CELL_SOURCE,
				paint: { 'line-color': 'white', 'line-width': 2 }
			});
	}

	function add_accessibility_layer(data: CellCollection, map: maplibregl.Map) {
		set_source(map, ACCESSIBILITY_SOURCE, data);
		if (!map.getLayer(ACCESSIBILITY_LAYER))
			map.addLayer({
				id: ACCESSIBILITY_LAYER,
				type: 'fill',
				source: ACCESSIBILITY_SOURCE,
				paint: { 'fill-outline-color': 'rgba(0, 0, 0, 0)' }
			});
		map.setPaintProperty(
			ACCESSIBILITY_LAYER,
			'fill-color',
			get_accessibility_layer_fill_color(
				values(data),
				current_index_type,
				INDEX_CLASSIFICATION[current_index_type],
				target
			)
		);
		map.setPaintProperty(
			ACCESSIBILITY_LAYER,
			'fill-opacity',
			get_accessibility_layer_fill_opacity()
		);
	}

	function remove_layers(map: maplibregl.Map | undefined) {
		// The map may be mid-teardown, after which every call throws.
		try {
			for (const layer of [DIFF_LAYER, DIFF_TEXT_LAYER, SELECTED_CELL_LAYER, ACCESSIBILITY_LAYER])
				if (map?.getLayer(layer)) map.removeLayer(layer);
			for (const source of [
				DIFF_SOURCE,
				DIFF_OUTLINE_SOURCE,
				SELECTED_CELL_SOURCE,
				ACCESSIBILITY_SOURCE
			])
				if (map?.getSource(source)) map.removeSource(source);
		} catch {
			/* map already destroyed */
		}
	}

	function reset() {
		new_data = undefined;
		reference_data = undefined;
		remove_layers(reference_map);
		remove_layers(new_map);
	}

	async function compute() {
		reset();
		// An empty green-type selection has no code; refuse it rather than ask the
		// API for every type, which is what it used to fall back to.
		const green_code = get_green_types_code(current_green_types);
		if (!$current_city || !reference_map || green_code === undefined) return no_index();

		loading.set(true);
		try {
			const result = await get_custom_index(
				current_index_type,
				$current_city.text,
				current_greenarea_size,
				current_time_budget,
				green_code
			);
			if (!result) return no_index();
			reference_data = result;
			add_accessibility_layer(result, reference_map);
			adjust_zoom(result, reference_map);
		} catch (error) {
			no_index();
			console.error('Draw: index request failed', error);
		} finally {
			loading.set(false);
		}
	}

	async function greenify(event: CustomEvent<{ cellid: number; feature: CellFeature }>) {
		const { cellid, feature } = event.detail;
		const green_code = get_green_types_code(current_green_types);
		if (!$current_city || !reference_map || !new_map || !reference_data) return;
		if (green_code === undefined) return no_index();

		add_selected_cell_layer(feature, reference_map);
		loading.set(true);
		try {
			const result = await get_greened_index(
				current_index_type,
				$current_city.text,
				current_greenarea_size,
				current_time_budget,
				green_code,
				// The new green is the cell itself, at most 4 ha.
				Math.min(current_greenarea_size, 4),
				cellid
			);
			if (!result) return;
			new_data = result;
			add_accessibility_layer(result, new_map);
			add_selected_cell_layer(feature, new_map);
			const diff = accessibility_diffmap(reference_data, result);
			add_diff_layer(diff, new_map, true);
			add_diff_layer(diff, reference_map);
			adjust_zoom(diff, new_map);
			adjust_zoom(diff, reference_map);
		} catch (error) {
			console.error('Draw: greenify request failed', error);
		} finally {
			loading.set(false);
		}
	}

	// The After map follows the Before map's camera, one way.
	function follow(event: CustomEvent<{ center: maplibregl.LngLat; zoom: number }>) {
		if (!new_map) return;
		const { center, zoom } = event.detail;
		const at = new_map.getCenter();
		// LngLat objects compare by identity; compare coordinates, below a pixel.
		if (
			Math.abs(at.lng - center.lng) > 1e-9 ||
			Math.abs(at.lat - center.lat) > 1e-9 ||
			Math.abs(new_map.getZoom() - zoom) > 1e-9
		)
			new_map.jumpTo({ center, zoom });
	}
</script>

<ToolPane>
	<svelte:fragment slot="rail">
		<IndexTypeField bind:value={current_index_type} onchange={reset} />
		<GreenTypesField
			bind:value={current_green_types}
			disabled={current_index_type === AccessibilityIndexType.EXPOSURE}
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
			disabled={current_index_type === AccessibilityIndexType.MINIMUM_DISTANCE}
			onchange={reset}
		/>

		<Button disabled={!can_draw} onclick={compute}><PencilIcon /> Draw</Button>

		<p class="hint">
			{#if reference_data}
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
				on:new_green_cell={greenify}
				on:camera={follow}
			>
				<Badge variant="secondary" class="caption">Before</Badge>
				{#if reference_data}
					<Legend values={values(reference_data)} type={current_index_type} threshold={target} />
				{/if}
			</ReferenceMap>
		</div>

		<div class="cell">
			<BaseMap container="draw_new_map" bind:ref={new_map} bind:mapLoaded={newMapLoaded}>
				<Badge variant="secondary" class="caption">After</Badge>
				{#if new_data}
					<Legend values={values(new_data)} type={current_index_type} threshold={target} />
				{/if}
			</BaseMap>
		</div>
	</div>
</ToolPane>

<style>
	/*
		Both maps are always present and always equal halves. The After column
		was `visibility: hidden` until a cell was picked, which still reserves
		its box — so Before was permanently half-width with nothing beside it.
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
