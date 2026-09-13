#!/usr/bin/env node
/**
 * Quality ratchet: block regressions without blocking on history.
 *
 * `tsconfig` sets `"strict": true` and ESLint is configured, but neither has ever been
 * enforced, so the tree carries a few hundred pre-existing problems. Turning either
 * into a blocking gate on day one means a permanently red build, which gets disabled
 * within a week. Instead: record a baseline, fail only when a count *rises*, and lower
 * the baseline as things are fixed. When a count reaches zero, drop it from here and
 * enforce the tool directly.
 *
 *   node scripts/quality-ratchet.mjs            # verify against .quality-baseline.json
 *   node scripts/quality-ratchet.mjs --update   # accept the current counts
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASELINE = '.quality-baseline.json';

/** Run a command, returning stdout+stderr whatever the exit code. */
function run(cmd) {
	try {
		return execSync(cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
	} catch (err) {
		// Both tools exit non-zero whenever they find anything, which is the normal
		// case while a baseline is above zero. The counts, not the exit code, matter.
		return `${err.stdout ?? ''}${err.stderr ?? ''}`;
	}
}

const checks = {
	'svelte-check': () => {
		const out = run('npx svelte-check --tsconfig ./tsconfig.json --output human');
		const m = out.match(/svelte-check found (\d+) errors?/);
		if (!m) throw new Error('could not parse svelte-check output:\n' + out.slice(-1500));
		return Number(m[1]);
	},
	eslint: () => {
		// Write the report to a file rather than parsing stdout: npm prints config
		// warnings onto the same stream, which corrupts the JSON.
		const report = join(tmpdir(), `atgreen-eslint-${process.pid}.json`);
		run(`npx eslint . -f json -o ${report}`);
		if (!existsSync(report)) throw new Error('eslint produced no report');
		const results = JSON.parse(readFileSync(report, 'utf-8'));
		rmSync(report, { force: true });
		return results.reduce((n, f) => n + f.errorCount + f.warningCount, 0);
	}
};

const current = {};
for (const [name, fn] of Object.entries(checks)) {
	try {
		current[name] = fn();
	} catch (err) {
		console.error(`${name}: ${err.message}`);
		process.exit(2);
	}
}

if (process.argv.includes('--update')) {
	writeFileSync(BASELINE, JSON.stringify(current, null, '\t') + '\n');
	console.log('Baseline updated:', current);
	process.exit(0);
}

if (!existsSync(BASELINE)) {
	console.error(`No ${BASELINE}. Run: node scripts/quality-ratchet.mjs --update`);
	process.exit(2);
}

const baseline = JSON.parse(readFileSync(BASELINE, 'utf-8'));
let failed = false;

for (const [name, count] of Object.entries(current)) {
	const before = baseline[name];
	if (before === undefined) {
		console.error(`${name}: no baseline recorded. Run --update.`);
		failed = true;
	} else if (count > before) {
		console.error(`${name}: ${count}, up from ${before} — this change introduced ${count - before}.`);
		failed = true;
	} else if (count < before) {
		console.log(`${name}: ${count}, down from ${before}. Lower the baseline with --update.`);
	} else {
		console.log(`${name}: ${count}, unchanged.`);
	}
}

process.exit(failed ? 1 : 0);
