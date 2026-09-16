<script lang="ts">
	/**
	 * The shell every tool view sits in: a fixed-width rail of controls beside a
	 * stage the map fills completely.
	 *
	 * The old panes stacked a row of form controls above a map with a hardcoded
	 * 500px height, inside a flex column that also contained a hidden panel still
	 * claiming `flex-grow: 1`. The free space went to whichever child asked for it
	 * first, which is why half the viewport was empty black above the controls.
	 *
	 * Here the stage is the only element that grows, and it is `position: relative`
	 * so its map can be `position: absolute; inset: 0`. There is no height to pass
	 * down, nothing to measure, and no arrangement of siblings that can take the
	 * space away.
	 */

	/**
	 * Let the stage scroll its own content instead of holding one full-bleed child.
	 * Compare needs this: its two columns are floats, taller than the viewport.
	 */
	export let scroll = false;
</script>

<div class="pane">
	<aside class="rail"><slot name="rail" /></aside>
	<div class="stage" class:scroll><slot /></div>
</div>

<style>
	.pane {
		flex-grow: 1;
		display: flex;
		min-height: 0; /* or a tall stage refuses to shrink and overflows the page */
	}

	.rail {
		flex: 0 0 18.75rem; /* 300px */
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 1rem;
		overflow-y: auto;
		border-right: 1px solid var(--cds-ui-03, #393939);
	}

	/*
		Carbon's `.bx--form-item` is `flex: 1 1 auto`, so a Slider dropped straight
		into a flex column stretches to fill it and pushes everything after it to
		the bottom of the rail. The rail's own `gap` handles the spacing, so its
		children size to content and Carbon's own margins are stood down.
	*/
	.rail > :global(*) {
		flex: 0 0 auto;
	}

	.rail :global(.bx--fieldset) {
		margin-bottom: 0;
	}

	/*
		Carbon sizes a ContentSwitcher for a content column, not a 300px rail: at
		its default 0.875rem type and 1rem of padding per side, three switches get
		~57px of text width each and "Exposure" and "Per person" render as
		"Expos..." and "Per pe...". The labels are the whole control — there is no
		other place in the UI that says which index you are looking at — so the
		type and padding give way instead.
	*/
	.rail :global(.bx--content-switcher-btn) {
		padding-inline: 0.5rem;
		font-size: 0.75rem;
		justify-content: center;
	}

	.rail :global(.bx--content-switcher__label) {
		overflow: visible;
		text-overflow: clip;
	}

	.stage {
		position: relative;
		flex: 1 1 auto;
		min-width: 0;
		min-height: 0;
	}

	.stage.scroll {
		overflow-y: auto;
	}

	/* Contain Compare's floated columns so the scroll height is right. */
	.stage.scroll::after {
		content: '';
		display: block;
		clear: both;
	}

	/*
		Below Carbon's `md` breakpoint the rail becomes a drawer above the stage.
		This replaces ten `innerWidth > 500` branches in the pane components, which
		bound `<svelte:window bind:innerWidth>` and so re-rendered every component
		on every resize event — the reason Compare rebuilt all 26,440 of its SVG
		paths while a window edge was being dragged.
	*/
	@media (max-width: 41.99rem) {
		.pane {
			flex-direction: column;
		}

		.rail {
			flex: 0 0 auto;
			max-height: 45%;
			border-right: 0;
			border-bottom: 1px solid var(--cds-ui-03, #393939);
		}
	}
</style>
