<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
	import { GLOBE_STYLES } from '../../js/globe_styles';
	import { globe_style } from '../../stores/settings';

	// Back returns to wherever in the app this page was opened from; opened
	// directly (a bookmark, a new tab), it goes home.
	let back = resolve('/');
	afterNavigate(({ from }) => {
		if (from?.url && from.url.pathname !== resolve('/settings'))
			back = from.url.pathname + from.url.search;
	});
</script>

<svelte:head>
	<title>Settings — ATGreen</title>
</svelte:head>

<div class="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 text-foreground">
	<Button href={back} variant="ghost" size="sm" class="-ml-2.5 text-muted-foreground">
		<ArrowLeft /> Back
	</Button>
	<h1 class="mt-3 mb-8 text-3xl font-light">Settings</h1>

	<section aria-labelledby="globe-heading">
		<h2 id="globe-heading" class="text-xl">Globe</h2>
		<p class="mt-1 mb-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
			How the home page draws the Earth and its cities. Saved in this browser; takes effect the next
			time the globe loads.
		</p>

		<RadioGroup.Root
			bind:value={$globe_style}
			aria-labelledby="globe-heading"
			class="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-4"
		>
			{#each GLOBE_STYLES as s (s.id)}
				<!-- The whole card is the radio's label, so any part of it selects the style. -->
				<label
					for="style-{s.id}"
					class="group relative flex cursor-pointer flex-col gap-1 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-accent has-[[data-state=checked]]:border-ring has-[[data-state=checked]]:ring-1 has-[[data-state=checked]]:ring-ring"
				>
					<RadioGroup.Item value={s.id} id="style-{s.id}" class="absolute top-5 right-5 bg-card" />
					<img
						src="globe-styles/{s.id}.webp"
						alt=""
						width="480"
						height="480"
						loading="lazy"
						class="mb-2 aspect-square h-auto w-full rounded-lg bg-[#060a10]"
					/>
					<span class="font-semibold">{s.label}</span>
					<span class="text-xs tracking-wide text-ring">{s.credit}</span>
					<span class="text-sm leading-snug text-muted-foreground">{s.description}</span>
				</label>
			{/each}
		</RadioGroup.Root>
	</section>
</div>
