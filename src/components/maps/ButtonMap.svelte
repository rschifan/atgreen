<script lang="ts">
	/**
	 * A button in a map's top-right control stack: an icon, named by its tooltip
	 * and its accessible label. Every map control in the app is one of these.
	 */
	import { onDestroy, onMount, type Component } from 'svelte';
	import type * as maplibregl from 'maplibre-gl';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';

	let {
		map,
		icon: Icon,
		title,
		action = () => {}
	}: {
		map: maplibregl.Map;
		/** A @lucide/svelte icon. */
		icon: Component;
		title: string;
		action?: () => void;
	} = $props();

	let container: HTMLDivElement;
	/*
		MapLibre takes any object with onAdd/onRemove. onAdd hands it the element
		below, which MapLibre then moves into its own control bar — outside the DOM
		Svelte manages, so Svelte cannot take it out again. IControl's contract is
		that onRemove removes it; the no-op here left "Deselect cell" on screen
		after the cell was deselected.
	*/
	const control: maplibregl.IControl = {
		onAdd: () => container,
		// eslint-disable-next-line svelte/no-dom-manipulating -- MapLibre owns this node now (see above)
		onRemove: () => container.remove()
	};

	onMount(() => map.addControl(control, 'top-right'));

	onDestroy(() => {
		// The parent map may already have been removed, in which case removeControl
		// throws and takes the rest of the teardown with it.
		try {
			map?.removeControl(control);
		} catch {
			/* map already destroyed */
		}
	});
</script>

<div bind:this={container} class="maplibregl-ctrl">
	<Tooltip.Root>
		<Tooltip.Trigger
			class={buttonVariants({ variant: 'secondary', size: 'icon' })}
			aria-label={title}
			onclick={action}
		>
			<Icon />
		</Tooltip.Trigger>
		<Tooltip.Content side="left">{title}</Tooltip.Content>
	</Tooltip.Root>
</div>
