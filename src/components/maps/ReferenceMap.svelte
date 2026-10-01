<script lang="ts">
	/**
	 * Draw's "Before" map. Draw adds the accessibility grid to it; this hooks the
	 * grid up: hover feedback, a click on a cell asks Draw to greenify it, and the
	 * camera is reported so the "After" map can follow.
	 */
	import type * as maplibregl from 'maplibre-gl';
	import { createEventDispatcher } from 'svelte';
	import { track_hover } from '../../js/map.js';
	import BaseMap from './BaseMap.svelte';

	export let container: string;
	export let ref: maplibregl.Map | undefined = undefined;
	export let mapLoaded = false;
	export let styleLoaded = false;

	// Added by Draw; named here only to listen to them.
	const ACCESSIBILITY_SOURCE = 'ACCESSIBILITY_SOURCE';
	const ACCESSIBILITY_LAYER = 'ACCESSIBILITY_LAYER';

	const dispatch = createEventDispatcher();

	function wire(map: maplibregl.Map) {
		const report = () => dispatch('camera', { center: map.getCenter(), zoom: map.getZoom() });
		map.on('move', report);
		map.on('idle', report);

		track_hover(map, ACCESSIBILITY_LAYER, ACCESSIBILITY_SOURCE);

		map.on('click', ACCESSIBILITY_LAYER, (e) => {
			const hit = e.features?.[0];
			if (!hit) return;
			// Plain GeoJSON, not MapLibre's feature object: Draw draws it as a source,
			// and the map's worker cannot serialise the class ("unregistered class").
			const feature = {
				type: 'Feature',
				geometry: hit.geometry,
				properties: { ...hit.properties }
			};
			dispatch('new_green_cell', { cellid: hit.properties.id, feature });
		});
	}
</script>

<BaseMap {container} bind:ref bind:mapLoaded bind:styleLoaded onload={wire}>
	<slot />
</BaseMap>
