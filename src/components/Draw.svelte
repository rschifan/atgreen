<script lang="ts">
	/**
	 * What one more green area would change. "Before" shows an index the user
	 * builds; a click on one of its cells recomputes the index as if that cell were
	 * green, shown "After", with the cells that changed outlined and labelled.
	 */
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import { union } from '@turf/union';
	import type * as GeoJSON from 'geojson';
	// Type-only: value imports go through js/map, which registers the map worker.
	import type * as maplibregl from 'maplibre-gl';
	import { untrack } from 'svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { get_custom_index, get_greened_index } from '../js/api';
	import {
		get_accessibility_layer_fill_color,
		get_accessibility_layer_fill_opacity
	} from '../js/layers';
	import { LABEL_FONT } from '../js/map';
	import { toast_no_index } from '../js/notify';
	import {
		AccessibilityIndexType,
		DEFAULT_TARGET,
		INDEX_CLASSIFICATION,
		type ComputedGrid
	} from '../js/types';
	import { adjust_zoom, create_empty_geojson, get_green_types_code } from '../js/utils';
	import { current_city, loading } from '../stores/stores';
	import IndexParamsFields from './fields/IndexParamsFields.svelte';
	import BaseMap from './maps/BaseMap.svelte';
	import ReferenceMap from './maps/ReferenceMap.svelte';
	import Legend from './plotting/Legend.svelte';
	import ToolPane from './ToolPane.svelte';

	type CellFeature = ComputedGrid['features'][number];

	const ACCESSIBILITY_SOURCE = 'ACCESSIBILITY_SOURCE';
	const ACCESSIBILITY_LAYER = 'ACCESSIBILITY_LAYER';
	const SELECTED_CELL_SOURCE = 'SELECTED_CELL_SOURCE';
	const SELECTED_CELL_LAYER = 'SELECTED_CELL_LAYER';
	const DIFF_SOURCE = 'DIFF_SOURCE';
	const DIFF_OUTLINE_SOURCE = 'DIFF_OUTLINE_SOURCE';
	const DIFF_LAYER = 'DIFF_LAYER';
	const DIFF_TEXT_LAYER = 'DIFF_TEXT_LAYER';

	let type = $state(AccessibilityIndexType.MINIMUM_DISTANCE);
	let green_types = $state(['parks', 'forests', 'grass']);
	let size = $state(0.5);
	let time = $state(5);

	let reference_data = $state.raw<ComputedGrid>();
	let reference_map = $state.raw<maplibregl.Map>();
	let new_data = $state.raw<ComputedGrid>();
	let new_map = $state.raw<maplibregl.Map>();
	let referenceMapLoaded = $state(false);
	let newMapLoaded = $state(false);

	// Draw resets on every rail change, so the rail always describes what is shown.
	const target = $derived(DEFAULT_TARGET[type]);
	const can_draw = $derived(!!$current_city && newMapLoaded && referenceMapLoaded);

	// Another city: clear both maps and take the Before map there (After follows it).
	$effect(() => {
		const city = $current_city;
		const map = reference_map;
		if (!city) return;
		untrack(reset);
		map?.flyTo({
			center: city.feature.geometry.coordinates as [number, number],
			pitch: 0,
			bearing: 0,
			animate: false
		});
	});

	const values = (data: ComputedGrid) => data.features.map((f) => f.properties.v);

	/** The cells whose value changed by more than rounding, with the change as `v`. */
	function accessibility_diffmap(before: ComputedGrid, after: ComputedGrid): ComputedGrid {
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
	function union_geojson(cells: ComputedGrid): GeoJSON.Feature | GeoJSON.FeatureCollection {
		// Nothing to merge: an empty collection, not a Feature with a null geometry,
		// which looks like GeoJSON but MapLibre will not accept.
		if (cells.features.length === 0) return create_empty_geojson();
		return union(cells) ?? create_empty_geojson();
	}

	/** Add a GeoJSON source, or replace its data if it is already there. */
	function set_source(map: maplibregl.Map, id: string, data: GeoJSON.GeoJSON) {
		const source = map.getSource<maplibregl.GeoJSONSource>(id);
		if (source) source.setData(data);
		else map.addSource(id, { type: 'geojson', data, generateId: true });
	}

	function add_diff_layer(diff: ComputedGrid, map: maplibregl.Map, labels = false) {
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

	function add_accessibility_layer(data: ComputedGrid, map: maplibregl.Map) {
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
			get_accessibility_layer_fill_color(values(data), type, INDEX_CLASSIFICATION[type], target)
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
		const green_code = get_green_types_code(green_types);
		if (!$current_city || !reference_map || green_code === undefined)
			return toast_no_index($current_city?.text);

		loading.set(true);
		try {
			const result = await get_custom_index(type, $current_city.text, size, time, green_code);
			if (!result) return toast_no_index($current_city?.text);
			reference_data = result;
			add_accessibility_layer(result, reference_map);
			adjust_zoom(result, reference_map);
		} catch (error) {
			toast_no_index($current_city?.text);
			console.error('Draw: index request failed', error);
		} finally {
			loading.set(false);
		}
	}

	async function greenify(cellid: number, feature: GeoJSON.Feature) {
		const green_code = get_green_types_code(green_types);
		if (!$current_city || !reference_map || !new_map || !reference_data) return;
		if (green_code === undefined) return toast_no_index($current_city?.text);

		add_selected_cell_layer(feature, reference_map);
		loading.set(true);
		try {
			const result = await get_greened_index(
				type,
				$current_city.text,
				size,
				time,
				green_code,
				// The new green is the cell itself, at most 4 ha.
				Math.min(size, 4),
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
	function follow(center: maplibregl.LngLat, zoom: number) {
		if (!new_map) return;
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
	{#snippet rail()}
		<IndexParamsFields bind:type bind:green_types bind:size bind:time onchange={reset} />

		<Button disabled={!can_draw} onclick={compute}><PencilIcon /> Draw</Button>

		<p class="m-0 text-[0.8125rem] leading-snug text-muted-foreground">
			{#if reference_data}
				Click a cell on the Before map to greenify it.
			{:else}
				Choose your parameters and press Draw.
			{/if}
		</p>
	{/snippet}

	<div class="pair">
		<div class="cell">
			<ReferenceMap
				container="draw_reference_map"
				bind:ref={reference_map}
				bind:mapLoaded={referenceMapLoaded}
				ongreen={greenify}
				oncamera={follow}
			>
				<Badge variant="secondary" class="caption">Before</Badge>
				{#if reference_data}
					<Legend values={values(reference_data)} {type} threshold={target} />
				{/if}
			</ReferenceMap>
		</div>

		<div class="cell">
			<BaseMap container="draw_new_map" bind:ref={new_map} bind:mapLoaded={newMapLoaded}>
				<Badge variant="secondary" class="caption">After</Badge>
				{#if new_data}
					<Legend values={values(new_data)} {type} threshold={target} />
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

	/* "Before" / "After": a caption over each map, never a click target. */
	.pair :global(.caption) {
		position: absolute;
		top: 0.75rem;
		left: 0.75rem;
		z-index: 10;
		pointer-events: none;
	}
</style>
