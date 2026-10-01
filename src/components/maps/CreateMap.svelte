<script lang="ts">
	/**
	 * Create's map: the index the user just built, coloured against their target,
	 * with a popup that reads a cell out in words. Create mounts a new one for each
	 * result, so `data` and the index parameters are fixed for its lifetime; only
	 * the target moves.
	 */
	import centroid from '@turf/centroid';
	import type * as GeoJSON from 'geojson';
	import type * as maplibregl from 'maplibre-gl';
	import {
		get_accessibility_layer_fill_color,
		get_accessibility_layer_fill_opacity
	} from '../../js/layers.js';
	import { hover_popup, track_hover } from '../../js/map.js';
	import { AccessibilityIndexType, INDEX_CLASSIFICATION, describe_cell } from '../../js/types.js';
	import { adjust_zoom } from '../../js/utils.js';
	import BaseMap from './BaseMap.svelte';
	import LayerControls from './LayerControls.svelte';

	export let container: string;
	export let ref: maplibregl.Map | undefined = undefined;
	export let mapLoaded = false;
	export let styleLoaded = false;
	export let data: GeoJSON.FeatureCollection;
	export let index_type: AccessibilityIndexType;
	/** The minimum park size and the time budget the index was built with. */
	export let size: number;
	export let distance: number;
	export let threshold: number;

	const SOURCE = 'NEW_INDEX_SOURCE';
	const LAYER = 'NEW_INDEX_LAYER';
	const popup = hover_popup();
	const values = data.features.map((f) => f.properties?.v as number);

	function show(map: maplibregl.Map) {
		map.addSource(SOURCE, { type: 'geojson', data, generateId: true });
		map.addLayer({
			id: LAYER,
			type: 'fill',
			source: SOURCE,
			paint: { 'fill-outline-color': 'rgba(0, 0, 0, 0)' }
		});
		paint(map, threshold);
		adjust_zoom(data, map);

		track_hover(map, LAYER, SOURCE, (feature) => {
			if (!feature) return void popup.remove();
			const index = { type: index_type, size, distance };
			popup
				.setLngLat(centroid(feature).geometry.coordinates as [number, number])
				.setHTML(describe_cell(feature.properties.v, index, threshold))
				.addTo(map);
		});
	}

	function paint(map: maplibregl.Map | undefined, target: number) {
		if (!map?.getLayer(LAYER)) return;
		map.setPaintProperty(
			LAYER,
			'fill-color',
			get_accessibility_layer_fill_color(
				values,
				index_type,
				INDEX_CLASSIFICATION[index_type],
				target
			)
		);
		map.setPaintProperty(LAYER, 'fill-opacity', get_accessibility_layer_fill_opacity());
	}

	// The Target slider recolours the map.
	$: paint(ref, threshold);
</script>

<BaseMap {container} bind:ref bind:mapLoaded bind:styleLoaded onload={show}>
	<slot />
</BaseMap>
{#if ref}
	<LayerControls map={ref} layers={[LAYER]} {data} noun="accessibility layer" />
{/if}
