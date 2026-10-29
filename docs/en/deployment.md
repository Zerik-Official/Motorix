# Deployment

Every merge to `main` deploys Motorix to a single Ubuntu VPS. GitHub Actions builds one image per component, publishes them to the GitHub Container Registry (GHCR), and tells the server to pull them and restart the stack. Each API applies its own migrations when its container starts, before it serves traffic. This page explains how it works and how to set it up from scratch.

## How it works

### Topology

```mermaid
flowchart LR
    user[Browser] -->|HTTPS| cf[Cloudflare]
    cf -->|HTTPS| nginx[nginx on the VPS]
    nginx -->|/api/v1/auth, /users, /roles| auth[auth-api 127.0.0.1:3100]
    nginx -->|other /api| business[business-api 127.0.0.1:8100]
    nginx -->|everything else| web[web 127.0.0.1:8090]
    auth --> pg[(PostgreSQL)]
    business --> pg
```

- **One origin.** The web app and both APIs answer at `https://motorix.zerikapi.site`. The browser needs no CORS, and the refresh cookie keeps its `Path=/api/v1/auth`.
- **Local only ports.** The containers publish ports on `127.0.0.1` only, and PostgreSQL publishes none. The services reach each other and the database through the Docker network of the stack.
- **Real client address.** nginx takes the address of the visitor from `CF-Connecting-IP` only when the request comes from a Cloudflare range, and forwards it as the only value of `X-Forwarded-For`. The rate limits of both APIs count real visitors, not Cloudflare.

### What happens on a merge to `main`

```mermaid
sequenceDiagram
    participant GH as GitHub Actions
    participant REG as GHCR
    participant VPS as VPS
    participant WEB as Public site
    GH->>GH: Build auth-api, business-api and web (in parallel)
    GH->>REG: Push each image tagged with the commit and latest
    GH->>VPS: docker login ghcr.io with the token of the run
    GH->>VPS: git reset to the commit, run deploy.sh
    VPS->>REG: Pull the three images of the commit
    VPS->>VPS: Start the stack and wait for every health check
    Note over VPS: auth-api runs prisma migrate deploy<br/>business-api runs alembic upgrade head
    VPS->>VPS: Remove older Motorix images
    GH->>VPS: docker logout ghcr.io
    GH->>WEB: Check /, /api/v1/users/me and /api/v1/me
```

1. **Images.** The `images` job builds the three images in parallel and pushes them as `ghcr.io/zerik-official/motorix-<component>:<commit>` and `:latest`. The web image embeds `PUBLIC_URL` and `TURNSTILE_SITE_KEY` at build time.
2. **Registry login.** The `deploy` job logs the server in to GHCR with the token of the run. The token expires with the run and is removed at the end, so no registry credential stays on the server.
3. **Deployment files.** The server moves its copy of the repository, `~/motorix`, to the exact commit. That brings `compose.yaml`, `compose.prod.yaml` and the scripts; the `.env` files and `secrets/` are ignored by Git and are never touched.
4. **Restart.** `deploy.sh` pulls the images of the commit and runs `docker compose up --wait`. Each API container first applies its pending migrations, then starts; Compose waits until every health check passes and fails the deploy if one does not within 180 seconds.
5. **Cleanup and checks.** Older Motorix images are removed, and the job checks that the site answers `200` and both APIs answer `401` without a token.

If a step fails, the job fails and the containers already running keep serving: a new container only replaces the old one once its image was pulled.

### Files

| File | Role |
| --- | --- |
| `services/auth-api/Dockerfile` | Image of `auth-api`: runs `prisma migrate deploy`, then the server, as the non root `bun` user. |
| `services/business-api/Dockerfile` | Image of `business-api`: runs `alembic upgrade head`, then the server, as a non root user. |
| `apps/web/Dockerfile`, `apps/web/nginx.conf` | Image of the web app: builds it and serves the static files, with long caching for `/assets` and every other route falling back to `index.html`. |
| `compose.yaml` | The whole stack, also runnable locally with `docker compose up -d --build`. |
| `compose.prod.yaml` | Production override: images of the commit from GHCR, production settings, ports on `127.0.0.1`, no PostgreSQL port. |
| `infrastructure/nginx/motorix.zerikapi.site.conf` | Site of the host nginx: TLS, security headers and routing to the three containers. |
| `infrastructure/nginx/cloudflare-real-ip.conf` | Cloudflare address ranges trusted for the address of the visitor. |
| `infrastructure/scripts/bootstrap-server.sh` | One time setup: writes the production `.env` files with random passwords and generates the RS256 key pair. It never overwrites an existing file. |
| `infrastructure/scripts/deploy.sh` | Pulls the images of a commit, starts the stack, waits for the health checks and removes older images. |
| `.github/workflows/deploy.yml` | The pipeline: runs on every push to `main`, or by hand from the Actions tab. |

