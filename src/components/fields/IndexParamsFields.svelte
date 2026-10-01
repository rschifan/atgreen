<script lang="ts">
	/**
	 * The parameters of an index the user builds, shared by Create and Draw: its
	 * type, the green it counts, the minimum park size and the time budget.
	 * Exposure counts all green cover whatever its type, and a distance is itself
	 * a walking time, so each type disables the control that does not apply.
	 */
	import { AccessibilityIndexType } from '../../js/types';
	import GreenTypesField from './GreenTypesField.svelte';
	import IndexTypeField from './IndexTypeField.svelte';
	import RangeField from './RangeField.svelte';
	import TimeBudgetField from './TimeBudgetField.svelte';

	let {
		type = $bindable(),
		green_types = $bindable(),
		size = $bindable(),
		time = $bindable(),
		onchange
	}: {
		type: AccessibilityIndexType;
		/** 'parks', 'forests', 'grass'. */
		green_types: string[];
		/** Minimum green-area size, ha. */
		size: number;
		/** Time budget, min. */
		time: number;
		/** Any parameter changed. */
		onchange?: () => void;
	} = $props();
</script>

<IndexTypeField bind:value={type} {onchange} />
<GreenTypesField
	bind:value={green_types}
	disabled={type === AccessibilityIndexType.EXPOSURE}
	{onchange}
/>
<RangeField
	title="Minimum size"
	unit="ha"
	min={0.5}
	max={50}
	step={0.5}
	bind:value={size}
	{onchange}
/>
<TimeBudgetField
	bind:value={time}
	disabled={type === AccessibilityIndexType.MINIMUM_DISTANCE}
	{onchange}
/>
