import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => readFileSync(join(here, 'fixtures', `${name}.json`), 'utf-8');

/**
 * The app talks to the production PostgREST API through a hard-coded base URL, and
 * loads its basemap style from OpenFreeMap. Both are stubbed here so the
 * smoke test is hermetic: no network, no load on the live server, and identical
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

	// A minimal but valid style, so MapLibre fires `style.load` and `load` without
	// reaching the network. Components gate their layers on those events.
	//
	// The basemap is OpenFreeMap's dark style (src/js/map.js). Every request to
	// that host is intercepted, the way api.mapbox.com's were before: the style
	// gets an empty but valid one, so no tile or glyph request follows, and
	// anything else is answered locally rather than reaching the network.
	await page.route('**/tiles.openfreemap.org/**', async (route) => {
		if (!route.request().url().includes('/styles/')) {
			return route.fulfill({ status: 204, body: '' });
		}
		await route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify({
				version: 8,
				sources: {},
				layers: [],
				// MapLibre rejects any `text-field` layer when the style declares no
				// glyphs, and several data layers here use one. It must also be an
				// ABSOLUTE URL: MapLibre 6 refuses relative glyph and sprite URLs.
				glyphs: 'https://example.invalid/{fontstack}/{range}.pbf'
			})
		});
	});

	return rpcCalls;
}

async function selectTurin(page: Page) {
	// Open the search the way a user does — the landing page's own "Select a city"
	// button, which sets HeaderSearch's `active` prop. Carbon 0.112 renders TWO
	// elements with aria-label="Search" (HeaderSearch.svelte:347 and :452), so
	// clicking `.first()` was ambiguous: it passed locally and timed out on CI's
	// slower runner, where the other one won.
	await page.getByRole('button', { name: /Select a city/ }).click();

	// Carbon 0.112 generates the input id per instance (it was a stable
	// #search-input before), so target the class. Assert it is actually visible
	// first: `fill()` on a hidden input reports a 30s timeout that says nothing
	// about why the panel never opened.
	const input = page.locator('.bx--header__search-input');
	await expect(input).toBeVisible({ timeout: 15000 });
	await input.fill('Turin');

	// Results are exposed as role=menuitem inside a role=menu. Selecting one is a
	// navigation now, not a state change, so wait for the URL rather than guess.
	await page.getByRole('menuitem', { name: 'Turin' }).click();
	await page.waitForURL('**/Turin/measure');
}

/**
 * Axe violation ceilings, lowered as they are fixed — never raised. Recorded here
 * rather than in .quality-baseline.json because that file is read by a node script
 * with no browser; these need a running page.
 */
const A11Y_BUDGET = { landing: 0, measure: 0 };

/*
	The section bar is a <nav> of links, not a Carbon tab strip: these navigate to
	a route rather than toggling a panel, so they carry `aria-current="page"` and
	not `role="tab"` / `aria-selected`. Scoped to `nav.sections`, because the
	header panel offers links with the same names.
*/
const sectionLink = (page: Page, name: string) =>
	page.locator('nav.sections').getByRole('link', { name, exact: true });

