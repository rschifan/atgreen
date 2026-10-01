<script lang="ts">
	/**
	 * Why a cell scores what it does: once a cell is selected on Measure's map,
	 * the green areas behind its value — the nearest park, or everything within
	 * reach — drawn and named on the map.
	 */
	import XIcon from '@lucide/svelte/icons/x';
	import { onDestroy, onMount } from 'svelte';
	import type { Unsubscriber } from 'svelte/store';
	import { get_explanation } from '../../js/api';
	import { BOUNDARY_MAP_COLOR, TEXT_MAP_COLOR } from '../../js/colors';
	import { LABEL_FONT, maplibregl } from '../../js/map';
	import type { TargetStoreImpl } from '../../js/types';
	import { adjust_zoom, create_empty_geojson } from '../../js/utils';
	import {
		current_accessibility_index,
		current_cell,
		current_city,
		loading
	} from '../../stores/stores';
	import ButtonMap from '../maps/ButtonMap.svelte';

	export let metadata: TargetStoreImpl;
	export let map: maplibregl.Map;

	const SOURCE = 'PGAS_SOURCE';
	const LAYER = 'PGAS_LAYER';
	const LABELS_LAYER = 'PGAS_LABELS_LAYER';

	let unsubscribe_current_cell: Unsubscriber | undefined;

	onMount(() => {
		map.addSource(SOURCE, { type: 'geojson', data: create_empty_geojson(), generateId: true });
		map.addLayer({
			id: LAYER,
			type: 'fill',
			source: SOURCE,
			paint: { 'fill-outline-color': 'black', 'fill-color': 'green', 'fill-opacity': 1.0 }
		});
		map.addLayer({
			id: LABELS_LAYER,
			type: 'symbol',
			source: SOURCE,
			layout: {
				'text-field': ['get', 'osm_name'],
				'text-font': LABEL_FONT,
				'text-variable-anchor': ['top', 'left', 'bottom', 'right'],
				'text-justify': 'auto',
				'text-size': 10
			},
			paint: {
				'text-halo-width': 1,
				'text-halo-color': BOUNDARY_MAP_COLOR,
				'text-color': TEXT_MAP_COLOR
			}
		});

		unsubscribe_current_cell = current_cell.subscribe((cell) => {
			// {x: -1, y: -1} means "nothing selected"; it is a truthy object, so it
			// once fired a request for the cell id derived from (-1, -1).
			if (cell && cell.x !== -1 && cell.y !== -1) explain(cell);
		});
	});

	onDestroy(() => {
		unsubscribe_current_cell?.();
		// The map may already be gone, after which these throw.
		try {
			for (const layer of [LABELS_LAYER, LAYER]) if (map.getLayer(layer)) map.removeLayer(layer);
			if (map.getSource(SOURCE)) map.removeSource(SOURCE);
		} catch {
			/* map already destroyed */
		}
	});

	/** The grid numbers cells column by column, from 1. */
	function cell_id(x: number, y: number, nrows: number) {
		return y + nrows * (x - 1);
	}

	async function explain(cell: { x: number; y: number }) {
		const index = metadata?.getTarget($current_accessibility_index)?.index;
		if (!$current_city || !index) return;

		loading.set(true);
		try {
			const areas = await get_explanation(
				index.type,
				$current_city.text,
				cell_id(cell.x, cell.y, $current_city.feature.properties.nrows),
				index.size,
				index.distance
			);
			if (areas) {
				map.getSource<maplibregl.GeoJSONSource>(SOURCE)?.setData(areas);
				adjust_zoom(areas, map);
			}
		} catch (error) {
			console.error('IndexExplanationLayer: explanation request failed', error);
		} finally {
			loading.set(false);
		}
	}

	function back() {
		current_cell.set({ x: -1, y: -1 });
		map.getSource<maplibregl.GeoJSONSource>(SOURCE)?.setData(create_empty_geojson());
	}
</script>

{#if $current_cell && $current_cell.x != -1 && $current_cell.y != -1}
	<ButtonMap title="Deselect cell" action={back} {map} icon={XIcon} />
{/if}
