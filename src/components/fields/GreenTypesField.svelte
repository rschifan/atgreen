<script lang="ts">
	/**
	 * Which kinds of public green count: parks, forests, grass. Shared by Create
	 * and Draw. Exposure counts all green cover whatever its kind, so there the
	 * group is disabled and says why.
	 */
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import RailSection from '../RailSection.svelte';

	let {
		value = $bindable([]),
		disabled = false,
		onchange
	}: {
		/** The selected type ids: 'parks', 'forests', 'grass'. */
		value?: string[];
		disabled?: boolean;
		onchange?: (value: string[]) => void;
	} = $props();

	const TYPES = [
		{ id: 'parks', label: 'Parks' },
		{ id: 'forests', label: 'Forests' },
		{ id: 'grass', label: 'Grass' }
	];
	const uid = $props.id();

	function toggle(id: string, checked: boolean) {
		value = checked ? [...value, id] : value.filter((v) => v !== id);
		onchange?.(value);
	}
</script>

<RailSection
	title="Green area types"
	group
	hint={disabled ? 'Exposure counts all green cover, whatever its type.' : undefined}
>
	<div class="flex flex-col gap-2.5">
		{#each TYPES as t (t.id)}
			<div class="flex items-center gap-2.5">
				<Checkbox
					id="{uid}-{t.id}"
					checked={value.includes(t.id)}
					onCheckedChange={(c) => toggle(t.id, c === true)}
					{disabled}
				/>
				<Label for="{uid}-{t.id}" class="font-normal">{t.label}</Label>
			</div>
		{/each}
	</div>
</RailSection>
