<script lang="ts">
	/**
	 * How many walking minutes count as "within reach". Shared by Create and
	 * Draw. A distance index is that walking time itself, so there the budget is
	 * disabled and says why.
	 */
	import RangeField from './RangeField.svelte';

	let {
		value = $bindable(),
		disabled = false,
		onchange
	}: {
		value?: number;
		disabled?: boolean;
		onchange?: (value: number) => void;
	} = $props();
</script>

<RangeField
	title="Time budget"
	unit="min"
	min={0}
	max={15}
	bind:value
	{disabled}
	hint={disabled ? 'Distance is the walking time itself, so it takes no budget.' : undefined}
	{onchange}
/>
