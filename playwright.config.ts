import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173
	},
	// WebGL under a headless CI runner is flaky in a way the app is not. One retry
	// with a trace turns a spurious red build into an artefact worth reading,
	// without hiding a genuine failure — a real break fails both attempts.
	retries: process.env.CI ? 1 : 0,
	use: { trace: 'on-first-retry' },
	testDir: 'tests',
	testMatch: /(.+\.)?(test|spec)\.[jt]s/
};

export default config;
