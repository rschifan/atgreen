<script lang="ts">
	/**
	 * Measure's rail: the city's indices as one scorecard, one line each — what
	 * the index asks, and how many residents get it — and, for the index on the
	 * map, the detail: the share, the city's standing among all cities in words,
	 * and its residents' spread against the target.
	 *
	 * It replaces cards of about 80 px per index, which filled the rail and
	 * scrolled on a laptop, and which printed the standing as an ordinal that read
	 * backwards ("16th" for a top-16% result).
	 */
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { cn } from '$lib/utils.js';
	import { get_city_profile } from '../../js/api';
	import { cityLabel } from '../../js/slug';
	import {
		INDEX_GROUP_LABEL,
		INDEX_GROUP_ORDER,
		describe_index_goal,
		describe_index_target,
		describe_median,
		parse_profile,
		standing,
		type IndexResult,
		type TargetStoreImpl
	} from '../../js/types';
	import { cities, current_accessibility_index, current_city } from '../../stores/stores';
	import Distribution from '../plotting/Distribution.svelte';

	let { metadata }: { metadata: TargetStoreImpl | undefined } = $props();

	let profile = $state<Record<string, IndexResult>>();
	let failed = $state(false);

	// One request per city. alova caches it, so coming back to Measure is instant.
	$effect(() => {
		const city = $current_city?.text;
		profile = undefined;
		failed = false;
		if (!city) return;
		let stale = false;
		get_city_profile(city)
			.send()
			.then(
				(raw) => {
					if (!stale) profile = parse_profile(raw);
				},
				(error) => {
					if (!stale) failed = true;
					console.error('Measure: city profile request failed', error);
				}
			);
		return () => {
			stale = true;
		};
	});

	// Grouped by what each index measures: five distances, two areas per person,
	// one exposure. Answers to different questions, in different units.
	const groups = $derived(
		INDEX_GROUP_ORDER.map((type) => ({
			type,
			label: INDEX_GROUP_LABEL[type],
			names: (metadata?.indexes() ?? []).filter((n) => metadata?.getTarget(n)?.index.type === type)
		})).filter((g) => g.names.length > 0)
	);
	const selected = $derived($current_accessibility_index);
	const target = $derived(metadata?.getTarget(selected));
	const result = $derived(profile?.[selected]);
	const rank = $derived(result ? standing(result.p) : undefined);
	const city_count = $derived($cities?.features?.length);

	const pct = (v: number) => `${Math.round(v * 100)}%`;
	// The bar is an aid; the figure beside it carries the value.
	const band = (v: number) => (v >= 0.9 ? 'bg-success' : v >= 0.6 ? 'bg-warning' : 'bg-danger');
	const group_title =
		'text-[0.6875rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase';
</script>

{#if failed}
	<p class="text-sm text-muted-foreground">
		This city’s indices did not load. Reload the page to try again.
	</p>
{:else if !profile || !metadata}
	<div class="flex flex-col gap-2" aria-busy="true" aria-label="Loading the indices">
		{#each Array(8) as _, i (i)}
			<Skeleton class="h-8 w-full" />
		{/each}
	</div>
{:else}
	<div class="flex flex-col gap-3.5">
		{#each groups as group, g (group.type)}
			<section class="flex flex-col" aria-labelledby="index-group-{group.type}">
				<div class="mb-1 flex items-baseline justify-between px-2">
					<h2 id="index-group-{group.type}" class={group_title}>{group.label}</h2>
					{#if g === 0}<span class="text-[0.6875rem] text-muted-foreground">residents</span>{/if}
				</div>
				{#each group.names as name (name)}
					{@const t = metadata.getTarget(name)}
					{@const r = profile[name]}
					{@const on = name === selected}
					<button
						type="button"
						data-index={name}
						aria-pressed={on}
						aria-label="{name}, {t ? describe_index_target(t) : ''}{r
							? `, ${pct(r.v)} of residents`
							: ''}"
						class={cn(
							'grid h-[34px] grid-cols-[2.6rem_1fr_2.75rem_2.4rem] items-center gap-2 rounded-md px-2 text-left text-[0.8125rem] transition-colors hover:bg-secondary',
							on && 'bg-secondary ring-1 ring-border'
						)}
						onclick={() => current_accessibility_index.set(name)}
					>
						<span class={cn('font-semibold', on && 'text-primary')}>{name}</span>
						<span class="truncate text-xs text-muted-foreground"
							>{t ? describe_index_target(t) : ''}</span
						>
						<span class="h-1.5 overflow-hidden rounded-full bg-border" aria-hidden="true">
							{#if r}<span
									class={cn('block h-full rounded-full', band(r.v))}
									style:width="{r.v * 100}%"
								></span>{/if}
						</span>
						<span class="text-right font-semibold tabular-nums">{r ? pct(r.v) : '–'}</span>
					</button>
				{/each}
			</section>
		{/each}

		{#if target && result}
			<Card.Root size="sm" aria-live="polite">
				<Card.Header>
					<Card.Title class="text-sm">{selected} · {describe_index_target(target)}</Card.Title>
					{#if rank}
						<Card.Action>
							<Badge
								variant="outline"
								class={cn(
									rank.tone === 'good' && 'border-primary/40 text-primary',
									rank.tone === 'bad' && 'border-destructive/40 text-destructive'
								)}>{rank.label}</Badge
							>
						</Card.Action>
					{/if}
				</Card.Header>
				<Card.Content class="flex flex-col gap-2.5">
					<p class="m-0 text-[0.8125rem] leading-snug text-subtle-foreground">
						<span class="block text-3xl leading-tight font-semibold text-foreground tabular-nums"
							>{pct(result.v)}</span
						>
						of residents {describe_index_goal(target)}
					</p>
					<Distribution
						steps={result.d}
						type={target.index.type}
						threshold={target.threshold}
						label="{selected} across {cityLabel($current_city?.text ?? '')}: {describe_median(
							target,
							result.d
						)}"
					/>
					<p class="m-0 text-[0.8125rem] text-subtle-foreground">
						{describe_median(target, result.d)}
					</p>
					<p class="m-0 text-xs text-muted-foreground">
						Better than {100 - result.p}% of {city_count
							? `the ${city_count.toLocaleString('en')}`
							: 'all'} cities.
					</p>
				</Card.Content>
			</Card.Root>
		{/if}
	</div>
{/if}
