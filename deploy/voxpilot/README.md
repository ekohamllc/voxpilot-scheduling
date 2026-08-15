# VoxPilot Scheduling

This directory is the reproducible VoxPilot product layer on top of the
MIT-licensed Cal.diy source in this repository.

The image is pinned to the exact upstream digest currently used by the live
service. Brand files are approved VoxPilot Cutline Signal artwork. Runtime
credentials and customer data remain outside Git.

Build from the repository root:

```sh
docker build --platform linux/amd64 -f deploy/voxpilot/Dockerfile \
  -t voxpilot-scheduling:2026.08.12-source.1 \
  deploy/voxpilot
```

The baseline supports appointment and consultation scheduling, availability
controls, confirmation email, and calendar invites. Restaurant work starts as
a request-and-confirmation workflow; table inventory, floor plans, and
waitlists are separate modules, not capabilities claimed by this baseline.

The upstream MIT license in the repository root remains authoritative. Keep
the `upstream` Git remote connected to `https://github.com/calcom/cal.diy`
so security and maintenance changes can be reviewed deliberately.

## Two different build paths — read this before shipping the code-level rebrand

This directory's `Dockerfile` builds `FROM
docker.io/calendso/calendso@<pinned digest>` — a prebuilt upstream image — and
overlays three brand SVGs onto the paths the *upstream* bundle already
expects (`calcom-logo-white-word.svg`, `cal-logo-word-black.svg`,
`cal-com-icon-white.svg`). It never rebuilds the Next.js app, so it is fast
and cheap, but it can only ever brand what a static file overlay can reach.

The `nathan/voxpilot-whitelabel-full-2026-08-14` branch does the code-level
white-label properly: default `APP_NAME`/`COMPANY_NAME`/`SUPPORT_MAIL_ADDRESS`
strings, default brand color, the `LOGO`/`LOGO_DARK`/`LOGO_ICON` constants,
every favicon/manifest/app-icon file, login/signup copy, the sidebar "Powered
by" footer, and OG/social metadata all live in `packages/lib/constants.ts`,
`apps/web/public/`, and the touched components — see the branch's
`nathan/voxpilot-scheduling-whitelabel-full-2026-08-14` PROGRESS notes for the
full file list. **None of that reaches a container built via this
directory's overlay-only `Dockerfile`.** The three overlaid files still work
(their filenames are unchanged upstream paths), but the app shell, auth
pages, favicons, manifest, and footer will still read "Cal.diy" until the
image is built from source.

To actually ship the code-level rebrand, build from the repository root
`Dockerfile` instead (this is documented here for reference — it has not been
run as part of this change):

```sh
# From the repo root, on the white-label branch:
docker build --platform linux/amd64 \
  --build-arg DATABASE_URL="<a reachable Postgres URL, or a placeholder if the build doesn't need to reach it>" \
  --build-arg NEXTAUTH_SECRET="<32-byte value; must match the runtime value>" \
  --build-arg CALENDSO_ENCRYPTION_KEY="<32-byte value; must match the runtime value>" \
  --build-arg NEXT_PUBLIC_WEBAPP_URL="https://<the real VoxPilot public hostname>" \
  --build-arg MAX_OLD_SPACE_SIZE=6144 \
  -f Dockerfile \
  -t voxpilot-scheduling:<version>-source.1 \
  .
```

Build-time and run-time variable requirements are documented in the repo
root `README.md` under "Configuration" → "Build-time variables" /
"Important Run-time variables" — read that table before running the build
for real, since `NEXT_PUBLIC_WEBAPP_URL` must match between build and
runtime or the container does a slower find/replace pass on first boot.
`NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_COMPANY_NAME`,
`NEXT_PUBLIC_SUPPORT_MAIL_ADDRESS`, and `EMAIL_FROM_NAME` are optional
build-time overrides — the source now defaults to the VoxPilot identity
even if they're left unset, unlike the pre-rebrand source where the
Cal.diy identity was the hardcoded default.

If the pull+overlay path in this directory's `Dockerfile` needs to stay as
the deploy mechanism (e.g. for build-time budget reasons), it should be
extended to overlay the additional favicon/manifest/icon files this branch
added under `apps/web/public/` — but it still cannot reach the compiled
`APP_NAME` strings, brand color, or OG image generation baked into the
Next.js bundle. Those require a source build.
