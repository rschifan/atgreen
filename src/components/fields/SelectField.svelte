<script lang="ts">
	/** A labelled single choice from a short list, in a tool rail. */
	import * as Select from '$lib/components/ui/select/index.js';
	import RailSection from '../RailSection.svelte';

	type Item = { value: string; label: string; disabled?: boolean };

	let {
		title,
		items,
		value = $bindable(''),
		placeholder = 'Select…',
		error,
		onchange
	}: {
		title: string;
		items: Item[];
		value?: string;
		placeholder?: string;
		error?: string;
		onchange?: (value: string) => void;
	} = $props();

	const id = $props.id();
	const selected = $derived(items.find((i) => i.value === value));
</script>

<RailSection {title} for={id} {error}>
	<Select.Root type="single" bind:value onValueChange={(v) => onchange?.(v)}>
		<Select.Trigger {id} class="w-full" aria-invalid={error ? true : undefined}>
			{selected?.label ?? placeholder}
		</Select.Trigger>
		<Select.Content>
			{#each items as item (item.value)}
				<Select.Item value={item.value} label={item.label} disabled={item.disabled}
					>{item.label}</Select.Item
				>
			{/each}
		</Select.Content>
	</Select.Root>
</RailSection>
