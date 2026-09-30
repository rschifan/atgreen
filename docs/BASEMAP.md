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