test.describe('ATGreen smoke', () => {
	test('landing page renders the question and the city picker', async ({ page }) => {
		await stubBackend(page);
		await page.goto('/');

		await expect(page.getByText('How', { exact: false }).first()).toBeVisible();
		await expect(page.getByRole('button', { name: /Select a city/ })).toBeVisible();
		// One map on the landing page: the globe.
		await expect(page.locator('.maplibregl-map')).toHaveCount(1);
	});

	test('the globe glows green, centred on it and sized to it', async ({ page }) => {
		await stubBackend(page);
		await page.goto('/');

		// MapLibre's atmosphere has no colour setting, so the glow is a CSS
		// gradient placed from project(). If `load` never fires or the measurement
		// breaks, the glow is missing, or drawn somewhere the globe is not.
		const root = page.locator('.map-root.lit');
		await expect(root).toHaveCount(1, { timeout: 30000 });
		const glow = await root.evaluate((el) => {
			const cs = getComputedStyle(el);
			const box = el.getBoundingClientRect();
			return {
				x: parseFloat(cs.getPropertyValue('--globe-x')) / box.width,
				y: parseFloat(cs.getPropertyValue('--globe-y')) / box.height,
				r: parseFloat(cs.getPropertyValue('--globe-r')),
				image: getComputedStyle(el, '::after').backgroundImage
			};
		});
		expect(glow.image).toContain('radial-gradient');
		// Head-on (pitch is locked at 0), the globe sits at the centre of its box.
		expect(glow.x).toBeCloseTo(0.5, 1);
		expect(glow.y).toBeCloseTo(0.5, 1);
		// About 110 px at zoom 0.5; the bounds catch a unit or frame mix-up.
		expect(glow.r).toBeGreaterThan(50);
		expect(glow.r).toBeLessThan(300);
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

		await expect(page.locator('canvas.maplibregl-canvas')).toHaveCount(1);
		expect(consoleErrors, `console errors: ${consoleErrors.join(' | ')}`).toHaveLength(0);

		// Regression guard: the grid is fetched exactly once per city selection. It was
		// fetched three times (immediate: true), then zero times (immediate: false plus
		// lazily-mounted tabs). Both shipped; both would be caught here.
		//
		// Poll rather than assert immediately: the watcher debounces by 500ms, and with
		// stubbed responses the tiles appear well before that elapses. Asserting the
		// count straight after the visibility check was a race that happened to pass.
		await expect
			.poll(() => rpcCalls.filter((c) => c === 'getaccessibility').length, { timeout: 15000 })
			.toBe(1);

		// ...and it must stay at one: no late duplicate.
		await page.waitForTimeout(2000);
		const accessibility = rpcCalls.filter((c) => c === 'getaccessibility');
		expect(accessibility, `getaccessibility calls: ${accessibility.length}`).toHaveLength(1);
	});

	test('only the open tab is mounted', async ({ page }) => {
		const rpcCalls = await stubBackend(page);
		await page.goto('/');
		await selectTurin(page);
		await expect(page.getByText('WHO', { exact: true }).first()).toBeVisible({ timeout: 20000 });

		// One route is mounted at a time, so one map.
		await expect(page.locator('.maplibregl-map')).toHaveCount(1);

		// Explore's 2.8 MB green-areas request must not happen until its tab is opened.
		expect(rpcCalls).not.toContain('queryosmgreen');

		await sectionLink(page, 'Explore').click();
		await expect.poll(() => rpcCalls.filter((c) => c === 'queryosmgreen').length).toBe(1);
	});

	// Sections are addressable. This replaces a test for a bug that is now
	// unexpressible: the header panel used to set a numeric tab index from a DOM
	// attribute — a string — which the `selectedTab === n` panel gates then failed
	// to match, so six links highlighted a tab and rendered an empty panel. There
	// is no index any more; the URL decides what mounts.
	test('header panel links navigate to their section', async ({ page }) => {
		await stubBackend(page);
		await page.goto('/');
		await selectTurin(page);
		await expect(page.getByText('WHO', { exact: true }).first()).toBeVisible({ timeout: 20000 });

		// The HeaderAction button carries no accessible name; it is the panel toggle.
		await page.locator('header button.bx--header__action').last().click();
		await page.locator('header').getByRole('link', { name: 'Compare', exact: true }).click();

		await page.waitForURL('**/Turin/compare');
		await expect(sectionLink(page, 'Compare')).toHaveAttribute('aria-current', 'page');
		// The assertion that was missing when this shipped broken: the section has
		// to actually render something.
		await expect(page.locator('#main-content')).not.toBeEmpty();
		await expect(page.locator('nav.sections')).toBeVisible();
	});

	test('a section URL can be opened directly, shared and navigated back', async ({ page }) => {
		await stubBackend(page);

		// Deep link, cold: no click path reached this, the URL alone did.
		await page.goto('/Turin/draw');
		await expect(sectionLink(page, 'Draw')).toHaveAttribute('aria-current', 'page');
		await expect(page.locator('.maplibregl-map')).toHaveCount(2, { timeout: 20000 });

		// They are real links, so the URL follows the view...
		await sectionLink(page, 'Explore').click();
		await page.waitForURL('**/Turin/explore');

		// ...and the back button follows the URL.
		await page.goBack();
		await page.waitForURL('**/Turin/draw');
		await expect(sectionLink(page, 'Draw')).toHaveAttribute('aria-current', 'page');
	});

	test('a city is reachable by name whatever the accents and casing', async ({ page }) => {
		await stubBackend(page);

		// The fixture's cities include Turin; a lower-case slug must find it, since
		// links may be typed by hand even though the app never generates them.
		await page.goto('/turin/measure');
		await expect(page.getByText('WHO', { exact: true }).first()).toBeVisible({ timeout: 20000 });

		// An unknown city explains itself instead of rendering an empty shell.
		await page.goto('/atlantis/measure');
		await expect(page.getByText(/No city called/)).toBeVisible();
		await expect(page.locator('.maplibregl-map')).toHaveCount(0);
	});

	// Nothing in this suite would have failed while half the viewport was empty
	// black: every assertion was about teardown or request counts, none about
	// geometry. These pin the layout itself.
	test.describe('pane layout', () => {
		test('the map fills its stage and no hidden panel holds space', async ({ page }) => {
			await stubBackend(page);
			await page.goto('/Turin/measure');
			await expect(page.locator('canvas.maplibregl-canvas')).toHaveCount(1, { timeout: 20000 });

			const box = await page.evaluate(() => {
				const rail = document.querySelector('.rail')!.getBoundingClientRect();
				const stage = document.querySelector('.stage')!.getBoundingClientRect();
				const canvas = document.querySelector('canvas.maplibregl-canvas')!.getBoundingClientRect();
				const tabs = document.querySelector('nav.sections')!.getBoundingClientRect();
				return {
					tabsBottom: tabs.bottom,
					railTop: rail.top,
					railWidth: rail.width,
					stageTop: stage.top,
					stageBottom: stage.bottom,
					stageW: stage.width,
					stageH: stage.height,
					canvasW: canvas.width,
					canvasH: canvas.height,
					vh: window.innerHeight,
					docOverflow: document.documentElement.scrollHeight - document.documentElement.clientHeight
				};
			});

			// The canvas fills the stage exactly — the whole point of the shell.
			expect(Math.abs(box.canvasW - box.stageW), 'canvas width vs stage').toBeLessThan(2);
			expect(Math.abs(box.canvasH - box.stageH), 'canvas height vs stage').toBeLessThan(2);

			// The stage reaches the bottom of the viewport: nothing below is stealing
			// space, and no ancestor transform has broken the height chain.
			expect(Math.abs(box.stageBottom - box.vh), 'stage bottom vs viewport').toBeLessThan(2);

			// Rail and stage start at the same line. The dead space used to appear
			// *above* the controls, so this is the direct inverse of that bug.
			expect(Math.abs(box.railTop - box.stageTop), 'rail top vs stage top').toBeLessThan(2);

			// A map pane does not scroll the document.
			expect(box.docOverflow, 'document overflow').toBeLessThan(2);

			// The assertion that actually catches the original bug. Everything above
			// only proves the pane fills what it was GIVEN; the defect was a sibling
			// above it taking space away, which leaves all of those true. Verified by
			// injecting a `flex-grow:1` div above the pane: it stole 124px and every
			// other assertion here still passed.
			expect(Math.abs(box.stageTop - box.tabsBottom), 'gap between tabs and stage').toBeLessThan(2);
		});

		test('Draw gives both maps an equal half', async ({ page }) => {
			await stubBackend(page);
			await page.goto('/Turin/draw');
			await expect(page.locator('canvas.maplibregl-canvas')).toHaveCount(2, { timeout: 20000 });

			// The After column was `visibility:hidden` until a cell was picked, which
			// still reserves its box — so Before was permanently half-width with
			// nothing beside it.
			const widths = await page.$$eval('canvas.maplibregl-canvas', (els) =>
				els.map((e) => e.getBoundingClientRect().width)
			);
			expect(widths).toHaveLength(2);
			expect(Math.abs(widths[0] - widths[1]), `widths: ${widths}`).toBeLessThan(2);
			expect(widths[0], 'each map should be substantial').toBeGreaterThan(200);
		});

		test('nothing overlaid on a map is stretched to the map itself', async ({ page }) => {
			await stubBackend(page);
			await page.goto('/Turin/draw');
			await expect(page.locator('canvas.maplibregl-canvas')).toHaveCount(2, { timeout: 20000 });

			// `.map-root > :global(div)` was meant to size the map's own container,
			// but <slot /> renders into .map-root too, so the rule also handed
			// `height: 100%` to the slotted legend and map header. BaseLegend is
			// `position: absolute; bottom: 1.5rem; max-width: 25rem` over a dark
			// translucent background — at full height that drew a 400px-wide black
			// column down the middle of the Before map and pushed its colour ramp
			// clean off the top edge.
			const overlays = await page.$$eval('.map-root', (roots) =>
				roots.flatMap((root) => {
					const rootHeight = root.getBoundingClientRect().height;
					return [...root.children]
						.filter((child) => !child.classList.contains('map-canvas'))
						.map((child) => ({
							cls: child.className.toString(),
							ratio: rootHeight ? child.getBoundingClientRect().height / rootHeight : 0
						}));
				})
			);

			// Without this the test passes by finding nothing to check, which is the
			// failure mode every layout assertion in this file has had at least once.
			expect(overlays.length, 'expected at least one overlay inside a map').toBeGreaterThan(0);

			for (const overlay of overlays) {
				expect(overlay.ratio, `overlay "${overlay.cls}" fills its whole map`).toBeLessThan(0.9);
			}
		});

		test('the rail becomes a drawer on a narrow viewport', async ({ page }) => {
			await stubBackend(page);
			await page.setViewportSize({ width: 375, height: 812 });
			await page.goto('/Turin/measure');
			await expect(page.locator('canvas.maplibregl-canvas')).toHaveCount(1, { timeout: 20000 });

			// Stacked, not side by side: the rail spans the width and the stage sits
			// below it. This is the branch the old `innerWidth > 500` checks covered
			// in JS, so it is the one most likely to regress silently.
			const box = await page.evaluate(() => {
				const rail = document.querySelector('.rail')!.getBoundingClientRect();
				const stage = document.querySelector('.stage')!.getBoundingClientRect();
				return {
					railW: rail.width,
					stageW: stage.width,
					railBottom: rail.bottom,
					stageTop: stage.top,
					vw: window.innerWidth
				};
			});
			expect(Math.abs(box.railW - box.vw), 'rail spans the viewport').toBeLessThan(2);
			expect(Math.abs(box.stageW - box.vw), 'stage spans the viewport').toBeLessThan(2);
			expect(box.stageTop).toBeGreaterThanOrEqual(box.railBottom - 2);
		});

		test('every stylesheet is served from this origin', async ({ page }) => {
			await stubBackend(page);
			await page.goto('/');
			await expect(page.locator('.maplibregl-map')).toHaveCount(1, { timeout: 20000 });

			// The site's Content-Security-Policy is `style-src 'self'` plus whatever
			// hosts it lists, so a stylesheet from anywhere else is at best a
			// dependency on someone else's uptime and at worst blocked outright. The
			// map library's CSS used to come from api.mapbox.com; it now ships in the
			// bundle, and this pins that no stylesheet of any kind comes from off-site.
			const sheets = await page.$$eval('link[rel=stylesheet]', (ls) =>
				ls.map((l) => (l as HTMLLinkElement).href)
			);
			// Compare parsed origins, not substrings: CodeQL flagged a substring test
			// on an earlier version of this line, and it was right — a URL containing
			// a hostname is not the same as a URL on that host.
			const here = new URL(page.url()).origin;
			const external = sheets.filter((h) => {
				try {
					return new URL(h, here).origin !== here;
				} catch {
					return false; // a malformed href is not a third-party host
				}
			});
			expect(external, `third-party stylesheets: ${external.join(', ')}`).toHaveLength(0);

			// Proof the stylesheet actually applied: MapLibre's corner containers are
			// absolutely positioned by it, and static without it.
			const pos = await page.evaluate(() => {
				const el = document.querySelector('.maplibregl-ctrl-bottom-left');
				return el ? getComputedStyle(el).position : null;
			});
			expect(pos, 'map control container position').toBe('absolute');
		});

		test('the index rows are grouped, reachable and operable by keyboard', async ({ page }) => {
			await stubBackend(page);
			await page.goto('/Turin/measure');
			const tiles = page.locator('button.row');
			await expect(tiles).toHaveCount(8, { timeout: 20000 });

			// The eight indexes are three different kinds of measurement, not eight
			// peers, and the grouping comes from AccessibilityIndexType rather than
			// from a hand-kept list — so a new index gets a group without any change
			// here. A flat panel invited comparing WHO's 75% with IPP's 100%, which
			// are answers to different questions in different units.
			await expect(page.locator('.group-head')).toHaveText([
				'Distance to greenspace',
				'Green per person',
				'Exposure'
			]);

			// Every row states its own requirement, so no index is unexplained.
			await expect(page.locator('.row .sub').first()).not.toBeEmpty();

			// They were bare <div on:click> with an empty on:keypress, and they are
			// the only way to change the index (WCAG 2.1.1).
			await expect(tiles.first()).toHaveAttribute('aria-pressed', 'true');
			await tiles.nth(3).focus();
			await expect(tiles.nth(3)).toBeFocused();
			await page.keyboard.press('Enter');
			await expect(tiles.nth(3)).toHaveAttribute('aria-pressed', 'true');
			await expect(tiles.first()).toHaveAttribute('aria-pressed', 'false');
		});
	});

	/*
		Automated accessibility checks.

		University of Turin is an EU public-sector body, so Directive (EU) 2016/2102
		and EN 301 549 make WCAG 2.1 AA a legal obligation rather than a preference.
		There was no automated check of any kind before this.

		Ratcheted, not gated: a hard zero on day one would be permanently red and
		switched off within a week — the same reasoning as the svelte-check and
		eslint baselines, both of which have since come down a long way. Axe finds a
		fraction of real barriers, so a green run here is a floor, not a pass.
	*/
	test.describe('accessibility', () => {
		/*
			Name the offending nodes, not just the rule. "color-contrast (2)" tells you
			a rule broke but not where, which turns every failure into a bisect. Axe
			already carries the selector and the measured ratio in `failureSummary`.
		*/
		const describe_violations = (
			violations: { id: string; impact?: string | null; nodes: { target: unknown[] }[] }[]
		) =>
			violations
				.map(
					(v) => `${v.id} [${v.impact}] -> ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`
				)
				.join('; ');

		const scan = (page: Page) =>
			new AxeBuilder({ page })
				.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
				// The map is a WebGL canvas; axe cannot see inside it and flags the
				// container. Keyboard access to per-cell data is a known open gap,
				// tracked separately — excluding it here keeps the number meaningful
				// rather than pinned to one unfixable element.
				.exclude('.maplibregl-canvas-container')
				.analyze();

		test('the landing page stays within its violation budget', async ({ page }) => {
			await stubBackend(page);
			await page.goto('/');
			await expect(page.getByRole('button', { name: /Select a city/ })).toBeVisible();

			const { violations } = await scan(page);
			expect(violations.length, `landing: ${describe_violations(violations)}`).toBeLessThanOrEqual(
				A11Y_BUDGET.landing
			);
		});

		test('Measure stays within its violation budget', async ({ page }) => {
			await stubBackend(page);
			await page.goto('/Turin/measure');
			await expect(page.locator('button.row').first()).toBeVisible({ timeout: 20000 });

			const { violations } = await scan(page);
			expect(violations.length, `measure: ${describe_violations(violations)}`).toBeLessThanOrEqual(
				A11Y_BUDGET.measure
			);
		});
	});

	/*
		Nothing covered the tutorial, so a broken image path shipped silently would
		have been invisible to CI. Its paths are template strings —
		`screenshots/wide/step${n}-h.webp` — so no static check can see them; only
		loading each step can. Walks all five steps at both layouts and requires
		the right file for each step AND that it actually decoded, since a missing
		file still produces an <img> element, just a broken one.
	*/
	test('every tutorial step shows its image, at both layouts', async ({ page }) => {
		await stubBackend(page);

		for (const [label, viewport, variant] of [
			['wide', { width: 1280, height: 800 }, 'h'],
			['mobile', { width: 375, height: 812 }, 'm']
		] as const) {
			await page.setViewportSize(viewport);
			await page.goto('/');
			await page.getByRole('button', { name: 'Tutorial', exact: true }).click();

			const img = page.locator('.bx--modal.is-visible img');
			for (let n = 1; n <= 5; n++) {
				await expect(img, `${label} step ${n}`).toHaveAttribute(
					'src',
					new RegExp(`step${n}-${variant}\\.webp$`)
				);
				await expect
					.poll(() => img.evaluate((el: HTMLImageElement) => (el.complete ? el.naturalWidth : 0)), {
						message: `${label} step ${n} image did not decode`
					})
					.toBeGreaterThan(0);
				if (n < 5) await page.getByRole('button', { name: 'Next', exact: true }).click();
			}
		}
	});

	test('maps are torn down when their tab closes', async ({ page }) => {
		// Counting .maplibregl-map nodes does NOT test this: Svelte removes the DOM node
		// whether or not map.remove() ran, so that assertion passes even with the
		// teardown deleted (verified). What leaks is the WebGL context, which is
		// invisible in the DOM.
		//
		// MapLibre's remove() releases the context via WEBGL_lose_context, which
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
		// Wait for the first map to settle before driving tabs: the loading overlay can
		// still cover the tab bar at the moment the tiles become visible.
		await expect(page.locator('.maplibregl-map')).toHaveCount(1, { timeout: 20000 });
		await expect(page.locator('.bx--loading-overlay')).toHaveCount(0, { timeout: 20000 });

		// Draw mounts two maps; leaving it must release both.
		for (let i = 0; i < 2; i++) {
			await sectionLink(page, 'Draw').click();
			await expect(page.locator('.maplibregl-map')).toHaveCount(2, { timeout: 15000 });
			await sectionLink(page, 'Measure').click();
			await expect(page.locator('.maplibregl-map')).toHaveCount(1, { timeout: 15000 });
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
