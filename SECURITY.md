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
