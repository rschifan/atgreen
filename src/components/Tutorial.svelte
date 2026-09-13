<script>
	import {
		ProgressIndicator,
		ProgressStep,
		Content,
		Button,
		ImageLoader
	} from 'carbon-components-svelte';

	let step = 0;
	let nsteps = 5;
	let preventChangeOnClick = true;
	let vertical = false;

	function nextStep() {
		step += 1;
		src = `screenshots/wide/step${step + 1}-h.png`;
	}

	function previousStep() {
		step -= 1;
		src = `screenshots/wide/step${step + 1}-h.png`;
	}

	let content_width;
	let imageLoader;
	let src;
	let device;

	$: vertical = content_width <= 400;
	$: device = vertical ? 'm' : 'h';
	$: if (step >= 0) {
		if (vertical) src = `screenshots/mobile/step${step + 1}-m.png`;
		else src = `screenshots/wide/step${step + 1}-h.png`;
	}
</script>

<svelte:window bind:innerWidth={content_width} />

<div>
	<div bind:clientWidth={content_width}>
		<ProgressIndicator {preventChangeOnClick} currentIndex={step} {vertical}>
			<ProgressStep label="Select" description="" complete={step >= 0} />
			<ProgressStep label="Measure" description="" complete={step >= 1} />
			<ProgressStep label="Compare" description="" complete={step >= 2} />
			<ProgressStep label="Create" description="" complete={step >= 3} />
			<ProgressStep label="Explore" description="" complete={step >= 4} />
		</ProgressIndicator>
	</div>

	<div style="padding:1rem 0;outline: none;pointer-events: none;">
		<!-- <ImageLoader
			fadeIn
			bind:this={imageLoader}
			bind:src
			style="outline:none;pointer-events:none;"
		/> -->

		<img {src} width="100%" alt="" />
	</div>

	<div>
		{#if step > 0}
			<Button size="small" style="float:left;border-radius: 5px;" on:click={previousStep}
				>Previous</Button
			>
		{/if}

		{#if step < nsteps - 1}
			<Button size="small" style="float:right;border-radius: 5px;" on:click={nextStep}>Next</Button>
		{/if}
	</div>
</div>

<style>
	:global(.bx--progress--vertical .bx--progress-label) {
		display: contents;
	}
	:global(.bx--modal-content p) {
		display: inline-flex;
	}
</style>
