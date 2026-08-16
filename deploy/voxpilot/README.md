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

## Operating reality on the iMac (2026-08-16)

`booking.voxpilot.io` runs on the Debian iMac (`nathan-imac`) from the stack
at `/home/nathan/caldiy/`. That directory has a `docker-compose.yml` with two
services, `app` and `database`, and the app image there currently reads
`voxpilot-scheduling:2026.08.15-source.1` (built from main `5847814` via this
directory's source-build Dockerfile path, not the overlay one).

**That compose file is not what's actually running the containers.** The box
has no `docker compose` plugin and no standalone `docker-compose` binary
installed. `docker-compose.yml` is a reference/spec — accurate as
documentation of intent, but it is never invoked. The two live containers,
`caldiy-app-1` and `caldiy-database-1`, were started and are being kept alive
with plain `docker run --restart unless-stopped`, with the app container
shaped like this:

```sh
docker run -d \
  --name caldiy-app-1 \
  --restart unless-stopped \
  --network <compose-project network> \
  --network-alias app \
  -p 127.0.0.1:8941:3000 \
  -p 100.67.209.112:8941:3000 \
  --env-file <chmod-600 env file, deleted after start> \
  voxpilot-scheduling:2026.08.15-source.1
```

Both host bindings map to container port 3000: one on loopback
(`127.0.0.1:8941`), one on the box's Tailscale IP
(`100.67.209.112:8941`), so the app is reachable over Tailscale without being
exposed on a public interface. The container joins the compose-project
network under the alias `app`, which is how `caldiy-database-1` (and
anything else on that network) resolves it by hostname. The env file that
supplied runtime secrets (DB URL, `NEXTAUTH_SECRET`,
`CALENDSO_ENCRYPTION_KEY`, etc.) was chmod 600 and was **deleted after the
container started** — so today there is no artifact on disk that reproduces
this container's exact runtime config short of reconstructing the env file
from scratch.

The previous release is kept, stopped, as `caldiy-app-1-old-pilot` for
rollback. Rollback is **best-effort only**: the new image forward-migrated
the Postgres schema on first boot, so reverting the app container to the
`2026.08.11-pilot.1` image does not revert the schema. The old image may
fail outright against the new schema, or run but misbehave. Don't treat this
as a routine undo.

Two ways to close the gap between the compose file and reality, in order of
preference:

1. **Install the compose plugin and adopt the file.** `apt-get install
   docker-compose-plugin` (or equivalent) on the iMac, then bring the stack
   under `docker compose -f /home/nathan/caldiy/docker-compose.yml up -d`
   going forward. This is the durable fix — it makes the spec and the
   runtime the same thing again, and any future teammate (or agent) reading
   `docker-compose.yml` gets an accurate picture. Requires a bounded,
   deliberate change on the iMac itself (see
   `.agents/skills/imac-remote-access` in `nathan_os` for the access/change
   discipline that box runs under) — not something to do opportunistically
   from a scheduling-repo PR.
2. **Keep `docker run` as the mechanism, but stop hand-typing it.** Use
   `deploy/voxpilot/run-app.sh` (added alongside this README) — it
   reproduces the exact invocation above with the image tag, container name,
   host port, Tailscale IP, network, and network alias as flags, and takes
   an `--env-file` path rather than embedding any secret. Run
   `./run-app.sh --help` for the full option list and the rollback recipe
   (same caveat as above: best-effort, schema-forward-migrated). This does
   not make the compose file accurate, but it does make the next redeploy
   reproducible and reviewable instead of a one-off shell command typed at
   3am.

Either way: **keep the runtime env file** the next time this container is
started or redeployed. Deleting it after start (as happened on 2026-08-15)
means the only way to reproduce the exact running config is to reconstruct
every secret from source — store it at rest with the existing chmod 600
discipline instead of deleting it.
