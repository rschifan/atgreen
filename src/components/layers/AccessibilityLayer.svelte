<script lang="ts">
	/**
	 * Measure's choropleth: the selected index for the current city, coloured
	 * against its target. Hovering reads a cell out; clicking selects it, which
	 * the explanation layer answers with the green areas that cell can reach.
	 */
	import centroid from '@turf/centroid';
	import type * as GeoJSON from 'geojson';
	import { useWatcher } from 'alova';
	import { onDestroy, onMount } from 'svelte';
	import type { Unsubscriber } from 'svelte/store';
	import { get_accessibility_layer } from '../../js/api';
	import {
		get_accessibility_layer_fill_color,
		get_accessibility_layer_fill_opacity
	} from '../../js/layers';
	import { hover_popup, maplibregl, track_hover } from '../../js/map';
	import { describe_cell, type TargetStoreImpl } from '../../js/types';
	import { adjust_zoom, create_empty_geojson } from '../../js/utils';
	import {
		current_accessibility_index,
		current_accessibility_index_data,
		current_cell,
		current_city,
		loading
	} from '../../stores/stores';
	import LayerControls from '../maps/LayerControls.svelte';

	export let metadata: TargetStoreImpl;
	export let map: maplibregl.Map;

	const SOURCE = 'ACCESSIBILITY_INDEX_SOURCE';
	const LAYER = 'ACCESSIBILITY_INDEX_LAYER';
	const popup = hover_popup();
	let selected_cell_id: string | number | undefined;

	$: target = metadata?.getTarget($current_accessibility_index);

	function paint(data: GeoJSON.FeatureCollection) {
		const index = target?.index;
		if (!index || !map.getLayer(LAYER)) return;
		map.setPaintProperty(
			LAYER,
			'fill-color',
			get_accessibility_layer_fill_color(
				data.features.map((f) => f.properties?.v),
				index.type,
				index.classification,
				target.threshold
			)
		);
		map.setPaintProperty(LAYER, 'fill-opacity', get_accessibility_layer_fill_opacity());
	}

	// One request per (city, band). `immediate: true` paid for one city selection
	// three times (~827 KB each for Turin), and `immediate: false` alone never
	// fires, because both stores are already set by the time this mounts.
	const request = useWatcher(
		() =>
			get_accessibility_layer(
				$current_city?.text ?? '',
				metadata?.getBand($current_accessibility_index) ?? -1
			),
		[current_city, current_accessibility_index],
		{ debounce: 500, immediate: false }
	);

	// The de-duplication key lives on a plain object, not in a `let`: Svelte 5
	// stops re-running a reactive block that reads and writes the same variable,
	// which silently stopped the fetch from ever firing.
	const requested = { key: undefined as string | undefined };
	$: {
		const city = $current_city?.text;
		const band = metadata?.getBand($current_accessibility_index);
		const key = `${city}|${band}`;
		if (city && band !== undefined && key !== requested.key) {
			requested.key = key;
			request.send();
		}
	}

	let unsubscribers: Unsubscriber[] = [];

	onMount(() => {
		map.addSource(SOURCE, { type: 'geojson', data: create_empty_geojson(), generateId: true });
		map.addLayer({
			id: LAYER,
			type: 'fill',
			source: SOURCE,
			paint: { 'fill-outline-color': 'rgba(0, 0, 0, 0)' }
		});

		const hover = track_hover(map, LAYER, SOURCE, (feature) => {
			if (!feature || !target) return void popup.remove();
			popup
				.setLngLat(centroid(feature).geometry.coordinates as [number, number])
				.setHTML(
					describe_cell(
						feature.properties.v,
						target.index,
						target.threshold,
						$current_accessibility_index
					)
				)
				.addTo(map);
		});

		map.on('click', LAYER, (e) => {
			const feature = e.features?.[0];
			if (!feature) return;
			popup.remove();
			hover.clear();
			if (selected_cell_id !== undefined)
				map.setFeatureState({ source: SOURCE, id: selected_cell_id }, { selected: false });
			selected_cell_id = feature.id;
			map.setFeatureState({ source: SOURCE, id: selected_cell_id }, { selected: true });
			current_cell.set({ x: feature.properties.x, y: feature.properties.y });
		});

		unsubscribers = [
			request.data.subscribe((value) => {
				if (value?.features?.length > 0) {
					map.getSource<maplibregl.GeoJSONSource>(SOURCE)?.setData(value);
					adjust_zoom(value, map);
					paint(value);
					current_accessibility_index_data.set(value);
				}
				loading.set(false);
			}),

			// A selected cell dims the rest; deselecting restores them and re-frames the city.
			current_cell.subscribe((cell) => {
				if (cell && cell.x !== -1 && cell.y !== -1) {
					map.setPaintProperty(LAYER, 'fill-opacity', [
						'case',
						['boolean', ['feature-state', 'selected'], false],
						1.0,
						['boolean', ['feature-state', 'hover'], false],
						1.0,
						0.15
					]);
					return;
				}
				map.setPaintProperty(LAYER, 'fill-opacity', get_accessibility_layer_fill_opacity());
				if (selected_cell_id !== undefined)
					map.setFeatureState({ source: SOURCE, id: selected_cell_id }, { selected: false });
				selected_cell_id = undefined;
				if ($current_accessibility_index_data) adjust_zoom($current_accessibility_index_data, map);
			})
		];
	});

	onDestroy(() => {
		unsubscribers.forEach((stop) => stop());
		// The map may already be gone, and every call below would then throw. Its
		// removal drops the handlers registered above.
		try {
			popup.remove();
			if (map.getLayer(LAYER)) map.removeLayer(LAYER);
			if (map.getSource(SOURCE)) map.removeSource(SOURCE);
		} catch {
			/* map already destroyed */
		}
		current_accessibility_index_data.set(undefined);
		// A selection belongs to this visit: kept, it came back dimming the map.
		current_cell.set(undefined);
	});
</script>

{#if $current_accessibility_index_data}
	<LayerControls
		{map}
		layers={[LAYER]}
		data={$current_accessibility_index_data}
		noun="accessibility layer"
	/>
{/if}
