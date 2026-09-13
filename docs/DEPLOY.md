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

`.github/workflows/deploy.yml` runs on every push to `main`: full CI gates, then it
assembles the release tarball and pipes it over SSH to `receive-release.sh`, which

1. unpacks into a new release directory,
2. **smoke-tests it on a spare port** — `/` and `/about` must both return 200,
3. repoints `current` and restarts the service,
4. verifies the public URL, **rolling back by itself** if it does not come up,
5. runs the full synthetic check,
6. prunes all but the newest 5 releases.

### One-time setup (not yet done)

The deploy key deliberately was not installed automatically — it is credential material.
Two steps:

**1. Authorise the key on the server.** The entry is already staged there:

```bash
ssh ubuntu@ghsci.hpc4ai.unito.it "cat /opt/atgreen/deploy/ci-deploy-key.pub.entry >> ~/.ssh/authorized_keys"
```

It is prefixed with `restrict,command="…receive-release.sh"`, so this key cannot open a
shell or run any other command — it can only feed a tarball to the receiver.

**2. Add the two repository secrets.** From a checkout, with the private key file:

```bash
gh secret set ATGREEN_DEPLOY_KEY < /path/to/atgreen_deploy
ssh-keyscan -t ed25519 ghsci.hpc4ai.unito.it | gh secret set ATGREEN_SSH_KNOWN_HOSTS
```

Pinning the host key matters: without it the workflow would accept whatever host answers.

Until both exist, the deploy job fails fast with a pointer to this file. CI itself is
unaffected.

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
