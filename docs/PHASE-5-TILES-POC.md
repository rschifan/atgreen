# Phase 5 proof of concept: do vector tiles actually pay off?

Run on `wikiatlas-vm`, 2026-09-14, against live data. This answers the question the geo
phase rests on **before** committing weeks to it.

## What was tested

The eight fixed indexes for Turin, fetched straight from PostgREST, joined on the grid
coordinates into one GeoJSON with a value per index per cell, then baked with the
`tippecanoe 2.82` already installed on the box.

```bash
python3 bake_poc.py Turin          # join 8 bands into one feature set
tippecanoe -o Turin.pmtiles -z13 -Z4 --no-feature-limit --no-tile-size-limit \
  -l accessibility Turin_combined.geojson
```

## Result

|                                                        | size                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Today: 8 separate `getaccessibility` fetches           | **6.58 MB**                                                                    |
| Combined GeoJSON (one geometry set, 8 values per cell) | 1.06 MB                                                                        |
| **One PMTiles tileset, z4–z13 (full grid resolution)** | **1.26 MB — 5.2× smaller**                                                     |
| PMTiles at tippecanoe's auto zoom (z8)                 | 0.56 MB — _but it under-resolves the 250 m grid, so this number is not usable_ |

Quote the **5.2×**, not the 11.7×. The auto-zoom bake drops to ~561 m resolution and
loses cells; it is recorded here only so nobody re-derives the flattering figure and
believes it.

## Why the real gain is larger than 5.2×

- **Range requests.** A PMTiles archive is fetched by byte range, so opening a city pulls
  only the tiles on screen rather than the whole city.
- **Switching indexes becomes free.** All eight values live in the same tile, so flipping
  WHO → BE1 → ESA costs zero additional network. Today each is a separate multi-megabyte
  fetch.
- **No client-side parsing.** The browser currently parses a multi-megabyte GeoJSON on the
  main thread; tiles are decoded incrementally by MapLibre.

## What this does _not_ cover

- Turin has 3,867 cells. Milan has 13,220, and the sample is ~2,649 cities. Baking all of
  them is a batch job to size and schedule, with storage on `/mnt/work` (229 GB free; `/`
  is at 92% and must not be used).
- **The parameterised views cannot be baked at all.** Create and Draw compute indices from
  continuous user inputs (`pga_size`, `green_code`, `distance`), so there is no finite
  tileset for them. Those need PostGIS `ST_AsMVT` served dynamically. This split — bake
  what is fixed, tile what is computed — remains the crux of the phase.
- Class breaks would move to bake time, which changes where the legend's numbers come from.

## Reproducing

`bake_poc.py` is not committed: it is twenty lines that fetch the eight bands from
`127.0.0.1:3002` and merge them on `(x, y)`. The join is the same logic as
`join_on_cell()` in `src/js/stats.ts`, which is unit tested.
