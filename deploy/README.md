# Deploying Wind Forecast Desk

Target: the shared Ubuntu box, folder `~/tanmay/wind-desk`, container bound to `127.0.0.1:5090`,
Caddy site `wind.tanmaytiwari.me`.

The server runs several other apps. Nothing here touches their folders, containers or Caddy
blocks. The only shared file edited is `/etc/caddy/Caddyfile`, by appending one `import` line
after a timestamped backup.

## How a deploy runs

Push to `main`. The **CI and deploy** workflow runs the Python tests and the Vite build, then
SSHes in with the `WIND_DESK_DEPLOY_KEY` secret (host key pinned by `WIND_DESK_KNOWN_HOSTS`). That
key is restricted in `authorized_keys` to `/usr/local/bin/wind-desk-deploy`, which accepts only
`deploy <sha>` and runs the root-owned `/usr/local/lib/wind-desk/deploy.sh`. The server checkout
fast-forwards to that commit, builds the image, swaps the container, waits for health and restores
the previous image if health fails.

`ssh-entrypoint.sh` and `server-deploy.sh` here are the sources of the two installed files.
Changing them requires reinstalling on the host:

```bash
sudo install -D -m 755 ~/tanmay/wind-desk/deploy/ssh-entrypoint.sh /usr/local/bin/wind-desk-deploy
sudo install -D -m 755 ~/tanmay/wind-desk/deploy/server-deploy.sh /usr/local/lib/wind-desk/deploy.sh
```

## First-time host setup

1. The server clones the private repo with its own read-only deploy key
   (`~/.ssh/wind-desk-github`, registered as a deploy key on the GitHub repo).
2. `git clone` into `~/tanmay/wind-desk` with `core.sshCommand` pointing at that key.
3. Install the two scripts above and add the GitHub Actions public key to `~/.ssh/authorized_keys`
   with `command="/usr/local/bin/wind-desk-deploy",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty`.
4. Caddy:

```bash
sudo cp ~/tanmay/wind-desk/deploy/wind-desk.caddy /etc/caddy/wind-desk.caddy
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak-$(date +%Y%m%d-%H%M%S)-before-wind-desk
echo 'import /etc/caddy/wind-desk.caddy' | sudo tee -a /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
```

## Rollback

`docker compose -p wind-desk down` stops only this app. Remove the import line from the Caddyfile
and reload Caddy to take the site offline.

## Vercel

The challenge brief asks for a Vercel or Heroku link. `vercel.json` and `api/index.py` at the
repo root configure that deployment: static Vite build plus one Python function for `/api/*`.
Import the repo in Vercel and deploy with defaults. The Ubuntu deployment is independent of it.
