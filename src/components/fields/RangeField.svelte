<script lang="ts">
	/**
	 * A labelled slider: the setting in the title row, the range under the
	 * track. Shared by every rail that asks for a size, a time or a target.
	 */
	import { Slider } from '$lib/components/ui/slider/index.js';
	import RailSection from '../RailSection.svelte';

	let {
		title,
		value = $bindable(),
		min,
		max,
		step = 1,
		unit = '',
		disabled = false,
		hint,
		onchange
	}: {
		title: string;
		/** May start undefined (a caller still loading its range); shows the minimum meanwhile. */
		value?: number;
		min: number;
		max: number;
		step?: number;
		/** Shown after the value: "ha", "min", "m²". */
		unit?: string;
		disabled?: boolean;
		hint?: string;
		/** When the user lets go: the moment to recompute, not every pixel of a drag. */
		onchange?: (value: number) => void;
	} = $props();

	const titleId = $props.id();
	// Numbers as they read in English ("0.5", never the "0,5" a browser locale
	// gave Carbon's number input), without a trailing ".0".
	const fmt = (n: number) => n.toLocaleString('en', { maximumFractionDigits: 2 });
</script>

<RailSection {title} {titleId} {hint} value="{fmt(value ?? min)}{unit ? ` ${unit}` : ''}">
	<Slider
		type="single"
		bind:value={() => value ?? min, (v) => (value = v)}
		{min}
		{max}
		{step}
		{disabled}
		aria-labelledby={titleId}
		onValueCommit={(v: number) => onchange?.(v)}
	/>
	<div class="flex justify-between text-xs text-muted-foreground tabular-nums" aria-hidden="true">
		<span>{fmt(min)}</span>
		<span>{fmt(max)}</span>
	</div>
</RailSection>
