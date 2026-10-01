<script lang="ts">
	/**
	 * A labelled multiple choice from a list long enough to want a search: a
	 * button that says what is selected, opening a searchable list to tick.
	 */
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { cn } from '$lib/utils.js';
	import RailSection from '../RailSection.svelte';

	type Item = { id: string; text: string };

	let {
		title,
		items,
		value = $bindable([]),
		hint,
		searchPlaceholder = 'Search…',
		onchange
	}: {
		title: string;
		items: Item[];
		/** The selected item ids. */
		value?: string[];
		hint?: string;
		searchPlaceholder?: string;
		onchange?: (value: string[]) => void;
	} = $props();

	const id = $props.id();
	let open = $state(false);

	const summary = $derived(
		value.length === 0
			? 'None selected'
			: value.length === items.length
				? `All ${items.length}`
				: value.length <= 2
					? items
							.filter((i) => value.includes(i.id))
							.map((i) => i.text)
							.join(', ')
					: `${value.length} of ${items.length}`
	);

	function toggle(itemId: string) {
		value = value.includes(itemId) ? value.filter((v) => v !== itemId) : [...value, itemId];
		onchange?.(value);
	}
</script>

<RailSection {title} for={id} {hint}>
	<Popover.Root bind:open>
		<Popover.Trigger
			{id}
			class={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-between font-normal')}
		>
			<span class="truncate">{summary}</span>
			<ChevronsUpDownIcon class="opacity-50" />
		</Popover.Trigger>
		<Popover.Content class="w-(--bits-popover-anchor-width) p-0" align="start">
			<Command.Root>
				<Command.Input placeholder={searchPlaceholder} />
				<Command.List>
					<Command.Empty>No match.</Command.Empty>
					<Command.Group>
						{#each items as item (item.id)}
							<Command.Item value={item.text} onSelect={() => toggle(item.id)}>
								<CheckIcon class={cn(!value.includes(item.id) && 'text-transparent')} />
								{item.text}
							</Command.Item>
						{/each}
					</Command.Group>
				</Command.List>
			</Command.Root>
		</Popover.Content>
	</Popover.Root>
</RailSection>
