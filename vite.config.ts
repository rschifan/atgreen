import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

/*
	`esbuild: { drop: ['console'] }` used to live here. Vite 8 minifies with
	Rolldown/oxc instead of esbuild and exposes no equivalent, so that option
	silently stopped working: 34 console.log and 12 console.error survived into
	the production bundle where 2 had before.

	It was the wrong mechanism anyway. It masked debug logging in the source —
	including two lines that printed RPC URLs with their parameters — and made the
	e2e suite's `expect(consoleErrors).toHaveLength(0)` nearly vacuous, because the
	calls it was watching for had been compiled away. The debug calls are now
	deleted at the source; console.error is kept, because a failed request should
	say so.
*/
export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
