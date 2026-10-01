# The basemap

ATGreen draws its data with [MapLibre GL JS](https://maplibre.org) on
[OpenFreeMap](https://openfreemap.org)'s **dark** style: OpenStreetMap vector tiles,
free, with no API key, no account and no usage limits. It replaced Mapbox in
September 2026.

The whole configuration is one line in `src/js/map.js`:

```js
export const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/dark';
```

## What the server has to allow

Everything — the style, the vector tiles, glyphs, sprites and the shaded-relief raster —
comes from a single host, `tiles.openfreemap.org`, which sends
`access-control-allow-origin: *`. The site's Content-Security-Policy
(`/etc/nginx/snippets/atgreen-security-headers.conf` on `ghsci.hpc4ai.unito.it`) must
list it:

```
connect-src 'self' https://tiles.openfreemap.org
img-src     'self' data: blob: https://tiles.openfreemap.org
```

Without it the basemap is blocked in production while working perfectly on the dev
server, which has no CSP — the failure is invisible until deploy.

## The landing globe

The home page's globe is dressed differently from the city maps (`GlobeMap.svelte`):
the basemap's roads, land use and labels are hidden, the oceans are deep blue, and the
land is Natural Earth's shaded relief. OpenFreeMap serves that raster
(`/natural_earth/ne2sr/{z}/{x}/{y}.png`) from the same host, so the CSP above covers it.
The tiles are opaque with white oceans, so the relief sits under the vector water layer.
Capped at zoom 2, the landing view downloads about 1 MB of relief, once per browser.

MapLibre's atmosphere cannot be coloured, so the green glow, the sphere shading and
the star field are CSS, placed from the globe's on-screen radius measured with
`project()`.

How the globe draws the Earth and its cities is a per-browser choice on the Settings
page (`/settings`), defined in `src/js/globe_styles.ts`: Dot globe (the default), Firefly,
Relief, City lights, Heat glow, Data spikes and Pings. The Dot globe hides the relief
(so it is never downloaded) and draws land from `static/land-dots.json`, 8,400 points of
a Fibonacci lattice kept where Natural Earth has land; `node scripts/land-dots.mjs`
rebuilds it. The previews on the Settings page are `static/globe-styles/*.webp`.

## The trade-off, chosen deliberately

- Every visitor's browser contacts OpenFreeMap as they pan, so it sees their IP address
  and viewport.
- The service is donation-funded, with no uptime guarantee. If it is down, the basemap is
  down; the accessibility data comes from this site's own `/rpc/` and still renders.

## If self-hosting is ever wanted

Measured with `pmtiles extract --dry-run` against the Protomaps build of 2026-09-30:

| What                                                                  | Size       |
| --------------------------------------------------------------------- | ---------- |
| Whole planet, zoom 0–14                                               | 68 GB      |
| Whole planet, zoom 0–13                                               | 36 GB      |
| **Street detail within 30 km of each of the 1,046 cities, zoom 0–13** | **5.7 GB** |
| Whole world at globe zooms, 0–6                                       | 45 MB      |

The city-clipped extract plus the low-zoom world is the right shape: the app never shows
street detail anywhere but its cities. It would need a `/basemap/` location in nginx
serving the files with HTTP range requests, the `pmtiles` protocol registered in
`src/js/map.js`, and a style whose sprite and glyph URLs are **absolute** — MapLibre 6
rejects a relative sprite URL outright.

On `ghsci`, put any such files on `/mnt/work`, never the root filesystem: `/` was 95%
full with 11 GB free when this was measured.

## Tests

The end-to-end suite intercepts the OpenFreeMap style URL with an empty, valid style, so
no test ever reaches the tile server and the suite stays hermetic.