### Where each value lives

| Value | Where | Who reads it |
| --- | --- | --- |
| Server address, user, deploy key, host key | GitHub, environment `production`, secrets | The `deploy` job, to connect over SSH |
| Public URL, Turnstile site key | GitHub, environment `production`, variables | The `images` job, embedded in the web build |
| PostgreSQL and database passwords | `~/motorix/.env` on the server | PostgreSQL and both APIs, through Compose |
| Turnstile secret key, first password of `root` | `~/motorix/services/auth-api/.env` on the server | `auth-api` |
| RS256 key pair | `~/motorix/secrets/jwt/` on the server | `auth-api` (private key), `business-api` (public key) |
| TLS certificate | `/etc/letsencrypt/` on the server, renewed by certbot | nginx |

Nothing secret is stored in the repository, and nothing on the server is stored in GitHub.

## Setting it up from scratch

Do these steps once, in order. The examples use the domain `motorix.zerikapi.site`, and a sample server `203.0.113.10` with the user `deploy`; replace both with the address and the user of your server.

### 1. Requirements on the server

- Ubuntu with Docker Engine and the Compose plugin (v2.24 or newer, for `!reset` and `!override`), Git, OpenSSL, nginx and certbot with its nginx plugin.
- A user in the `docker` group that runs the deploys (`deploy`), and SSH access with `sudo` for the nginx steps.
- Free local ports `3100`, `8100` and `8090`.

### 2. DNS record in Cloudflare

In **Cloudflare → zerikapi.site → DNS → Records**, add:

| Type | Name | Content | Proxy status | TTL |
| --- | --- | --- | --- | --- |
| `A` | `motorix` | `203.0.113.10` | **DNS only** (grey cloud) for now | Auto |

It stays DNS only until the certificate exists (step 8), because certbot has to reach the server directly.

### 3. Turnstile widget

In **Cloudflare → Turnstile → Add widget**, use the hostname `motorix.zerikapi.site` and the managed mode. Keep both keys at hand:

- The **site key** is public: it goes to GitHub (step 5).
- The **secret key** is private: it goes to the server (step 7).

### 4. Deploy key and host key

On your computer, create a key pair used only for deploys, with no passphrase so the runner can use it. On Windows PowerShell 5.1 the empty passphrase must be written as `'""'`:

```bash
ssh-keygen -t ed25519 -C motorix-deploy -f ~/.ssh/motorix_deploy -N ""
```

```powershell
ssh-keygen -t ed25519 -C motorix-deploy -f "$HOME\.ssh\motorix_deploy" -N '""'
```

Authorize the public key on the server, from an SSH session as `deploy`:

```bash
echo "<contents of motorix_deploy.pub>" >> ~/.ssh/authorized_keys
```

Check it from your computer; it must print `ok`:

```bash
ssh -i ~/.ssh/motorix_deploy deploy@203.0.113.10 "echo ok"
```

Get the host key of the server, so the runner can verify it is talking to the right machine. The `ssh-keyscan` bundled with Windows may fail with `unsupported KEX method`; use the one of Git Bash, WSL or Linux:

```bash
ssh-keyscan -t ed25519 203.0.113.10
```

Keep the line that starts with `203.0.113.10 ssh-ed25519`.

### 5. GitHub environment

In **GitHub → repository → Settings → Environments → New environment**, create `production` and add:

**Environment secrets**

| Name | Value |
| --- | --- |
| `VPS_HOST` | `203.0.113.10` |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | The whole private key file `motorix_deploy`, from `-----BEGIN OPENSSH PRIVATE KEY-----` to `-----END OPENSSH PRIVATE KEY-----` |
| `VPS_KNOWN_HOSTS` | The `ssh-keyscan` line of step 4 |

**Environment variables**

| Name | Value |
| --- | --- |
| `PUBLIC_URL` | `https://motorix.zerikapi.site` |
| `TURNSTILE_SITE_KEY` | The site key of step 3 |

`PUBLIC_URL` and `TURNSTILE_SITE_KEY` must be **variables**, not secrets: the workflow reads them as `vars.*`, and as secrets they would arrive empty.

