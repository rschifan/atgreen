# Contributing

Thanks for taking an interest. This is a research project, so the bar is "does it keep the
science and the site honest", not "does it match a style guide".

## Before you start

For anything beyond a small fix, please open an issue first. The interface is tied to a
published methodology ([`alibatti/ATGreen`](https://github.com/alibatti/ATGreen),
[arXiv:2308.05538](https://arxiv.org/abs/2308.05538)), so a change to what an indicator
_means_ is a change to the paper, not just to this code.

## Working on it

```bash
npm ci
npm run dev
```

Before pushing:

```bash
npm run lint
npm run check:ratchet
npm run test:unit
npm run test:e2e
```

CI runs exactly these.

## What the checks expect

- **The ratchet may not rise.** `scripts/quality-ratchet.mjs` compares `svelte-check` and
  ESLint counts against `.quality-baseline.json`. Your change may not add errors. If you fix
  some, lower the baseline with `node scripts/quality-ratchet.mjs --update` and commit it.
- **The end-to-end suite is hermetic.** It stubs the API and the basemap style from fixtures in
  `tests/fixtures/`. Please keep it that way: tests must not depend on the production server
  being up, and must not put load on it.
- **New logic gets a test.** Anything non-trivial — a branch, a parser, a calculation —
  should leave one runnable check behind. Pure functions belong in `src/js/` where they can
  be tested directly; several were moved there for exactly this reason.

## The interface

- **Components come from [shadcn-svelte](https://shadcn-svelte.com)** (Bits UI underneath,
  Tailwind CSS 4, icons from Lucide). Add one with `npx shadcn-svelte@latest add <name>`; it
  lands in `src/lib/components/ui/`, where it is our code to edit. A few already carry fixes
  (accessibility, lint), each with a comment, so check `git diff` before re-adding one with
  `--overwrite`.
- **Reuse before you build.** The tool rails share their controls through
  `src/components/fields/` (index type, green types, time budget, ranges, selects) and
  `RailSection.svelte` (label, value, hint, error). A new control belongs there if a second
  rail could use it.
- **Colours are tokens.** The theme lives in `src/app.css`; use `bg-primary`,
  `text-muted-foreground`, `var(--border)` and the like, not hex values. Map paint
  properties are the exception: MapLibre cannot read CSS variables.
- **New components use runes** (`$props`, `$state`, `$derived`). Older ones are still in
  legacy mode; Svelte 5 decides per component, so convert a file whole or not at all.
- **Import icons one by one** (`@lucide/svelte/icons/search`), so only the icons used ship.

## Commit messages

Explain _why_, not just what. If a change is not obvious from the diff — a workaround, a
deliberate simplification, a measured trade-off — say so in the body, with the numbers if you
have them. Several bugs in this codebase existed because the reason for something was never
written down.

## Reporting bugs

Include the city and the indicator, whether the browser console shows errors, and what you
expected instead. A screenshot of the map usually settles it faster than a description.

For anything security-related, see [SECURITY.md](SECURITY.md) instead.
