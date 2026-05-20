#!/usr/bin/env bash
# install-forge.sh — one-shot deploy of the RAH FastAPI backend onto FORGE.
#
# Idempotent. Run via:
#   ssh forge "bash -s" < backend/deploy/install-forge.sh
# or copy this dir to FORGE and run it locally.
#
# What it does:
#   1. Creates /home/forge/services/rah-midland-api/ (the deploy target).
#   2. Rsyncs the `backend/` tree into it (caller is expected to push first,
#      or the script will pull from the GitHub repo if RAH_FROM_GITHUB=1).
#   3. Creates a venv + installs requirements.txt.
#   4. Drops .env from .env.example if missing (caller still has to fill it).
#   5. Installs the systemd unit + enables + starts the service.
#
# After install, the service listens on 127.0.0.1:8001. Routing comes from
# the cloudflared `echo-omega-bridge` tunnel (public hostname api.rah-midland.com).

set -euo pipefail

TARGET=/home/forge/services/rah-midland-api
SRV=rah-midland-api
PORT="${RAH_PORT:-8001}"

echo "[1/6] Ensuring target dir $TARGET ..."
sudo mkdir -p "$TARGET"
sudo chown -R forge:forge /home/forge/services

# If we're running on FORGE with the source already mounted, no-op.
# If RAH_FROM_GITHUB=1, do a fresh clone (use the org repo).
if [ "${RAH_FROM_GITHUB:-0}" = "1" ]; then
  echo "[2/6] Cloning fresh from GitHub ..."
  rm -rf "$TARGET/.checkout"
  git clone --depth 1 \
    "https://github.com/ECHO-OMEGA-PRIME/right-at-home-bnb-1.git" \
    "$TARGET/.checkout"
  rsync -a --delete "$TARGET/.checkout/backend/" "$TARGET/"
  rm -rf "$TARGET/.checkout"
else
  echo "[2/6] Skipping clone (RAH_FROM_GITHUB!=1; assuming source already in place)."
fi

echo "[3/6] Setting up Python venv ..."
if [ ! -d "$TARGET/.venv" ]; then
  python3 -m venv "$TARGET/.venv"
fi
"$TARGET/.venv/bin/pip" install --upgrade pip wheel >/dev/null
"$TARGET/.venv/bin/pip" install -r "$TARGET/requirements.txt"

echo "[4/6] Ensuring .env exists ..."
if [ ! -f "$TARGET/.env" ]; then
  if [ -f "$TARGET/.env.example" ]; then
    cp "$TARGET/.env.example" "$TARGET/.env"
    echo "    Created $TARGET/.env from .env.example — FILL IN SECRETS BEFORE STARTING."
  else
    touch "$TARGET/.env"
    echo "    Created empty $TARGET/.env"
  fi
fi

echo "[5/6] Installing systemd unit ..."
sudo install -m 0644 "$TARGET/deploy/forge-systemd.service" "/etc/systemd/system/${SRV}.service"
sudo systemctl daemon-reload

echo "[6/6] Enabling + (re)starting service ..."
sudo systemctl enable "$SRV"
sudo systemctl restart "$SRV"
sleep 2
sudo systemctl --no-pager --full status "$SRV" | head -20

echo
echo "Done. Smoke-test with:"
echo "  curl -sS http://127.0.0.1:${PORT}/ | head"
echo "Public (after tunnel hostname configured):"
echo "  curl -sS https://api.rah-midland.com/"
