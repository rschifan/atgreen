# Deploying ATGreen

Production is `atgreen.hpc4ai.unito.it`, served by `atgreen-web.service` (SvelteKit
adapter-node on `127.0.0.1:4000`) behind nginx on the shared host `ghsci.hpc4ai.unito.it`.

## How a release is laid out

```
/opt/atgreen/
├── current -> releases/20260913T220215Z-c320637b   # atomic symlink
├── releases/
│   └── <UTC timestamp>-<short sha>/
│       ├── build/                  # SvelteKit adapter-node output
│       ├── node_modules/           # PRODUCTION deps only (~18 MB)
│       ├── package.json
│       └── release-manifest.json
└── deploy/
    ├── receive-release.sh          # forced command for the CI key
    └── atgreen-monitor.sh          # synthetic check, also run post-deploy
```

Releases are immutable. Deploying writes a new directory and repoints `current`;
**rolling back is repointing it back**, with no rebuild, no copy and no network.
`atgreen-web.service` has a drop-in setting `WorkingDirectory=/opt/atgreen/current`
(revert with `systemctl revert atgreen-web.service`).

### Why node_modules ships with the release

`adapter-node` externalises everything under `dependencies` rather than bundling it, so
`build/` alone is not runnable. Verified on this app: with `build/` only, `/` returns **500**
while `/about` returns **200** — a partial failure that a smoke test checking one route
would miss. A release therefore carries its own `npm ci --omit=dev` tree.

## The automated path (GitHub Actions)

`.github/workflows/ci.yml` is the whole pipeline. One workflow, two jobs:

1. **`build-and-test`** runs on every pull request and every push to `main`: format
   check, the lint/typecheck ratchet, unit tests, build, end-to-end tests. On a push to
   `main` it then packages that **same build** into `release.tgz` and uploads it as a
   workflow artifact.
2. **`deploy`** `needs:` that job, so it cannot start unless every gate passed on this
   exact commit. It downloads the artifact and pipes it over SSH to
   `receive-release.sh`, which
   1. unpacks into a new release directory,
   2. **smoke-tests it on a spare port** — `/` and `/about` must both return 200,
   3. repoints `current` and restarts the service,
   4. verifies the public URL, **rolling back by itself** if it does not come up,
   5. runs the full synthetic check,
   6. prunes all but the newest 5 releases.

**The bytes that ship are the bytes that passed.** The deploy job does not rebuild.
Until 2026-09-16 there was a separate `deploy.yml` that ran its own copy of every gate
in parallel with CI, so a push to `main` built and tested twice and shipped a different
build than the one CI had checked.

The last step asserts the live HTML references the **content-hashed entry chunk this run
produced**. It used to assert HTTP 200 and nothing else — and 200 is exactly what this
site returned through both of its real incidents, so that check could never have caught
either one.

### Configuration lives on the `production` environment, not in this repo

This repository is public. The workflow therefore names no hostnames and no paths; it
reads them from the `production` environment, alongside the two secrets. Environment
scope rather than repository scope matters here: a repository secret is readable by
every workflow in the repo, including ones added by a future pull request, while an
environment secret is only available to a job that declares `environment: production`
and passes its protection rules.

| Name                      | Kind     | Example                                    |
| ------------------------- | -------- | ------------------------------------------ |
| `ATGREEN_DEPLOY_KEY`      | secret   | the CI private key                         |
| `ATGREEN_SSH_KNOWN_HOSTS` | secret   | `ssh-keyscan` output, pinning the host key |
| `DEPLOY_HOST`             | variable | `ghsci.hpc4ai.unito.it`                    |
| `DEPLOY_USER`             | variable | `ubuntu`                                   |
| `DEPLOY_PUBLIC_URL`       | variable | `https://atgreen.hpc4ai.unito.it/`         |

### One-time setup

**1. Authorise the key on the server.** The entry is already staged there:

```bash
ssh ubuntu@ghsci.hpc4ai.unito.it "cat /opt/atgreen/deploy/ci-deploy-key.pub.entry >> ~/.ssh/authorized_keys"
```

It is prefixed with `restrict,command="…receive-release.sh"`, so this key cannot open a
shell or run any other command — it can only feed a tarball to the receiver. The commit
SHA the workflow passes arrives as `SSH_ORIGINAL_COMMAND`, never as a shell command.

**2. Add the secrets and variables, scoped to the environment.** From a checkout, with
the private key file:

```bash
gh secret set ATGREEN_DEPLOY_KEY --env production < /path/to/atgreen_deploy
ssh-keyscan -t ed25519 ghsci.hpc4ai.unito.it | gh secret set ATGREEN_SSH_KNOWN_HOSTS --env production
gh variable set DEPLOY_HOST --env production --body "ghsci.hpc4ai.unito.it"
gh variable set DEPLOY_USER --env production --body "ubuntu"
gh variable set DEPLOY_PUBLIC_URL --env production --body "https://atgreen.hpc4ai.unito.it/"
```

Pinning the host key matters: without it the workflow would accept whatever host answers.

**3. Restrict the environment to `main`.** Without this, any branch that ran a job
declaring `environment: production` could read the deploy key:

```bash
gh api -X PUT repos/rschifan/atgreen/environments/production \
  -F 'deployment_branch_policy[protected_branches]=true' \
  -F 'deployment_branch_policy[custom_branch_policies]=false'
```

Until all of this exists, the deploy job fails fast with a message naming exactly what is
missing. `build-and-test` is unaffected, so pull requests still merge.

### What deliberately is not here

**Build provenance attestation** (`actions/attest-build-provenance`) is standard for a
public repo that _publishes_ artifacts. This tarball goes to one server over SSH and is
never consumed by anyone else, so the attestation would buy nothing and costs the build
job `id-token: write`. Revisit if releases are ever published.

**The server-side scripts** — `receive-release.sh`, `atgreen-monitor.sh`, the nginx
configuration and the systemd units — are not in this repository and should not be.
They encode the host's layout and its trust boundaries; a public repo is the wrong place
for them. They belong in a private repo with its own history, and this file should be the
only place the two halves are described together.

## The manual path

Still works, and is the fallback if Actions is unavailable:

```bash
npm run build
rsync -az build/ ubuntu@ghsci.hpc4ai.unito.it:/opt/atgreen/current/build/
ssh ubuntu@ghsci.hpc4ai.unito.it "sudo systemctl restart atgreen-web.service"
```

Note this writes _into the current release_, which breaks immutability — acceptable for an
emergency, but prefer the automated path.

## Rolling back

```bash
ssh ubuntu@ghsci.hpc4ai.unito.it
ls -1dt /opt/atgreen/releases/*/          # newest first
sudo -u ubuntu ln -sfn /opt/atgreen/releases/<previous> /opt/atgreen/current.tmp
sudo -u ubuntu mv -Tf /opt/atgreen/current.tmp /opt/atgreen/current
sudo systemctl restart atgreen-web.service
/opt/atgreen/deploy/atgreen-monitor.sh    # confirm
```

## Monitoring

`atgreen-monitor.timer` probes the public URL every 10 minutes and logs to the journal
under the tag `atgreen-monitor`:

```bash
journalctl -t atgreen-monitor -n 20
systemctl list-timers atgreen-monitor.timer
```

It asserts more than HTTP 200, because 200 is what this site returned through both of its
real incidents: that every hashed asset resolves, that no stylesheet comes from an unpinned
CDN, that `/rpc/` responses are gzipped, that `getindexes` returns at least 8 indexes, that a
real Turin query returns thousands of features, and that TLS has more than 10 days left.
