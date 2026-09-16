<script lang="ts">
	import { useWatcher } from 'alova';
	import { format } from 'd3';
	import { onDestroy, onMount } from 'svelte';
	import type { Unsubscriber } from 'svelte/store';
	import { get_city_profile } from '../../js/api';
	import {
		CityStoreImpl,
		INDEX_GROUP_LABEL,
		INDEX_GROUP_ORDER,
		TargetStoreImpl,
		describe_index_target
	} from '../../js/types';
	import { ordinal } from '../../js/utils';
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

	/*
		Grouped by what each index actually measures.

		The eight are not peers: five measure distance to a greenspace of some
		minimum size, two measure green per person, one measures exposure — and
		that is `AccessibilityIndexType`, the value already driving the colour
		ramp's direction and the legend's unit, not a presentational invention.
		A flat 2x4 grid of acronyms invited a comparison between WHO's 75% and
		IPP's 100% that the data does not support: they answer different questions
		in different units.

		Falls back to one unlabelled group when the index metadata has not arrived,
		so the rail still works rather than rendering empty.
	*/
	$: groups = build_groups(data, metadata);

	function build_groups(profile: CityStoreImpl, meta: TargetStoreImpl | undefined) {
		if (!profile) return [];

		const rows = profile.entries().map(([name, value]) => {
			const target = meta?.getTarget(name);
			return {
				name,
				value,
				rank: profile.getPercentile(name),
				summary: target ? describe_index_target(target) : '',
				type: target?.index?.type
			};
		});

		if (rows.every((r) => r.type === undefined)) return [{ key: 'all', label: '', rows }];

		const grouped = INDEX_GROUP_ORDER.map((type) => ({
			key: String(type),
			label: INDEX_GROUP_LABEL[type],
			rows: rows.filter((r) => r.type === type)
		})).filter((g) => g.rows.length > 0);

		// Anything the metadata did not classify still has to appear somewhere.
		const rest = rows.filter((r) => r.type === undefined);
		return rest.length > 0 ? [...grouped, { key: 'other', label: 'Other', rows: rest }] : grouped;
	}

	/*
		Three bands, stated once here rather than implied by eight coloured boxes.
		The bar is an at-a-glance aid only — the exact percentage sits beside it,
		so colour is never the sole carrier of the value.
	*/
	function bar_colour(share: number): string {
		if (!Number.isFinite(share)) return 'var(--cds-ui-04, #6f6f6f)';
		if (share >= 0.9) return 'var(--cds-support-02, #24a148)';
		if (share >= 0.6) return 'var(--cds-support-03, #f1c21b)';
		return 'var(--cds-support-01, #da1e28)';
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
		{#each groups as group (group.key)}
			<div class="group">
				{#if group.label}
					<h2 class="group-head">{group.label}</h2>
				{/if}

				<div class="rows">
					{#each group.rows as row (row.name)}
						<!--
							Real buttons. These were bare <div on:click> with an empty
							on:keypress and a svelte-ignore, and they are the ONLY way to
							change the index, so the app's primary control was unreachable by
							keyboard entirely (WCAG 2.1.1). `aria-pressed` carries the state
							that was previously conveyed by background colour alone.
						-->
						<button
							type="button"
							class="row"
							class:selected={$current_accessibility_index === row.name}
							aria-pressed={$current_accessibility_index === row.name}
							on:click={() => click(row.name)}
						>
							<span class="nm">{row.name}</span>
							<span class="rank">
								{ordinal(row.rank)}<span class="sr-only"> of all cities</span>
							</span>
							{#if row.summary}
								<span class="sub">{row.summary}</span>
							{/if}
							<span class="barwrap">
								<span class="bar" aria-hidden="true">
									<i
										style="width:{Math.max(0, Math.min(1, row.value)) *
											100}%;background:{bar_colour(row.value)}"
									></i>
								</span>
								<span class="pct">
									{percentage_formatter(row.value)}<span class="sr-only">
										of residents meet the target</span
									>
								</span>
							</span>
						</button>
					{/each}
				</div>
			</div>
		{/each}
	</section>
{/if}

<style>
	.indexes {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.group + .group {
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--cds-ui-03, #393939);
	}

	/*
		The only heading in this rail now. An "Accessibility index" title above
		these said nothing the group headings do not already say, in a 300px column
		where every line has to earn its place.

		--cds-text-05 is the helper-text token (#8d8d8d, 5.5:1 on the rail).
		--cds-text-03 is the PLACEHOLDER token (#6f6f6f) and fails WCAG 1.4.3 at
		this size — axe caught exactly that here once already.
	*/
	.group-head {
		margin: 0 0 0.35rem 0.625rem;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--cds-text-05, #8d8d8d);
	}

	.rows {
		display: flex;
		flex-direction: column;
	}

	/*
		Two columns — name and rank — with the summary and the bar spanning both.
		A grid rather than nested flex so the rank stays right-aligned on its own
		baseline however long the index name gets.
	*/
	.row {
		/*
			Positioned so the visually-hidden spans inside it have an offset parent.
			Without this they resolve against the initial containing block, escape the
			rail's scroll container entirely and grow the document — 16 of them pushed
			`scrollHeight` to 796px in a 720px viewport. Latent in the old tile design
			too; it only surfaced once the rail was long enough to scroll.
		*/
		position: relative;
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.15rem 0.5rem;
		align-items: baseline;
		width: 100%;
		padding: 0.55rem 0.5rem 0.6rem 0.625rem;
		border: 0;
		border-left: 2px solid transparent;
		background-color: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition: background-color 70ms linear;
	}

	/* Hairlines between rows, not boxes around them. */
	.row + .row {
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}

	.row:hover {
		background-color: var(--cds-ui-01, #262626);
	}

	.row:focus-visible {
		outline: 2px solid var(--cds-focus, #ffffff);
		outline-offset: -2px;
	}

	/*
		A left accent and a quiet fill, not a saturated block. The previous design
		filled the whole selected tile with #0f62fe, which made the control the
		loudest thing on screen — louder than the map it exists to explain.
	*/
	.row.selected {
		background-color: var(--cds-ui-01, #262626);
		border-left-color: var(--cds-interactive-01, #0f62fe);
		cursor: default;
	}

	.nm {
		font-size: 0.8125rem;
		font-weight: 600;
		letter-spacing: 0.01em;
	}

	.rank,
	.pct {
		/* The figures read as columns, so the digits have to line up. */
		font-variant-numeric: tabular-nums;
		font-size: 0.75rem;
	}

	.rank {
		color: var(--cds-text-05, #8d8d8d);
	}

	.sub {
		grid-column: 1 / -1;
		margin-top: -0.1rem;
		font-size: 0.72rem;
		line-height: 1.35;
		color: var(--cds-text-05, #8d8d8d);
	}

	.barwrap {
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.35rem;
	}

	.bar {
		position: relative;
		flex: 1;
		height: 3px;
		background-color: var(--cds-ui-03, #393939);
	}

	.bar i {
		position: absolute;
		inset: 0 auto 0 0;
		display: block;
	}

	.pct {
		min-width: 2.6em;
		text-align: right;
		color: var(--cds-text-02, #c6c6c6);
	}

	/* The bar is decorative; the figure beside it carries the value. */
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
