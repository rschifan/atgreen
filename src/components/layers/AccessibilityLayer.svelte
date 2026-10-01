<script lang="ts">
	/**
	 * Measure's choropleth: the selected index for the current city, coloured
	 * against its target. Hovering reads a cell out; clicking selects it, which
	 * the explanation layer answers with the green areas that cell can reach.
	 */
	import centroid from '@turf/centroid';
	import { onDestroy, onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { get_accessibility_layer } from '../../js/api';
	import {
		get_accessibility_layer_fill_color,
		get_accessibility_layer_fill_opacity
	} from '../../js/layers';
	import { hover_popup, maplibregl, track_hover } from '../../js/map';
	import { describe_cell, type Grid, type TargetStoreImpl } from '../../js/types';
	import { adjust_zoom, create_empty_geojson } from '../../js/utils';
	import {
		current_accessibility_index,
		current_accessibility_index_data,
		current_cell,
		current_city
	} from '../../stores/stores';
	import LayerControls from '../maps/LayerControls.svelte';

	let { map, metadata }: { map: maplibregl.Map; metadata: TargetStoreImpl | undefined } = $props();

	const SOURCE = 'ACCESSIBILITY_INDEX_SOURCE';
	const LAYER = 'ACCESSIBILITY_INDEX_LAYER';
	const popup = hover_popup();
	let selected_cell_id: string | number | undefined;

	const target = $derived(metadata?.getTarget($current_accessibility_index));

	function show(grid: Grid) {
		map.getSource<maplibregl.GeoJSONSource>(SOURCE)?.setData(grid);
		adjust_zoom(grid, map);
		const index = target?.index;
		if (index && target)
			map.setPaintProperty(
				LAYER,
				'fill-color',
				get_accessibility_layer_fill_color(
					grid.features.map((f) => f.properties.v),
					index.type,
					index.classification,
					target.threshold
				)
			);
		map.setPaintProperty(LAYER, 'fill-opacity', get_accessibility_layer_fill_opacity());
		current_accessibility_index_data.set(grid);
	}

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
	});

	/*
		One request per (city, index), a moment after the last change, so clicking
		through the rail does not fetch every grid on the way (Turin's is ~800 KB).
		alova caches each, so coming back to one is instant; a response for a pair
		the user has already moved on from is dropped.
	*/
	$effect(() => {
		const city = $current_city?.text;
		const band = metadata?.getBand($current_accessibility_index);
		if (!city || band === undefined) return;
		let stale = false;
		const timer = setTimeout(() => {
			get_accessibility_layer(city, band)
				.send()
				.then(
					(grid) => {
						if (!stale && grid?.features?.length) show(grid);
					},
					(error) => {
						if (!stale) console.error('Measure: index grid request failed', error);
					}
				);
		}, 300);
		return () => {
			stale = true;
			clearTimeout(timer);
		};
	});

	// A selected cell dims the rest; deselecting restores them and re-frames the city.
	$effect(() => {
		const cell = $current_cell;
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
		// Read, not tracked: a new grid must not re-frame the map by itself here.
		const grid = get(current_accessibility_index_data);
		if (grid) adjust_zoom(grid, map);
	});

	onDestroy(() => {
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
