<script lang="ts">
	import { useWatcher } from 'alova';
	import ArrowsVertical from 'carbon-icons-svelte/lib/ArrowsVertical.svelte';
	import UserMultiple from 'carbon-icons-svelte/lib/UserMultiple.svelte';
	import { format } from 'd3';
	import { onDestroy, onMount } from 'svelte';
	import type { Unsubscriber } from 'svelte/store';
	import { get_city_profile } from '../../js/api';
	import { CityStoreImpl } from '../../js/types';
	import { current_accessibility_index, current_city, loading } from '../../stores/stores';

	export let metadata;

	let get_city_profile_request = useWatcher(
		() => get_city_profile($current_city?.text),
		[current_city],
		{
			debounce: 500,
			immediate: true
		}
	);

	const percentage_formatter = format('.0%');

	let data: CityStoreImpl;
	let unsubscribe_city_profile: Unsubscriber;

	onMount(() => {
		unsubscribe_city_profile = get_city_profile_request.data.subscribe((value) => {
			if (!value) return;

			const next = new CityStoreImpl($current_city);

			for (let k of Object.keys(value)) {
				next.addIndex(k, value[k]['v']);
				next.addIndexPercentile(k, value[k]['p']);
				next.addIndexDeciles(
					k,
					value[k]['d']
						.substring(1, value[k]['d'].length - 1)
						.split(',')
						.map((c) => parseFloat(c))
				);
			}

			data = next;
			loading.set(false);
		});
	});

	onDestroy(() => {
		if (unsubscribe_city_profile) unsubscribe_city_profile();
	});

	/*
		Three subscriptions, a `props` object, a `focus`/`leave` pair, `width`,
		`text`, `hovered_index*` and `selected_index` used to live here. None was
		read by the markup — `selected_index` mirrored a store the template already
		reads directly, and one subscriber's whole body was `() => {}`. They ran on
		every city change and held the component alive after it was destroyed.
	*/

	function click(index: string): void {
		if (index) current_accessibility_index.set(index);
	}
</script>

{#if data}
	<!--
		No `margin: auto` here. The rail is a flex column, so auto margins absorbed
		every pixel of free space: the tiles floated to the vertical middle of an
		empty panel and pushed the legend to the floor. Both looked like separate
		layout bugs; they were this one line.
	-->
	<section class="indexes">
		<h2 class="eyebrow">Accessibility index</h2>

		<!--
			Real buttons. These were bare <div on:click> with an empty on:keypress
			and a svelte-ignore, and they are the ONLY way to change the index:
			`current_accessibility_index.set` is called in exactly one other place,
			the store's own default. So the app's primary control was unreachable
			by keyboard entirely (WCAG 2.1.1). `aria-pressed` now carries the state
			that was previously conveyed by background colour alone.

			The old handler also read `e.target.id` to find out which tile was
			clicked, so clicking a tile's padding rather than its label produced
			`undefined` and did nothing.
		-->
		<div class="tiles">
			{#each data.entries() as item (item[0])}
				<button
					type="button"
					class="tile"
					class:selected={$current_accessibility_index === item[0]}
					aria-pressed={$current_accessibility_index === item[0]}
					on:click={() => click(item[0])}
				>
					<span class="tile-name">{item[0]}</span>
					<span class="tile-stat">
						<UserMultiple size={16} />
						<span>{percentage_formatter(item[1])}</span>
						<span class="sr-only">of residents meet the target</span>
					</span>
					<span class="tile-stat">
						<ArrowsVertical size={16} />
						<span>{data.getPercentile(item[0])}th</span>
						<span class="sr-only">percentile among all cities</span>
					</span>
				</button>
			{/each}
		</div>
	</section>

	<!-- `{#if metadata}` was not enough: getTarget() returns undefined for an index
	     that has not loaded yet, and .description on that throws. -->
	{#if metadata?.getTarget($current_accessibility_index)}
		<section class="explainer">
			<h2 class="eyebrow">What {$current_accessibility_index} measures</h2>
			<p class="description">
				{metadata.getTarget($current_accessibility_index)?.description}
			</p>
		</section>
	{/if}
{/if}

<style>
	.indexes,
	.explainer {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.eyebrow {
		margin: 0;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--cds-text-05, #8d8d8d);
	}

	.tiles {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 2px;
	}

	/*
		The border is a fixed 2px on every edge state, so selecting a tile cannot
		change its height. The old rule added `border-bottom: 2px` only when
		selected, which made that tile 1px taller and nudged its whole grid row.
	*/
	.tile {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		padding: 0.5rem 0.625rem;
		border: 0;
		border-left: 2px solid transparent;
		background-color: var(--cds-ui-02, #262626);
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition: background-color 70ms linear;
	}

	.tile:hover {
		background-color: var(--cds-ui-03, #393939);
	}

	.tile:focus-visible {
		outline: 2px solid var(--cds-focus, #ffffff);
		outline-offset: -2px;
	}

	/*
		--cds-text-04 is Carbon's "text on an interactive background" token, which is
		what this is. It was rgba(255,255,255,0.92), and 8% of #0f62fe bleeding
		through dropped the stats to ~4.5:1 — right on the WCAG 1.4.3 line, and axe
		scored it under. Opaque white is 5.05:1.
	*/
	.tile.selected {
		background-color: var(--cds-interactive-01, #0f62fe);
		border-left-color: #ffffff;
		color: var(--cds-text-04, #ffffff);
		cursor: default;
	}

	.tile-name {
		font-size: 0.875rem;
		font-weight: 600;
		line-height: 1.2;
	}

	.tile-stat {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.8125rem;
		/* Percentages and ranks read as a column, so the digits have to align. */
		font-variant-numeric: tabular-nums;
		color: var(--cds-text-02, #c6c6c6);
	}

	.tile.selected .tile-stat {
		color: var(--cds-text-04, #ffffff);
	}

	.tile-stat :global(svg) {
		flex: 0 0 auto;
		fill: currentColor;
		opacity: 0.6;
	}

	.description {
		margin: 0;
		font-size: 0.8125rem;
		line-height: 1.45;
		color: var(--cds-text-02, #c6c6c6);
	}

	/* The icons carry meaning that colour and shape alone do not. */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
