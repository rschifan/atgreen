<script lang="ts">
	/**
	 * A labelled group in a tool rail — the one heading every rail control sits
	 * under, built on shadcn's Field parts.
	 *
	 * Every control needs a visible name. A group of controls (checkboxes, a
	 * segmented switch) is a fieldset with the title as its legend; a single
	 * control is a field whose title labels it — by `for` for an input or button,
	 * or by `aria-labelledby={titleId}` for a widget such as a slider.
	 */
	import type { Snippet } from 'svelte';
	import * as Field from '$lib/components/ui/field/index.js';

	let {
		title,
		hint,
		value,
		group = false,
		for: forId,
		titleId,
		error,
		children
	}: {
		title: string;
		/** Plain-language summary of the current state, under the control. */
		hint?: string;
		/** The current setting, shown at the right of the title (a slider's value). */
		value?: string;
		/** A group of controls: a fieldset with the title as its legend. */
		group?: boolean;
		/** For a single input or button: the id the title labels. */
		for?: string;
		/** An id for the title, for a control that names itself with aria-labelledby. */
		titleId?: string;
		/** A problem with the current setting, shown in place of the hint. */
		error?: string;
		children: Snippet;
	} = $props();

	const titleClass =
		'mb-0 flex w-full items-baseline justify-between gap-2 text-[0.6875rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase data-[variant=label]:text-[0.6875rem]';
</script>

{#snippet heading()}
	<!-- The id names a slider: the title alone, not the value that changes as it moves. -->
	<span id={titleId}>{title}</span>
	{#if value}
		<span class="text-sm font-normal tracking-normal text-foreground normal-case tabular-nums"
			>{value}</span
		>
	{/if}
{/snippet}

{#snippet foot()}
	{#if error}
		<Field.Error>{error}</Field.Error>
	{:else if hint}
		<Field.Description class="text-[0.8125rem] leading-snug text-subtle-foreground"
			>{hint}</Field.Description
		>
	{/if}
{/snippet}

{#if group}
	<Field.Set class="gap-2.5">
		<Field.Legend variant="label" class={titleClass}>{@render heading()}</Field.Legend>
		{@render children()}
		{@render foot()}
	</Field.Set>
{:else}
	<Field.Field class="gap-2.5">
		<Field.Label for={forId} class={titleClass}>{@render heading()}</Field.Label>
		{@render children()}
		{@render foot()}
	</Field.Field>
{/if}
