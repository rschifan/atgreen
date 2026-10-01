<script lang="ts">
	/**
	 * The two buttons every data layer gets: hide or show it, and fit the map to
	 * its data. Measure, Create and Explore each had their own copy; Explore's
	 * toggled its icon and never touched the layer.
	 */
	import EyeIcon from '@lucide/svelte/icons/eye';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import ScanIcon from '@lucide/svelte/icons/scan';
	import type * as GeoJSON from 'geojson';
	import type * as maplibregl from 'maplibre-gl';
	import { adjust_zoom } from '../../js/utils';
	import ButtonMap from './ButtonMap.svelte';

	let {
		map,
		layers,
		data,
		noun
	}: {
		map: maplibregl.Map;
		/** The layer ids the toggle shows and hides together. */
		layers: string[];
		/** What "fit" frames. */
		data: GeoJSON.FeatureCollection | undefined;
		/** Named in the toggle's label: "Hide the {noun}". */
		noun: string;
	} = $props();

	let visible = $state(true);

	$effect(() => {
		const value = visible ? 'visible' : 'none';
		for (const layer of layers)
			if (map.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', value);
	});
</script>

<ButtonMap
	{map}
	title={visible ? `Hide the ${noun}` : `Show the ${noun}`}
	icon={visible ? EyeOffIcon : EyeIcon}
	action={() => (visible = !visible)}
/>
<ButtonMap {map} title="Center and zoom" icon={ScanIcon} action={() => adjust_zoom(data, map)} />
