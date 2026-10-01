<script lang="ts">
	/**
	 * Create's map: the index the user just built, coloured against their target,
	 * with a popup that reads a cell out in words. Create mounts a new one for each
	 * result, so `data` and the index parameters are fixed for its lifetime; only
	 * the target moves.
	 */
	import centroid from '@turf/centroid';
	import type * as maplibregl from 'maplibre-gl';
	import type { Snippet } from 'svelte';
	import {
		get_accessibility_layer_fill_color,
		get_accessibility_layer_fill_opacity
	} from '../../js/layers';
	import { hover_popup, track_hover } from '../../js/map';
	import {
		AccessibilityIndexType,
		INDEX_CLASSIFICATION,
		describe_cell,
		type ComputedGrid
	} from '../../js/types';
	import { adjust_zoom } from '../../js/utils';
	import BaseMap from './BaseMap.svelte';
	import LayerControls from './LayerControls.svelte';

	let {
		container,
		data,
		index_type,
		size,
		distance,
		threshold,
		children
	}: {
		container: string;
		data: ComputedGrid;
		index_type: AccessibilityIndexType;
		/** The minimum park size (ha) and the time budget (min) it was built with. */
		size: number;
		distance: number;
		threshold: number;
		children?: Snippet;
	} = $props();

	const SOURCE = 'NEW_INDEX_SOURCE';
	const LAYER = 'NEW_INDEX_LAYER';
	const popup = hover_popup();

	let map = $state.raw<maplibregl.Map>();
	const values = $derived(data.features.map((f) => f.properties.v));

	function show(target: maplibregl.Map) {
		target.addSource(SOURCE, { type: 'geojson', data, generateId: true });
		target.addLayer({
			id: LAYER,
			type: 'fill',
			source: SOURCE,
			paint: { 'fill-outline-color': 'rgba(0, 0, 0, 0)' }
		});
		paint(target, threshold);
		adjust_zoom(data, target);

		track_hover(target, LAYER, SOURCE, (feature) => {
			if (!feature) return void popup.remove();
			popup
				.setLngLat(centroid(feature).geometry.coordinates as [number, number])
				.setHTML(
					describe_cell(feature.properties.v, { type: index_type, size, distance }, threshold)
				)
				.addTo(target);
		});
	}

	function paint(target: maplibregl.Map | undefined, value: number) {
		if (!target?.getLayer(LAYER)) return;
		target.setPaintProperty(
			LAYER,
			'fill-color',
			get_accessibility_layer_fill_color(
				values,
				index_type,
				INDEX_CLASSIFICATION[index_type],
				value
			)
		);
		target.setPaintProperty(LAYER, 'fill-opacity', get_accessibility_layer_fill_opacity());
	}

	// The Target slider recolours the map.
	$effect(() => paint(map, threshold));
</script>

<BaseMap {container} bind:ref={map} onload={show}>
	{@render children?.()}
</BaseMap>
{#if map}
	<LayerControls {map} layers={[LAYER]} {data} noun="accessibility layer" />
{/if}