### 6. Repository and production files on the server

As `deploy`, clone the repository and run the bootstrap with the public URL and the email of `root`:

```bash
git clone https://github.com/Zerik-Official/Motorix.git ~/motorix
cd ~/motorix
sh infrastructure/scripts/bootstrap-server.sh https://motorix.zerikapi.site root@motorix.zerikapi.site
```

It writes `.env`, `services/auth-api/.env` and `services/business-api/.env` with random passwords and mode `600`, and the RS256 key pair in `secrets/jwt/`. Running it again never overwrites them.

### 7. Turnstile secret key

Edit `~/motorix/services/auth-api/.env` and set the secret key of step 3:

```bash
nano ~/motorix/services/auth-api/.env
```

```ini
TURNSTILE_SECRET_KEY=<secret key of the widget>
```

`auth-api` refuses to start in production without it, and the deploy fails on its health check.

### 8. nginx and the certificate

With `sudo`, install the Cloudflare snippet, get the certificate while the DNS record is still DNS only, and enable the site:

```bash
sudo cp ~/motorix/infrastructure/nginx/cloudflare-real-ip.conf /etc/nginx/snippets/
sudo certbot certonly --nginx -d motorix.zerikapi.site
sudo cp ~/motorix/infrastructure/nginx/motorix.zerikapi.site.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/motorix.zerikapi.site.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Until the first deploy the site answers `502`; that is expected. certbot renews the certificate by itself.

### 9. First deploy

Merge `dev` into `main`. The `deploy` workflow starts on its own; follow it in the **Actions** tab. The first run builds without cache and takes a few minutes. When it is green, `docker compose ps` on the server shows the four containers as `healthy`.

### 10. Cloudflare proxy and TLS mode

Once the site works over HTTPS:

1. In **DNS → Records**, switch `motorix` to **Proxied** (orange cloud).
2. In **SSL/TLS → Overview**, use **Full (strict)**: Cloudflare then verifies the certificate of the server. This mode applies to the whole `zerikapi.site` zone, so check first that its other subdomains serve a valid certificate.

### 11. Password of `root`

The first password of `root` is in the server file, and is only shown there:

```bash
grep ROOT_PASSWORD ~/motorix/services/auth-api/.env
```

Sign in with it, change it with `PUT /api/v1/users/me/password`, and delete the `ROOT_PASSWORD` line: later changes to `ROOT_*` are ignored, so the file no longer needs it.

## Day to day

### Deploy again without changes

**Actions → deploy → Run workflow**, on `main`. It builds and deploys the current commit of `main`.

### Go back to an earlier version

The images of every deployed commit stay in GHCR. On the server, move the files to that commit and run the script with it:

```bash
cd ~/motorix
git fetch origin && git reset --hard <commit>
sh infrastructure/scripts/deploy.sh <commit>
```

Migrations only move forward, so going back across a migration that changed the schema needs a migration that undoes it.

### Logs and status

```bash
cd ~/motorix
docker compose -f compose.yaml -f compose.prod.yaml ps
docker compose -f compose.yaml -f compose.prod.yaml logs --tail 100 auth-api
docker compose -f compose.yaml -f compose.prod.yaml logs --tail 100 business-api
```

### Migrations

A new migration is just a new file in `services/auth-api/prisma/migrations/` or `services/business-api/migrations/versions/`. On the next deploy, the container of that service applies it before it starts. If a migration fails, the container does not become healthy, the deploy fails, and the error is in its logs.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| The deploy fails at the SSH steps with `Permission denied (publickey)` | The public key is not in `~/.ssh/authorized_keys` of `VPS_USER`, or `VPS_SSH_KEY` is not the whole private key file. |
| `Host key verification failed` | `VPS_KNOWN_HOSTS` is empty or belongs to another host key. Scan it again (step 4). |
| `auth-api` never becomes healthy | Usually `TURNSTILE_SECRET_KEY` is empty in production. Check `logs auth-api`. |
| The login rejects every attempt as not human | The site key and the secret key belong to different widgets, or the widget does not list `motorix.zerikapi.site`. |
| The site answers `502` | The containers are down or not healthy yet; check `ps` and the logs. |
| Cloudflare shows error `526` | SSL/TLS is Full (strict) and the server has no valid certificate for the hostname; repeat step 8. |
| The web app calls `localhost` | `PUBLIC_URL` is missing from the GitHub variables, or was added as a secret. Fix it and run the workflow again. |
