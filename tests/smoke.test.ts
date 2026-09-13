import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => readFileSync(join(here, 'fixtures', `${name}.json`), 'utf-8');

/**
 * The app talks to the production PostgREST API through a hard-coded base URL, and
 * renders its basemap from Mapbox. Both are stubbed here so the smoke test is
 * hermetic: no network, no load on the live server, no Mapbox quota, and identical
 * results whether it runs on a laptop or in CI.
 *
 * `rpcCalls` records what the app *would* have fetched, which is what lets this test
 * assert on request counts — the thing that actually regressed.
 */
async function stubBackend(page: Page) {
	const rpcCalls: string[] = [];

	await page.route('**/rpc/**', async (route) => {
		const url = new URL(route.request().url());
		const name = url.pathname.split('/').pop() as string;
		rpcCalls.push(name);

		const body: Record<string, string> = {
			getindexes: 'getindexes',
			getcitiesinfo: 'getcitiesinfo',
			getaccessibility: 'getaccessibility',
			getsummarybycity: 'getsummarybycity'
		};

		if (body[name]) {
			await route.fulfill({ contentType: 'application/json', body: fixture(body[name]) });
		} else {
			// Everything else (queryosmgreen, the Create/Draw RPCs) returns an empty
			// FeatureCollection: the test asserts on whether they were called at all.
			await route.fulfill({
				contentType: 'application/json',
				body: JSON.stringify({ type: 'FeatureCollection', features: [] })
			});
		}
	});

	// A minimal but valid Mapbox style, so mapbox-gl fires `style.load` and `load`
	// without reaching the network. Components gate their layers on those events.
	await page.route('**/api.mapbox.com/**', async (route) => {
		await route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify({ version: 8, sources: {}, layers: [], glyphs: '', sprite: '' })
		});
	});
	// Fulfilled rather than aborted: an aborted request surfaces as a console error,
	// which would defeat the "no console errors" assertion below. The empty style has
	// no sources, so no tiles are ever requested; only telemetry is.
	await page.route('**/*.tiles.mapbox.com/**', (route) => route.fulfill({ status: 204, body: '' }));
	await page.route('**/events.mapbox.com/**', (route) => route.fulfill({ status: 204, body: '' }));

	return rpcCalls;
}

async function selectTurin(page: Page) {
	// Carbon's HeaderSearch renders a plain #search-input (no searchbox role) and
	// exposes its results as role=menuitem inside a role=menu.
	await page.locator('button[aria-label="Search"]').click();
	await page.locator('#search-input').fill('Turin');
	await page.getByRole('menuitem', { name: 'Turin' }).click();
}

test.describe('ATGreen smoke', () => {
	test('landing page renders the question and the city picker', async ({ page }) => {
		await stubBackend(page);
		await page.goto('/');

		await expect(page.getByText('How', { exact: false }).first()).toBeVisible();
		await expect(page.getByRole('button', { name: /Select a city/ })).toBeVisible();
		// One map on the landing page: the globe.
		await expect(page.locator('.mapboxgl-map')).toHaveCount(1);
	});

	test('selecting a city opens Measure and paints the accessibility grid', async ({ page }) => {
		const rpcCalls = await stubBackend(page);
		const consoleErrors: string[] = [];
		page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));

		await page.goto('/');
		await selectTurin(page);

		// The eight index tiles come from /rpc/getindexes, not a hard-coded list.
		await expect(page.getByText('WHO', { exact: true }).first()).toBeVisible({ timeout: 20000 });
		await expect(page.getByText('BE1', { exact: true }).first()).toBeVisible();
		await expect(page.getByText('ESA', { exact: true }).first()).toBeVisible();

		await expect(page.locator('canvas.mapboxgl-canvas')).toHaveCount(1);
		expect(consoleErrors, `console errors: ${consoleErrors.join(' | ')}`).toHaveLength(0);

		// Regression guard: the grid is fetched exactly once per city selection. It was
		// fetched three times (immediate: true), then zero times (immediate: false plus
		// lazily-mounted tabs). Both shipped; both would be caught here.
		const accessibility = rpcCalls.filter((c) => c === 'getaccessibility');
		expect(accessibility, `getaccessibility calls: ${accessibility.length}`).toHaveLength(1);
	});

	test('only the open tab is mounted', async ({ page }) => {
		const rpcCalls = await stubBackend(page);
		await page.goto('/');
		await selectTurin(page);
		await expect(page.getByText('WHO', { exact: true }).first()).toBeVisible({ timeout: 20000 });

		// All six panels exist in the DOM; only one may hold a live map.
		await expect(page.locator('.mapboxgl-map')).toHaveCount(1);

		// Explore's 2.8 MB green-areas request must not happen until its tab is opened.
		expect(rpcCalls).not.toContain('queryosmgreen');

		await page.getByRole('tab', { name: 'Explore' }).click();
		await expect.poll(() => rpcCalls.filter((c) => c === 'queryosmgreen').length).toBe(1);
	});
	test('maps are torn down when their tab closes', async ({ page }) => {
		// Counting .mapboxgl-map nodes does NOT test this: Svelte removes the DOM node
		// whether or not map.remove() ran, so that assertion passes even with the
		// teardown deleted (verified). What leaks is the WebGL context, which is
		// invisible in the DOM.
		//
		// mapbox-gl's remove() releases the context via WEBGL_lose_context, which
		// fires `webglcontextlost` on the canvas. Counting those events tests the
		// mechanism rather than its shadow.
		await page.addInitScript(() => {
			(window as unknown as { __ctxLost: number }).__ctxLost = 0;
			const getContext = HTMLCanvasElement.prototype.getContext;
			HTMLCanvasElement.prototype.getContext = function (
				this: HTMLCanvasElement,
				...args: unknown[]
			) {
				const ctx = (getContext as (...a: unknown[]) => unknown).apply(this, args);
				if (ctx && String(args[0]).startsWith('webgl')) {
					this.addEventListener('webglcontextlost', () => {
						(window as unknown as { __ctxLost: number }).__ctxLost++;
					});
				}
				return ctx;
			} as typeof HTMLCanvasElement.prototype.getContext;
		});

		await stubBackend(page);
		const consoleErrors: string[] = [];
		page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));

		await page.goto('/');
		await selectTurin(page);
		await expect(page.getByText('WHO', { exact: true }).first()).toBeVisible({ timeout: 20000 });

		// Draw mounts two maps; leaving it must release both.
		for (let i = 0; i < 2; i++) {
			await page.getByRole('tab', { name: 'Draw' }).click();
			await expect(page.locator('.mapboxgl-map')).toHaveCount(2, { timeout: 15000 });
			await page.getByRole('tab', { name: 'Measure' }).click();
			await expect(page.locator('.mapboxgl-map')).toHaveCount(1, { timeout: 15000 });
		}

		const lost = await page.evaluate(() => (window as unknown as { __ctxLost: number }).__ctxLost);
		// Two Draw visits plus the Measure map torn down on the way in and out: at
		// minimum the four Draw contexts must have been released.
		expect(lost, `webgl contexts released: ${lost}`).toBeGreaterThanOrEqual(4);

		// Teardown that throws is the other failure mode: a layer removed after its
		// map is gone raises, and that surfaces in the console.
		expect(consoleErrors, `console errors: ${consoleErrors.join(' | ')}`).toHaveLength(0);
	});
});
