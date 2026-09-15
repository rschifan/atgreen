<script lang="ts">
	import { refit_zoom } from '../../js/utils';
	import 'mapbox-gl/dist/mapbox-gl.css';
	import { createEventDispatcher, onDestroy, onMount, setContext } from 'svelte';
	import type { Unsubscriber } from 'svelte/store';
	import { get_default_map_props, key, mapbox } from '../../js/mapbox.js';
	import { current_city, hovered_feature } from '../../stores/stores.js';

	const dispatch = createEventDispatcher();

	function click_on_cell(feature: object) {
		dispatch('new_green_cell', { cellid: feature.properties.id, feature: feature });
	}

	function update_center(center: []) {
		dispatch('update_center', { center: center });
	}

	function update_zoom(current: number) {
		dispatch('update_zoom', { zoom: current });
	}

	let map: mapbox.Map;

	export let mapLoaded = false;
	export let styleLoaded = false;
	let height: number;
	export let container: string;
	export let ref: object;

	let width = 0;

	let unsubscribe_hovered_feature: Unsubscriber;

	const ACCESSIBILITY_SOURCE = 'ACCESSIBILITY_SOURCE';
	const ACCESSIBILITY_LAYER = 'ACCESSIBILITY_LAYER';

	let hovered_accessibility_cell_id = 0;

	const popup = new mapbox.Popup({
		closeButton: false,
		closeOnClick: false,
		anchor: 'bottom'
	}).setLngLat([0, 0]);

	onMount(() => {
		console.log('ReferenceMap - mount');

		init();
	});

	onDestroy(() => {
		// See BaseMap: dropping the DOM node does not release the WebGL context.
		map?.remove();
		if (unsubscribe_hovered_feature) unsubscribe_hovered_feature();
	});

	function init() {
		map = new mapbox.Map(
			get_default_map_props(container, $current_city.feature.geometry.coordinates)
		);

		map.on('style.load', () => {
			styleLoaded = true;
		});

		map.on('idle', () => {
			update_center(map.getCenter());
			update_zoom(map.getZoom());
		});

		map.on('load', async () => {
			mapLoaded = true;

			if (!map) return;

			map.on('move', () => {
				update_center(map.getCenter());
			});

			map.on('zoom', () => {
				update_zoom(map.getZoom());
			});

			map.on('mouseenter', ACCESSIBILITY_LAYER, (e: mapbox.MapMouseEvent) => {
				if (!e.features || e.features.length <= 0) return;

				map.getCanvas().style.cursor = 'pointer';
				let current_feature = e.features[0];
				let cell_id = current_feature.id;

				// update_popup(current_feature);

				if (hovered_accessibility_cell_id && hovered_accessibility_cell_id != 0) {
					map.setFeatureState(
						{ source: ACCESSIBILITY_SOURCE, id: hovered_accessibility_cell_id },
						{ hover: false }
					);
				}

				map.setFeatureState({ source: ACCESSIBILITY_SOURCE, id: cell_id }, { hover: true });
				hovered_accessibility_cell_id = cell_id;

				// update_popup(current_feature);
				if (
					($hovered_feature && $hovered_feature.properties.id != current_feature.properties.id) ||
					!$hovered_feature
				)
					hovered_feature.set(current_feature);
			});

			map.on('mouseleave', () => {
				map.getCanvas().style.cursor = '';

				popup.remove();

				if (map && map.getSource(ACCESSIBILITY_SOURCE))
					map.setFeatureState(
						{ source: ACCESSIBILITY_SOURCE, id: hovered_accessibility_cell_id },
						{ hover: false }
					);
				hovered_accessibility_cell_id = 0;
				hovered_feature.set(null);
			});

			map.on('mousemove', ACCESSIBILITY_LAYER, (e: mapbox.MapMouseEvent) => {
				if (!e.features || e.features.length <= 0) return;

				map.getCanvas().style.cursor = 'pointer';

				let current_feature = e.features[0];
				let cell_id = current_feature.id;

				// update_popup(current_feature);
				if (
					($hovered_feature && $hovered_feature.properties.id != current_feature.properties.id) ||
					!$hovered_feature
				)
					hovered_feature.set(current_feature);

				if (hovered_accessibility_cell_id != 0) {
					map.setFeatureState(
						{ source: ACCESSIBILITY_SOURCE, id: hovered_accessibility_cell_id },
						{ hover: false }
					);
				}
				// if (current_feature.properties.v != 0) {

				map.setFeatureState({ source: ACCESSIBILITY_SOURCE, id: cell_id }, { hover: true });
				hovered_accessibility_cell_id = cell_id;
				// } else map.getCanvas().style.cursor = '';

				// update_popup(current_feature);
				if (
					($hovered_feature && $hovered_feature.properties.id != current_feature.properties.id) ||
					!$hovered_feature
				)
					hovered_feature.set(current_feature);
			});

			map.on('click', ACCESSIBILITY_LAYER, (e) => {
				if (e.features && e.features.length > 0) {
					// popup?.remove();

					let current_feature = e.features[0];

					click_on_cell(current_feature);
				}
			});
		});

		ref = map;
	}

	setContext(key, {
		getMap: () => map
	});

	$: if (width && height && map) {
		map.resize();
		refit_zoom(map);
	}
</script>

<div class="map-root" bind:clientWidth={width} bind:clientHeight={height}>
	<div id={container} />

	{#if map}
		<slot />
	{/if}
</div>

<style>
	/*
		The map fills its stage absolutely, so no ancestor has to cooperate by
		passing a height down. `height` is measured rather than declared, which
		finally gives the `$: if (width && height && map) map.resize()` guard a
		real input instead of the constant 500 it used to compare.
	*/
	.map-root {
		position: absolute;
		inset: 0;
	}

	.map-root > :global(div) {
		width: 100%;
		height: 100%;
	}
</style>
