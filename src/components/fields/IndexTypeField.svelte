<script lang="ts">
	/**
	 * Which family of index: distance, exposure or per person. A segmented
	 * switch, one press to change, shared by Create and Draw.
	 */
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import { AccessibilityIndexType } from '../../js/types';
	import RailSection from '../RailSection.svelte';

	let {
		value = $bindable(AccessibilityIndexType.MINIMUM_DISTANCE),
		onchange
	}: {
		/** An AccessibilityIndexType. */
		value?: AccessibilityIndexType;
		/** After the user picks a different index. */
		onchange?: (value: AccessibilityIndexType) => void;
	} = $props();

	const OPTIONS = [
		[AccessibilityIndexType.MINIMUM_DISTANCE, 'Distance'],
		[AccessibilityIndexType.EXPOSURE, 'Exposure'],
		[AccessibilityIndexType.PER_PERSON, 'Per person']
	] as const;
</script>

<RailSection title="Index type" group>
	<!--
		A single-choice toggle group lets a second press on the active item clear
		it; an index type is never "none", so the binding ignores the empty value
		and the active item stays pressed.
	-->
	<ToggleGroup.Root
		type="single"
		variant="outline"
		class="w-full"
		bind:value={
			() => String(value),
			(v) => {
				if (v === '' || Number(v) === value) return;
				value = Number(v);
				onchange?.(value);
			}
		}
	>
		{#each OPTIONS as [option, label] (option)}
			<ToggleGroup.Item
				value={String(option)}
				class="flex-1 px-1 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
				>{label}</ToggleGroup.Item
			>
		{/each}
	</ToggleGroup.Root>
</RailSection>
