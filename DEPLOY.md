# Publishing the demo

The app is entirely client-side, so GitHub Pages hosts it for free. **Always publish
with `build:public`** — a plain `vite build` embeds real staff names and
`@saudigerman.com` addresses, and Pages is world-readable.

## What the public build changes

Only the people. The 69 real staff become stable pseudonyms
(`Zaid Sabbagh <zaid.sabbagh@example.invalid>`); the same person keeps the same alias
across every screen and every rebuild.

Everything that makes the demo meaningful is untouched: team names, facilities,
departments, payers, observed volumes, group structure, coverage warnings and the
allocation preview results.

## Deploy

1. Push this folder to a GitHub repo.
2. **Settings → Pages → Source: GitHub Actions.**
3. Push to `main`. `.github/workflows/pages.yml` builds and publishes.

The URL is `https://<user>.github.io/<repo>/`.

The workflow **fails the build** if `saudigerman` or `@sgh` appears anywhere in
`dist/`, so a real-name bundle cannot be published by accident.

## Build locally

```bash
cd standalone
npm run build:public                    # pseudonymized, base "/"
PAGES_REPO=<repo-name> npm run build:public   # for a Pages project subpath
npx serve dist
```

## What your team will see

The Teams list, the four-step wizard (Team Info → Groups → Capacity → Review), live
coverage checking per work item type, Auto-distribute with its rationale panel, and the
allocation preview. All of it runs in the browser against the local schema — no backend,
no API keys, nothing to configure.

**Not included:** the n8n workflow and the `/api/tool` server. Those need a running
Node process, so they stay local.
