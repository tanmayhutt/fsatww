#!/usr/bin/env bash
# One-time host setup for Wind Forecast Desk. Run on the server as ubuntu, after the repo has been
# cloned into ~/tanmay/wind-desk. Idempotent: safe to run again.
#
#   bash ~/tanmay/wind-desk/deploy/host-setup.sh "<github actions public key>"
#
# It installs the two deploy scripts, pins the GitHub Actions key to the deploy command, adds the
# Caddy site with a single import line (after backing up the Caddyfile), and reloads Caddy. It does
# not touch any other app on this box.
set -euo pipefail
PUB=${1:?GitHub Actions public key required}
REPO=/home/ubuntu/tanmay/wind-desk

sudo install -D -m 755 "$REPO/deploy/ssh-entrypoint.sh" /usr/local/bin/wind-desk-deploy
sudo install -D -m 755 "$REPO/deploy/server-deploy.sh" /usr/local/lib/wind-desk/deploy.sh
echo "deploy scripts installed"

if ! grep -qF "$PUB" ~/.ssh/authorized_keys; then
  cp ~/.ssh/authorized_keys ~/.ssh/authorized_keys.bak-$(date +%Y%m%d-%H%M%S)-before-wind-desk
  printf 'command="/usr/local/bin/wind-desk-deploy",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty %s\n' "$PUB" >> ~/.ssh/authorized_keys
  echo "restricted deploy key added to authorized_keys"
fi

SITE=/etc/caddy/wind-desk.caddy
MAIN=/etc/caddy/Caddyfile
sudo cp "$REPO/deploy/wind-desk.caddy" "$SITE"
if ! grep -q "import /etc/caddy/wind-desk.caddy" "$MAIN"; then
  sudo cp "$MAIN" "$MAIN.bak-$(date +%Y%m%d-%H%M%S)-before-wind-desk"
  printf '\nimport /etc/caddy/wind-desk.caddy\n' | sudo tee -a "$MAIN" >/dev/null
  echo "caddy import line appended"
fi
sudo caddy validate --config "$MAIN" --adapter caddyfile
sudo systemctl reload caddy
echo "caddy reloaded"
