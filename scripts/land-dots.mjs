// Builds static/land-dots.json, the land of the "Dot globe" style: a Fibonacci
// lattice over the sphere (evenly spaced, no crowding at the poles), keeping the
// points where Natural Earth's shaded relief is land. The relief tiles paint the
// sea pure white, so "not white" is land. Output is bare [lng, lat] pairs.
//
//   node scripts/land-dots.mjs            (needs network and Playwright's Chromium)
import { chromium } from '@playwright/test';
import { writeFileSync } from 'fs';

const SAMPLES = 26000; // ~150 km apart; about a third fall on land

const browser = await chromium.launch();
const page = await browser.newPage();
// Any page on the tile host, so the tiles are same-origin and the canvas stays readable.
await page.goto('https://tiles.openfreemap.org/styles/dark');
const pairs = await page.evaluate(async (samples) => {
	const Z = 2,
		N = 1 << Z,
		T = 512;
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = N * T;
	const g = canvas.getContext('2d');
	await Promise.all(
		[...Array(N * N).keys()].map(async (k) => {
			const img = new Image();
			img.src = `/natural_earth/ne2sr/${Z}/${k % N}/${Math.floor(k / N)}.png`;
			await img.decode();
			g.drawImage(img, (k % N) * T, Math.floor(k / N) * T);
		})
	);
	const W = canvas.width;
	const px = g.getImageData(0, 0, W, W).data;
	const golden = Math.PI * (3 - Math.sqrt(5));
	const out = [];
	for (let i = 0; i < samples; i++) {
		const lat = (Math.asin(1 - (2 * (i + 0.5)) / samples) * 180) / Math.PI;
		if (Math.abs(lat) > 84) continue; // beyond the Mercator tiles
		const lng = (((((i * golden * 180) / Math.PI) % 360) + 540) % 360) - 180;
		const s = Math.sin((lat * Math.PI) / 180);
		const x = Math.floor(((lng + 180) / 360) * W);
		const y = Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * W);
		const j = (y * W + x) * 4;
		const sea = px[j] > 242 && px[j + 1] > 242 && px[j + 2] > 242;
		if (!sea) out.push([Math.round(lng * 100) / 100, Math.round(lat * 100) / 100]);
	}
	return out;
}, SAMPLES);
await browser.close();

writeFileSync(new URL('../static/land-dots.json', import.meta.url), JSON.stringify(pairs));
console.log(`static/land-dots.json: ${pairs.length} land dots`);
