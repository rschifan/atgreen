<script lang="ts">
	/**
	 * Draw's "Before" map. Draw adds the accessibility grid to it; this hooks the
	 * grid up: hover feedback, a click on a cell asks Draw to greenify it, and the
	 * camera is reported so the "After" map can follow.
	 */
	import type * as GeoJSON from 'geojson';
	import type * as maplibregl from 'maplibre-gl';
	import type { Snippet } from 'svelte';
	import { track_hover } from '../../js/map';
	import type { ComputedCell } from '../../js/types';
	import BaseMap from './BaseMap.svelte';

	let {
		container,
		ref = $bindable(),
		mapLoaded = $bindable(false),
		ongreen,
		oncamera,
		children
	}: {
		container: string;
		ref?: maplibregl.Map;
		mapLoaded?: boolean;
		/** A cell was clicked: its id, and the cell as plain GeoJSON. */
		ongreen?: (id: number, cell: GeoJSON.Feature<GeoJSON.Geometry, ComputedCell>) => void;
		/** The camera moved. */
		oncamera?: (center: maplibregl.LngLat, zoom: number) => void;
		children?: Snippet;
	} = $props();

	// Added by Draw; named here only to listen to them.
	const ACCESSIBILITY_SOURCE = 'ACCESSIBILITY_SOURCE';
	const ACCESSIBILITY_LAYER = 'ACCESSIBILITY_LAYER';

	function wire(map: maplibregl.Map) {
		const report = () => oncamera?.(map.getCenter(), map.getZoom());
		map.on('move', report);
		map.on('idle', report);

		track_hover(map, ACCESSIBILITY_LAYER, ACCESSIBILITY_SOURCE);

		map.on('click', ACCESSIBILITY_LAYER, (e) => {
			const hit = e.features?.[0];
			if (!hit) return;
			// Plain GeoJSON, not MapLibre's feature object: Draw draws it as a source,
			// and the map's worker cannot serialise the class ("unregistered class").
			const properties = hit.properties as ComputedCell;
			ongreen?.(properties.id, {
				type: 'Feature',
				geometry: hit.geometry,
				properties: { ...properties }
			});
		});
	}
</script>

<BaseMap {container} bind:ref bind:mapLoaded onload={wire}>
	{@render children?.()}
</BaseMap>
