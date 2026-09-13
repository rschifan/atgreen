<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	import buffer from '@turf/buffer';
	import { mapbox } from '../../js/mapbox';
	import { current_city } from '../../stores/stores';

	export let map: mapbox.Map;
	export let data: object;
	export let userInteracting: boolean;

	const empty_geojson = { type: 'FeatureCollection', features: [] };
	const SUMMARY_SOURCE = 'SUMMARY_SOURCE';
	const SUMMARY_LAYER = 'SUMMARY_LAYER';

	const SELECTED_CITY_SOURCE = 'SELECTED_CITY_SOURCE';
	const SELECTED_CITY_LAYER = 'SELECTED_CITY_LAYER';
	const SELECTED_CITY_LABEL_LAYER = 'SELECTED_CITY_LABEL_LAYER';
	const CITY_LABEL_LAYER = 'CITY_LABEL_LAYER';

	let hovered_accessibility_cell_id: number = 0;
	let selected_cell_id: number;
	let colors = ['#74c476', '#31a354', '#006d2c', 'white'];

	// const popup = new mapbox.Popup({
	// 	closeButton: false,
	// 	closeOnClick: false
	// });

	// function reset_filters() {
	// 	if (map && map.getLayer(SUMMARY_LAYER) && map.getLayer(GREENAREAS_LABELS_LAYER)) {
	// 		map.setFilter(SUMMARY_LAYER, []);
	// 		map.setFilter(GREENAREAS_LABELS_LAYER, []);
	// 	}
	// }

	// $: if (selected_green_areas) {
	// 	filter_by_name(selected_green_areas);
	// }

	// function filter_by_name(greenareas: []) {
	// 	if (map && map.getLayer(SUMMARY_LAYER))
	// 		map.setFilter(SUMMARY_LAYER, ['in', ['get', 'osm_name'], ['literal', greenareas]]);

	// 	if (map && map.getLayer(GREENAREAS_LABELS_LAYER))
	// 		map.setFilter(GREENAREAS_LABELS_LAYER, ['in', ['get', 'osm_name'], ['literal', greenareas]]);
	// }

	// $: if (data && data.features && data.features.length > 0) {
	// 	const green_areas_source = map?.getSource(SUMMARY_SOURCE);
	// 	if (green_areas_source) {
	// 		green_areas_source.setData(data);
	// 	}
	// }

	let selected_feature = undefined;

	function move_center(center) {
		map.flyTo({
			center: center,
			zoom: 0.5,
			essential: true,
			animate: false
		});
	}

	onMount(() => {
		console.log('SummaryLayer - onMount');

		if (!map.getSource(SUMMARY_SOURCE))
			map.addSource(SUMMARY_SOURCE, {
				type: 'geojson',
				data: data ? data : empty_geojson
			});

		if (!map.getSource(SELECTED_CITY_SOURCE))
			map.addSource(SELECTED_CITY_SOURCE, {
				type: 'geojson',
				data: empty_geojson
			});

		// if (!map.getLayer(SELECTED_CITY_LAYER))
		// 	map.addLayer({
		// 		id: SELECTED_CITY_LAYER,
		// 		type: 'fill-extrusion',
		// 		source: SELECTED_CITY_SOURCE,
		// 		paint: {
		// 			'fill-extrusion-base': 0,
		// 			'fill-extrusion-color': 'red',
		// 			'fill-extrusion-height': 1000000,
		// 			'fill-extrusion-opacity': 1
		// 		}
		// 	});

		if (!map.getLayer(CITY_LABEL_LAYER))
			map.addLayer({
				id: CITY_LABEL_LAYER,
				type: 'symbol',
				source: SUMMARY_SOURCE,
				minzoom: 2,
				layout: {
					'text-field': ['get', 'name'],
					'text-justify': 'auto',
					'text-variable-anchor': ['top', 'left', 'bottom', 'right'],
					'text-size': {
						base: 1.75,
						stops: [
							[2, 12],
							[10, 20],
							[20, 30]
						]
					}
				},
				paint: {
					'text-halo-width': 1,
					'text-halo-color': 'black',
					'text-color': 'white'
				}
			});

		if (!map.getLayer(SELECTED_CITY_LABEL_LAYER))
			map.addLayer(
				{
					id: SELECTED_CITY_LABEL_LAYER,
					type: 'symbol',
					source: SELECTED_CITY_SOURCE,
					layout: {
						'text-field': ['get', 'name'],
						'text-variable-anchor': ['top', 'left', 'bottom', 'right'],
						'text-justify': 'auto',
						'text-size': 15,
						'text-offset': [100, 0]
					},
					paint: {
						'text-halo-width': 8,
						'text-halo-color': 'red',
						'text-color': 'white'
					}
				},
				CITY_LABEL_LAYER
			);

		if (!map.getLayer(SUMMARY_LAYER))
			map.addLayer(
				{
					id: SUMMARY_LAYER,
					type: 'circle',
					source: SUMMARY_SOURCE,
					paint: {
						// Make circles larger as the user zooms from z12 to z22.
						'circle-radius': {
							base: 1.75,
							stops: [
								[1, 1.3],
								[10, 50]
							]
						},
						// Color circles by ethnicity, using a `match` expression.
						'circle-color': [
							'case',
							['==', ['feature-state', 'hover'], true],
							'red',
							['==', ['feature-state', 'selected'], true],
							'red',
							'white'
						],

						'circle-stroke-color': [
							'case',
							['==', ['feature-state', 'hover'], true],
							'white',
							['==', ['feature-state', 'selected'], true],
							'white',
							'black'
						],
						'circle-stroke-opacity': 1,
						'circle-stroke-width': [
							'case',
							['==', ['feature-state', 'hover'], true],
							2,
							['==', ['feature-state', 'selected'], true],
							2,
							0.2
						]
					}
				},
				SELECTED_CITY_LABEL_LAYER
			);

		map.on('click', [SUMMARY_LAYER, CITY_LABEL_LAYER], (e) => {
			if (e.features && e.features.length > 0) {
				if (!map.getSource(SUMMARY_SOURCE)) return;

				// popup?.remove();

				let current_feature = e.features[0];
				let clicked_cell_id = current_feature.id;

				if (selected_cell_id)
					map.setFeatureState(
						{ source: SUMMARY_SOURCE, id: selected_cell_id },
						{ selected: false }
					);
				selected_cell_id = clicked_cell_id;

				map.setFeatureState({ source: SUMMARY_SOURCE, id: selected_cell_id }, { selected: true });

				current_city.set({ text: current_feature.properties.name, feature: current_feature });

				let center = current_feature.geometry.coordinates;
				if (center) move_center(center);

				selected_feature = current_feature;
			}
		});

		map.on('mouseenter', [SUMMARY_LAYER, CITY_LABEL_LAYER], (e: mapbox.MapMouseEvent) => {
			if (!e.features || e.features.length <= 0) return;
			if (!map.getSource(SUMMARY_SOURCE)) return;

			let current_feature = e.features[0];
			let cell_id = current_feature.id;

			map.getCanvas().style.cursor = 'pointer';

			if (hovered_accessibility_cell_id && hovered_accessibility_cell_id != 0) {
				map.setFeatureState(
					{ source: SUMMARY_SOURCE, id: hovered_accessibility_cell_id },
					{ hover: false }
				);
			}
			map.setFeatureState({ source: SUMMARY_SOURCE, id: cell_id }, { hover: true });

			hovered_accessibility_cell_id = cell_id;

			// update_popup(current_feature, e);
		});

		map.on('mouseleave', [SUMMARY_LAYER, CITY_LABEL_LAYER], (e: mapbox.MapMouseEvent) => {
			map.getCanvas().style.cursor = '';

			if (map && map.getSource(SUMMARY_SOURCE))
				map.setFeatureState(
					{ source: SUMMARY_SOURCE, id: hovered_accessibility_cell_id },
					{ hover: false }
				);

			hovered_accessibility_cell_id = 0;

			// popup?.remove();
		});

		map.on('mousemove', SUMMARY_LAYER, (e: mapbox.MapMouseEvent) => {
			if (!e.features || e.features.length <= 0) return;
			if (!map.getSource(SUMMARY_SOURCE)) return;

			let current_feature = e.features[0];
			let cell_id = current_feature.id;

			if (hovered_accessibility_cell_id != 0) {
				map.setFeatureState(
					{ source: SUMMARY_SOURCE, id: hovered_accessibility_cell_id },
					{ hover: false }
				);
			}
			map.setFeatureState({ source: SUMMARY_SOURCE, id: cell_id }, { hover: true });
			hovered_accessibility_cell_id = cell_id;
		});

		current_city.subscribe((value) => {
			if (value) {
				if (!map.getSource(SUMMARY_SOURCE)) return;

				const city = data.features.filter((el) => {
					return el.properties.name == value.text;
				});
				if (city.length > 0) {
					if (selected_feature)
						map.setFeatureState(
							{ source: SUMMARY_SOURCE, id: selected_feature.id },
							{ selected: false }
						);
					selected_feature = city[0];

					map.setFeatureState(
						{ source: SUMMARY_SOURCE, id: selected_feature.id },
						{ selected: true }
					);

					selected_cell_id = selected_feature.id;
					move_center(selected_feature.geometry.coordinates);

					const buffered_feature = buffer(selected_feature, 15);
					if (map && map.getSource(SELECTED_CITY_SOURCE))
						map.getSource(SELECTED_CITY_SOURCE).setData(buffered_feature);
				}
			}
		});
	});

	onDestroy(() => {
		console.log('SummaryLayer - destroy');

		map.off('mousemove', SUMMARY_LAYER);
		map.off('mouseleave', SUMMARY_LAYER);
		map.off('mouseenter', SUMMARY_LAYER);
		map.off('click', SUMMARY_LAYER);

		map.removeLayer(SUMMARY_LAYER);
		map.removeLayer(CITY_LABEL_LAYER);
		map.removeLayer(SELECTED_CITY_LABEL_LAYER);
		map.removeSource(SUMMARY_SOURCE);
	});
</script>

<!-- {#if data && data.features.length > 0}
	<ButtonMap title="Center and zoom" action={center_and_zoom} {map} icon={FitToScreen} />
{/if} -->

<style>
</style>
