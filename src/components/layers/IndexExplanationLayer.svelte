<script lang="ts">
	import { Exit } from 'carbon-icons-svelte';
	import { onDestroy, onMount } from 'svelte';
	import type { Unsubscriber } from 'svelte/store';
	import { BOUNDARY_MAP_COLOR, TEXT_MAP_COLOR } from '../../js/colors';
	import { mapbox } from '../../js/mapbox';
	import { AccessibilityIndexType } from '../../js/types';
	import { adjust_zoom } from '../../js/utils';
	import {
		current_accessibility_index,
		current_cell,
		current_city,
		loading
	} from '../../stores/stores';
	import ButtonMap from '../maps/ButtonMap.svelte';

	const empty_geojson = { type: 'FeatureCollection', features: [] };

	export let metadata;
	export let map: mapbox.Map;

	let PGAS_SOURCE = 'PGAS_SOURCE';
	let PGAS_LAYER = 'PGAS_LAYER';
	let PGAS_LABELS_LAYER = 'PGAS_LABELS_LAYER';

	$: target = metadata?.getTarget($current_accessibility_index);
	$: threshold = target?.threshold;
	$: index = target?.index;
	$: type = index?.type;
	$: unit = index?.unit;
	$: size = index?.size;
	$: distance = index?.distance;

	let unsubscribe_current_cell_event: Unsubscriber;

	onMount(() => {
		console.log('ExplanationLayer - onmount');
		init();

		unsubscribe_current_cell_event = current_cell.subscribe((data) => {
			if (data) compute_explanation();
		});
	});

	onDestroy(() => {
		console.log('ExplanationLayer - destroy');

		if (unsubscribe_current_cell_event) unsubscribe_current_cell_event();

		// The parent map may already have been removed, after which these throw.
		try {
			for (const layer of [PGAS_LABELS_LAYER, PGAS_LAYER]) {
				if (map?.getLayer(layer)) map.removeLayer(layer);
			}
			if (map?.getSource(PGAS_SOURCE)) map.removeSource(PGAS_SOURCE);
		} catch {
			/* map already destroyed */
		}
	});

	function init() {
		if (!map.getSource(PGAS_SOURCE))
			map.addSource(PGAS_SOURCE, {
				type: 'geojson',
				data: empty_geojson,
				generateId: true
			});
		if (!map.getLayer(PGAS_LAYER))
			map.addLayer({
				id: PGAS_LAYER,
				type: 'fill',
				source: PGAS_SOURCE,
				layout: {},
				paint: {
					'fill-outline-color': 'black',
					'fill-color': 'green',
					'fill-opacity': 1.0
				}
			});
		if (!map.getLayer(PGAS_LABELS_LAYER))
			map.addLayer({
				id: PGAS_LABELS_LAYER,
				type: 'symbol',
				source: PGAS_SOURCE,
				layout: {
					'text-field': ['get', 'osm_name'],
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
	}

	function get_cell(x: number, y: number, nrows: number) {
		return y + nrows * (x - 1);
	}

	function get_pgas_parameters(): { distance: number; pgas_size: number } {
		if (target)
			return {
				pgas_size: size,
				distance: distance
			};
		else return { pgas_size: 0, distance: 0 };
	}

	async function compute_explanation() {
		if (!$current_city) return;

		console.log($current_city);

		let params: { pgas_size: number; distance: number } = get_pgas_parameters();
		let response;

		try {
			loading.set(true);
			if (type == AccessibilityIndexType.MINIMUM_DISTANCE) {
				let params_url = new URLSearchParams({
					cityname: $current_city.text,
					source: get_cell(
						$current_cell.x,
						$current_cell.y,
						$current_city.feature.properties.nrows
					).toString(),
					pga_size: size.toString()
				});

				response = fetch('https://atgreen.hpc4ai.unito.it/rpc/closestpark_osm?' + params_url);
			}
			if (type == AccessibilityIndexType.EXPOSURE) {
				let params_url = new URLSearchParams({
					cityname: $current_city.text,
					source: get_cell(
						$current_cell.x,
						$current_cell.y,
						$current_city.feature.properties.nrows
					).toString(),
					pga_size: size.toString(),
					distance: distance.toString()
				});

				console.log('https://atgreen.hpc4ai.unito.it/rpc/allareaswithindistance_esa?' + params_url);
				response = fetch(
					'https://atgreen.hpc4ai.unito.it/rpc/allareaswithindistance_esa?' + params_url
				);
			} else if (type == AccessibilityIndexType.PER_PERSON) {
				let params_url = new URLSearchParams({
					cityname: $current_city.text,
					source: get_cell(
						$current_cell.x,
						$current_cell.y,
						$current_city.feature.properties.nrows
					).toString(),
					pga_size: size.toString(),
					distance: distance.toString()
				});

				console.log('https://atgreen.hpc4ai.unito.it/rpc/exposurewithindistance_osm?' + params_url);
				response = fetch(
					'https://atgreen.hpc4ai.unito.it/rpc/exposurewithindistance_osm?' + params_url
				);
			}

			// This had no .catch at all, and loading.set(true) above it: a failed
			// explanation request left the overlay up forever, because the enclosing
			// try/catch cannot see a rejection from a promise it did not await.
			if (!response) {
				loading.set(false);
				return;
			}
			try {
				const data = await response;
				if (!data.ok) throw new Error(`explanation request failed: HTTP ${data.status}`);
				const features = await data.json();
				if (features && features.features && features.features.length > 0) {
					map.getSource(PGAS_SOURCE)?.setData(features);
					adjust_zoom(features, map);
				}
			} finally {
				loading.set(false);
			}
		} catch (error) {
			loading.set(false);
			console.error('IndexExplanationLayer: explanation request failed', error);
		}
	}

	function back() {
		current_cell.set({ x: -1, y: -1 });
		if (map.getSource(PGAS_SOURCE)) map.getSource(PGAS_SOURCE).setData(empty_geojson);
	}
</script>

{#if $current_cell && $current_cell.x != -1 && $current_cell != -1}
	<ButtonMap title={'Deselect cell'} action={back} {map} icon={Exit} />
{/if}
