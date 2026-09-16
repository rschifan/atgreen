<script lang="ts">
	/**
	 * A labelled group in a tool rail.
	 *
	 * Every rail control needs a visible name, and Carbon cannot be relied on to
	 * provide one: a `filterable` MultiSelect drops `titleText` entirely, and
	 * `Search` renders an empty `.bx--label` unless `labelText` is set. Explore
	 * shipped with three controls and one label between them — the type selector
	 * showed a bare "9" with nothing to say that it counted green-area types.
	 *
	 * A component rather than a copied block of CSS, because the same heading now
	 * appears in two rails and would otherwise drift apart.
	 */
	export let title: string;
	/** Plain-language summary of the current state, shown under the control. */
	export let hint: string | undefined = undefined;
</script>

<section class="rail-section">
	<h2 class="eyebrow">{title}</h2>
	<slot />
	{#if hint}
		<p class="hint">{hint}</p>
	{/if}
</section>

<style>
	.rail-section {
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
		/*
			--cds-text-05 is the helper-text token (#8d8d8d, 5.5:1 on the rail).
			--cds-text-03 is the PLACEHOLDER token (#6f6f6f) and fails WCAG 1.4.3 at
			this size — axe caught exactly that on the Measure rail.
		*/
		color: var(--cds-text-05, #8d8d8d);
	}

	.hint {
		margin: 0;
		font-size: 0.8125rem;
		line-height: 1.4;
		color: var(--cds-text-02, #c6c6c6);
	}

	/* Carbon's own label would duplicate the heading above it. */
	.rail-section :global(.bx--label:empty) {
		display: none;
	}
</style>
