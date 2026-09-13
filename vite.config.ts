import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ command }) => ({
	plugins: [sveltekit()],
	// Strip console.* and debugger from production bundles. Kept in dev so local
	// debugging is unaffected; this is why the source still calls console freely.
	esbuild: command === 'build' ? { drop: ['console', 'debugger'] } : {},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
}));
