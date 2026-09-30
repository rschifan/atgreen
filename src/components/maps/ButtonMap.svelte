<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { Button } from 'carbon-components-svelte';
	import type * as maplibregl from 'maplibre-gl';

	let button: MapControl;
	let container: HTMLDivElement;

	export let map: maplibregl.Map;
	export let icon;
	export let title: string;
	export let action = () => {};

	class MapControl {
		onAdd() {
			return container;
		}

		onRemove() {}
	}

	onMount(() => {
		// console.log('MapControl - onMount');
		button = new MapControl();
		map.addControl(button, 'top-right');
	});

	onDestroy(() => {
		// The parent map may already have been removed, in which case removeControl
		// throws and takes the rest of the teardown with it.
		try {
			if (button) map?.removeControl(button);
		} catch {
			/* map already destroyed */
		}
	});
</script>

<!-- <div bind:this={container} class="maplibregl-ctrl-group maplibregl-ctrl"> -->
<div bind:this={container} class="maplibregl-ctrl">
	<!-- <button class="maplibregl-ctrl-icon" on:click={action} {title}>
		<slot />
	</button> -->

	<Button
		size="small"
		kind="secondary"
		tooltipPosition="left"
		iconDescription={title}
		on:click={action}
		{icon}
	/>
</div>

<style>
</style>
