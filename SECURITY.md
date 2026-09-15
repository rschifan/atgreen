# Security policy

ATGreen is a research interface maintained by a small academic team. It is not a commercial
product and has no formal SLA, but security reports are taken seriously and acted on.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Report it privately through GitHub's
[private vulnerability reporting](https://github.com/rschifan/atgreen/security/advisories/new),
or by email to <rossano.schifanella@unito.it>.

Please include what you found, how to reproduce it, and what you think the impact is. You
will get an acknowledgement within a week. Please give us a reasonable window to fix it
before disclosing publicly.

## Scope

This repository contains **only the web interface**. The indicators themselves are computed
in PostgreSQL and served by PostgREST under `https://atgreen.hpc4ai.unito.it/rpc/`, which
lives outside this repository — reports about that API are still welcome here and will be
routed appropriately.

Please **do not** run automated scanners, fuzzers, or load tests against the live site. It
runs on shared university research infrastructure alongside unrelated services. If you need
to test something actively, get in touch first.

## Out of scope

- The Mapbox access token in `src/js/mapbox.js` is a **public** (`pk.`) token, exposed by
  design in any client-side Mapbox application. It is not a secret.
- Findings that require a compromised end-user device or browser.

## Dependency overrides

`package.json` pins **`cookie` to `^0.7.0`** through an npm `override`. Do not remove it
without reading this.

`@sveltejs/kit@2.70.3` — the newest release at the time of writing — declares
`cookie@^0.6.0`, and every version below `0.7.0` carries
[GHSA-pxg6-pf52-xh8x](https://github.com/advisories/GHSA-pxg6-pf52-xh8x) (low severity:
`cookie` accepts a name, path or domain containing out-of-bounds characters). There is no
upstream fix to upgrade to, and npm's own resolution is nonsense — it proposes downgrading
`@sveltejs/kit` to `0.0.30` and `@sveltejs/adapter-node` to `0.0.18`, which is why the
Dependabot security job fails outright rather than opening a pull request.

This application never passes untrusted input to a cookie name, path or domain — it sets no
cookies at all, and has no hooks and no server routes — so the practical exposure was nil.
The override exists so that a permanently failing security job does not mask a real one
later. `npm audit` reports zero vulnerabilities with it in place.

Verified with `cookie@0.7.2`: 79 unit tests, 11 end-to-end tests, a production build, and
every route served by the real `adapter-node` server (`node build/index.js`), which is the
process that actually loads `cookie` at runtime — `vite preview` does not. Drop the override
once a SvelteKit release widens that range.
