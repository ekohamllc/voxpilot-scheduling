#!/usr/bin/env bash
set -euo pipefail

# deploy/voxpilot/run-app.sh
#
# Reproduces the exact `docker run` invocation currently used to run the
# VoxPilot Scheduling app container on the iMac host (nathan-imac), where the
# docker-compose.yml at /home/nathan/caldiy/ is a REFERENCE/SPEC only — there
# is no `docker compose` plugin or standalone `docker-compose` binary
# installed on that box, so the app container is started and kept alive with
# plain `docker run --restart unless-stopped` instead.
#
# Documented 2026-08-16. See deploy/voxpilot/README.md → "Operating reality
# on the iMac" for the full picture, including the schema-forward-migration
# rollback caveat below.
#
# This script contains NO secrets and never prints the contents of the env
# file it reads. It only reproduces the *shape* of the running container
# (image, name, network, ports, restart policy) — actual credentials and
# config live in the env file you pass with --env-file.

usage() {
  cat <<'EOF'
Usage: run-app.sh --env-file PATH [options]

Required:
  -e, --env-file PATH        Path to the chmod-600 runtime env file. This
                              script does not create or manage that file —
                              supply the one already in use, or a new one
                              built the same way. It is never printed.

Options:
  -i, --image TAG             Image to run
                               (default: voxpilot-scheduling:2026.08.15-source.1)
  -n, --name NAME              Container name (default: caldiy-app-1)
  -p, --host-port PORT         Host port published to container port 3000,
                               used for both bindings below (default: 8941)
      --tailscale-ip IP         Tailscale IP to also publish on
                               (default: 100.67.209.112; pass an empty string
                               to skip the Tailscale binding and publish only
                               on 127.0.0.1)
      --network NAME            Docker network to attach to (default:
                               auto-detected from the most recent container
                               matching --name, running or stopped; falls
                               back to "caldiy_default" if none is found —
                               VERIFY the fallback matches the network the
                               database container is actually on before
                               relying on it)
      --network-alias NAME      Network alias to publish (default: app —
                               this is the hostname the database/other
                               services use to reach the app container)
  -h, --help                   Show this help

Example:
  ./run-app.sh \
    --image voxpilot-scheduling:2026.08.15-source.1 \
    --env-file /home/nathan/caldiy/.env.runtime

Rollback recipe (best-effort — read the caveat before using it):
  1. docker stop caldiy-app-1
  2. docker rename caldiy-app-1 caldiy-app-1-failed-$(date +%Y%m%d)
  3. docker rename caldiy-app-1-old-pilot caldiy-app-1
  4. docker start caldiy-app-1

  CAVEAT — schema forward-migration: the 2026.08.15-source.1 image
  forward-migrated the Postgres schema on first boot. Rolling the APP
  container back to the prior 2026.08.11-pilot.1 image (caldiy-app-1-old-pilot)
  does NOT roll the database schema back. The old image may fail outright
  against the new schema, or run but misbehave against columns/tables it
  doesn't expect. Treat container rollback as a last resort during an
  incident, not a routine undo — confirm DB compatibility (or restore a DB
  snapshot taken before the migration) before trusting it.
EOF
}

IMAGE_TAG="voxpilot-scheduling:2026.08.15-source.1"
CONTAINER_NAME="caldiy-app-1"
ENV_FILE=""
HOST_PORT="8941"
TAILSCALE_IP="100.67.209.112"
NETWORK_NAME=""
NETWORK_ALIAS="app"

while [ $# -gt 0 ]; do
  case "$1" in
    -i|--image) IMAGE_TAG="$2"; shift 2 ;;
    -n|--name) CONTAINER_NAME="$2"; shift 2 ;;
    -e|--env-file) ENV_FILE="$2"; shift 2 ;;
    -p|--host-port) HOST_PORT="$2"; shift 2 ;;
    --tailscale-ip) TAILSCALE_IP="$2"; shift 2 ;;
    --network) NETWORK_NAME="$2"; shift 2 ;;
    --network-alias) NETWORK_ALIAS="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

if [ -z "$ENV_FILE" ]; then
  echo "error: --env-file is required (the chmod-600 runtime env file)" >&2
  usage >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "error: env file not found: $ENV_FILE" >&2
  exit 1
fi

env_perms=$(stat -f "%Lp" "$ENV_FILE" 2>/dev/null || stat -c "%a" "$ENV_FILE" 2>/dev/null || echo "unknown")
if [ "$env_perms" != "600" ]; then
  echo "warning: $ENV_FILE is not chmod 600 (found: $env_perms)." >&2
  echo "         fix with: chmod 600 $ENV_FILE" >&2
fi

if [ -z "$NETWORK_NAME" ]; then
  # Best-effort auto-detect: reuse whatever network the most recent
  # container matching --name (running or stopped) was attached to, so a
  # redeploy naturally lands on the same network as the database container
  # without the operator having to know its name up front.
  existing_container=$(docker ps -a --filter "name=^${CONTAINER_NAME}" --format '{{.Names}}' | head -n1 || true)
  if [ -n "$existing_container" ]; then
    NETWORK_NAME=$(docker inspect "$existing_container" \
      --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null || true)
  fi
  if [ -z "$NETWORK_NAME" ]; then
    NETWORK_NAME="caldiy_default"
    echo "warning: could not auto-detect the network from an existing container;" >&2
    echo "         defaulting to '$NETWORK_NAME' — VERIFY this matches the network" >&2
    echo "         the database container is on before relying on this run." >&2
    echo "         Check with: docker inspect caldiy-database-1 --format '{{json .NetworkSettings.Networks}}'" >&2
  fi
fi

echo "Starting $CONTAINER_NAME from $IMAGE_TAG"
echo "  network:  $NETWORK_NAME (alias: $NETWORK_ALIAS)"
echo "  ports:    127.0.0.1:${HOST_PORT}->3000"
if [ -n "$TAILSCALE_IP" ]; then
  echo "            ${TAILSCALE_IP}:${HOST_PORT}->3000"
fi
echo "  env file: $ENV_FILE (contents not printed)"

PORT_ARGS=(-p "127.0.0.1:${HOST_PORT}:3000")
if [ -n "$TAILSCALE_IP" ]; then
  PORT_ARGS+=(-p "${TAILSCALE_IP}:${HOST_PORT}:3000")
fi

docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --network "$NETWORK_NAME" \
  --network-alias "$NETWORK_ALIAS" \
  "${PORT_ARGS[@]}" \
  --env-file "$ENV_FILE" \
  "$IMAGE_TAG"

echo "Started. Check health with: docker logs -f $CONTAINER_NAME"
