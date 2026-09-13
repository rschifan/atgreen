import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import svelteConfig from './svelte.config.js';

/**
 * ESLint 9 flat config, replacing .eslintrc.cjs.
 *
 * This migration was deferred out of the CI work on purpose: moving to flat config
 * drags @typescript-eslint 5 -> 8 and eslint-plugin-svelte 2 -> 3 along with it, and
 * both are only loadable by ESLint 9. Doing it then would have half-migrated the
 * toolchain twice. With Svelte 5 it stops being optional — the new plugin versions
 * are flat-config only.
 */
export default ts.config(
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		},
		rules: {
			// @typescript-eslint/no-unused-vars throws inside Svelte files with this
			// plugin combination (TypeError reading 'type' in getDefinedMessageData).
			// The base rule reports the same thing without crashing; revisit when the
			// plugin fixes it.
			'@typescript-eslint/no-unused-vars': 'off',
			'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^\\$\\$' }]
		}
	},
	{
		// Build output, test artefacts and the vendored Carbon CSS are not ours to lint.
		ignores: [
			'build/',
			'.svelte-kit/',
			'node_modules/',
			'test-results/',
			'playwright-report/',
			'tests/fixtures/'
		]
	}
);
