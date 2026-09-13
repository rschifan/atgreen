# ATGreen

Interactive interface for exploring **multi-dimensional accessibility to urban green** in
over 1,000 cities worldwide.

**Live: <https://atgreen.hpc4ai.unito.it/>**

ATGreen accompanies the study _"On the need to move from a single indicator to a
multi-dimensional framework to measure accessibility to urban green"_ by Alice Battiston and
Rossano Schifanella ([arXiv:2308.05538](https://arxiv.org/abs/2308.05538)). The paper's
argument is that no single metric reliably describes how reachable green space is in a city,
because the answer depends on the interaction between where greenery sits and where people
live. This interface exists to make that concrete: pick a city, and compare what eight
different accessibility indicators say about the same streets.

**The methodology lives in a separate repository.**
[`alibatti/ATGreen`](https://github.com/alibatti/ATGreen) holds the Python pipeline that
computes the indicators and reproduces the analysis in the paper. **This** repository is only
the web interface that presents the results.

## What it does

| Tab         |                                                                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Search**  | Pick a city from a globe of every city in the sample                                                                       |
| **Measure** | Map one of eight indicators as a choropleth over a ~250 m population grid, and inspect why a single cell scores as it does |
| **Compare** | Put two indicators side by side and see how cells move between classes                                                     |
| **Create**  | Build your own indicator by choosing green types, minimum size and a walking-time budget                                   |
| **Draw**    | Add a hypothetical new green area and see how accessibility changes, before and after                                      |
| **Explore** | Browse the underlying OpenStreetMap green areas                                                                            |

The eight indicators (WHO, BE1–BE3, NE1, NE2, IPP, ESA) are served by the API at runtime
rather than hard-coded, so adding one is a server-side change.

## Architecture

```
browser ── SvelteKit (adapter-node, :4000) ── nginx ── PostgREST (:3002) ── PostgreSQL "esa"
              Carbon components                          /rpc/*          OSM · GHS-POP · ESA WorldCover
              mapbox-gl
```

The frontend is a thin client: every indicator is computed in PostgreSQL and returned as
GeoJSON from PostgREST RPC endpoints under `/rpc/`. There is no application database and no
server-side state — `src/js/api.js` is the whole data layer.

Distances are street-network walking times precomputed with
[OSRM](https://github.com/Project-OSRM/osrm-backend); greenery comes from OpenStreetMap and
ESA WorldCover 2020; population from the GHS population grid.

## Developing

```bash
npm ci
npm run dev
```

The app talks to the **production** API at `https://atgreen.hpc4ai.unito.it/rpc` (the base URL
is hard-coded in `src/js/api.js`), so a dev server needs network access but no local database.

```bash
npm run test:unit     # vitest — pure logic in src/js
npm run test:e2e      # playwright — hermetic, stubs the API and Mapbox
npm run check:ratchet # svelte-check + eslint, against a recorded baseline
npm run lint          # prettier + eslint
npm run build         # production build into build/
```

### The quality ratchet

`tsconfig.json` has had `"strict": true` from the start, but it was never enforced, so the
tree carries several hundred pre-existing type errors and lint warnings. Making those a
blocking gate would mean a permanently red build, so `scripts/quality-ratchet.mjs` records a
baseline in `.quality-baseline.json` and **fails only when a count rises**. When you fix
some, lower the baseline:

```bash
node scripts/quality-ratchet.mjs --update
```

The goal is zero, at which point the ratchet goes away and the tools are enforced directly.

### Tests that document bugs

A few known defects are pinned with vitest's `it.fails` rather than left silent — for example
that an empty green-type selection is read as "all types". They pass while the bug exists and
**fail once it is fixed**, which is the signal to turn them into ordinary assertions.

## Deploying

The app is built locally and served by systemd on the host:

```bash
npm run build
rsync -az build/ ubuntu@ghsci.hpc4ai.unito.it:/var/www/greenaccessibility/html/build/
ssh ubuntu@ghsci.hpc4ai.unito.it "sudo systemctl restart atgreen-web.service"
```

This is being replaced by immutable, versioned releases with an atomic switch. Until then,
take a copy of the current `build/` before deploying so a rollback is possible.

## Citing

See [`CITATION.cff`](CITATION.cff), or cite the paper directly:

> Battiston, A., & Schifanella, R. (2023). _On the need to move from a single indicator to a
> multi-dimensional framework to measure accessibility to urban green._ arXiv:2308.05538.

## Licence

[MIT](LICENSE) for this interface. The methodology repository is licensed separately (CC0-1.0).
