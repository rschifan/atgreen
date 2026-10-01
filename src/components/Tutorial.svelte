<script lang="ts">
	/**
	 * "How it works": five screenshots, one per step, with a step list to jump
	 * between them and Previous / Next. Shown in a dialog from the home page.
	 */
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { Button } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils.js';

	const STEPS = [
		{ label: 'Select', alt: 'Choosing a city, on the globe or in the search.' },
		{ label: 'Measure', alt: 'Measure: the accessibility indices and the map of the city.' },
		{ label: 'Compare', alt: 'Compare: two indices side by side.' },
		{ label: 'Create', alt: 'Create: building an index of your own.' },
		{ label: 'Explore', alt: "Explore: the city's green areas, by type and size." }
	];

	let step = $state(0);
	// Viewport width, not the dialog's: measuring an element reads 0 before
	// layout, which once fetched both the phone and the desktop screenshot. Read
	// at once (this only mounts in the browser, when the dialog opens), so the
	// first image requested is already the right one.
	let viewport = $state(typeof window === 'undefined' ? 1024 : window.innerWidth);
	const narrow = $derived(viewport <= 400);
	const src = $derived(
		narrow ? `screenshots/mobile/step${step + 1}-m.webp` : `screenshots/wide/step${step + 1}-h.webp`
	);
</script>

<svelte:window bind:innerWidth={viewport} />

<div class="flex flex-col gap-4">
	<ol class="flex flex-wrap gap-1.5" aria-label="Steps">
		{#each STEPS as s, i (s.label)}
			<li>
				<button
					type="button"
					class={cn(
						'flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors',
						i === step
							? 'border-primary bg-primary text-primary-foreground'
							: 'border-border text-muted-foreground hover:text-foreground'
					)}
					aria-current={i === step ? 'step' : undefined}
					onclick={() => (step = i)}
				>
					<span class="tabular-nums">{i + 1}</span>
					{s.label}
				</button>
			</li>
		{/each}
	</ol>

	<!-- The phone screenshots are portrait: capped so the step list and buttons stay on screen. -->
	<img
		{src}
		alt={STEPS[step].alt}
		class="max-h-[60dvh] w-full rounded-lg border border-border object-contain"
	/>

	<div class="flex justify-between">
		<Button variant="outline" disabled={step === 0} onclick={() => (step -= 1)}>
			<ChevronLeftIcon /> Previous
		</Button>
		<Button disabled={step === STEPS.length - 1} onclick={() => (step += 1)}>
			Next <ChevronRightIcon />
		</Button>
	</div>
</div>
