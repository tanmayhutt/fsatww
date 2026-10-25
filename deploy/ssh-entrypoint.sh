#!/usr/bin/env bash
# Installed as /usr/local/bin/wind-desk-deploy. The deploy key in authorized_keys is pinned to this command.
set -euo pipefail
if [[ "${SSH_ORIGINAL_COMMAND:-}" =~ ^deploy\ ([0-9a-f]{40})$ ]]; then
  exec bash /usr/local/lib/wind-desk/deploy.sh "${BASH_REMATCH[1]}"
fi
echo 'Only Wind Desk deployment commands are permitted' >&2
exit 1
