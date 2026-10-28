# Getting started

This guide installs every tool required by Motorix, configures the environment and starts the stack.

## Prerequisites

| Tool | Version | Used by |
| --- | --- | --- |
| Docker Engine + Compose plugin | 24+ | Local stack (`compose.yaml`) |
| Bun | 1.1+ | `services/auth-api`, `apps/web` |
| Python | 3.12+ | `services/business-api`, documentation |
| OpenSSL | 3+ | JWT key pair generation |
| Git | 2.40+ | Source control |

## Install Bun

If `bun` is not installed, run the official installer:

```bash
curl -fsSL https://bun.sh/install | bash
```

Reload your shell configuration and verify the installation:

```bash
source ~/.bashrc
bun --version
```

If you use Zsh, run `source ~/.zshrc` instead. If the command still cannot be found, add the Bun binary directory to your `PATH`:

```bash
echo 'export BUN_INSTALL="$HOME/.bun"' >> ~/.bashrc
echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

On Windows, use PowerShell:

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

You can also install Bun with Homebrew (`brew install oven-sh/bun/bun`) or npm (`npm install -g bun`). Verify with `bun --version` before continuing.

## Install Docker

### Linux

Install Docker Engine and the Compose plugin with the official script, then allow your user to run Docker without `sudo`:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
```

Log out and back in, then verify with `docker compose version`.

### macOS

Install [Docker Desktop](https://docs.docker.com/desktop/setup/install/mac-install/) or [OrbStack](https://orbstack.dev/).

### Windows without Docker Desktop

Docker Engine can run inside WSL2 without Docker Desktop, which uses far fewer resources. The distribution can be stored on any drive, so the system drive does not need free space for images and volumes.

1. Install Ubuntu on a drive of your choice (for example `D:`) from PowerShell:

   ```powershell
   wsl --install Ubuntu-24.04 --name motorix --location D:\WSL\motorix
   ```

   Create the Linux user and password when prompted.

2. Limit the resources WSL2 can use by creating `%UserProfile%\.wslconfig`:

   ```ini
   [wsl2]
   memory=3GB
   processors=2
   swap=1GB
   ```

   Apply the change with `wsl --shutdown`.

3. Open the distribution and install Docker Engine:

   ```powershell
   wsl -d motorix
   ```

   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker "$USER"
   ```

4. Close the terminal, open the distribution again and verify:

   ```bash
   docker run --rm hello-world
   docker compose version
   ```

Windows drives are available inside WSL under `/mnt`, so the repository can be used from `/mnt/c/...` or `/mnt/d/...`. For faster file access, clone it inside the Linux home directory instead.

## Install Python

Install Python 3.12 or later from [python.org](https://www.python.org/downloads/) or your package manager, and verify with `python --version`.

## Environment setup

1. Clone the repository and enter it:

   ```bash
   git clone https://github.com/Zerik-Official/Motorix
   cd Motorix
   ```

2. Create the root environment file used by Docker Compose:

   ```bash
   cp .env.example .env
   ```

3. Fill in the variables:

   | Variable | Required | Description |
   | --- | --- | --- |
   | `POSTGRES_USER` | Yes | PostgreSQL superuser, used only to initialize the instance. |
   | `POSTGRES_PASSWORD` | Yes | Password of the PostgreSQL superuser. |
   | `POSTGRES_DB` | No | Maintenance database of the superuser. Defaults to `postgres`. |
   | `POSTGRES_PORT` | No | Host port bound to `127.0.0.1`. Defaults to `5432`. |
   | `AUTH_DB_NAME` | Yes | Database owned by `auth-api`. |
   | `AUTH_DB_USER` | Yes | Role used by `auth-api`; it can only connect to its own database. |
   | `AUTH_DB_PASSWORD` | Yes | Password of the `auth-api` role. |
   | `BUSINESS_DB_NAME` | Yes | Database owned by `business-api`. |
   | `BUSINESS_DB_USER` | Yes | Role used by `business-api`; it can only connect to its own database. |
   | `BUSINESS_DB_PASSWORD` | Yes | Password of the `business-api` role. |

   Each component has its own `.env.example` inside its folder. Its variables are described in the section of that component below.

4. Generate the RS256 key pair used to sign and verify JWTs.

   On Linux, macOS, WSL or Git Bash:

   ```bash
   sh infrastructure/scripts/generate-jwt-keys.sh
   ```

   On Windows PowerShell (uses `openssl` from the `PATH` or the one bundled with Git for Windows):

   ```powershell
   powershell -ExecutionPolicy Bypass -File infrastructure\scripts\generate-jwt-keys.ps1
   ```

   Both scripts accept an optional output directory and refuse to overwrite existing keys.

   The private key (`secrets/jwt/private.pem`) is used only by `auth-api`; the public key (`secrets/jwt/public.pem`) is used by `business-api`. The `secrets/` folder is ignored by Git.

## Run the stack

```bash
docker compose up -d
```

Verify that both service databases were created:

```bash
docker compose exec postgres psql -U postgres -c "\l"
```

The initialization script only runs when the data volume is empty. To run it again, remove the volume with `docker compose down -v`.

### Without Docker

With a native PostgreSQL install, create both databases and their roles as a superuser, with the values of the root `.env`:

```bash
psql -U postgres -h localhost -v ON_ERROR_STOP=1 \
  -c "CREATE ROLE auth_service LOGIN PASSWORD 'change-me-auth';" \
  -c "CREATE DATABASE auth_db OWNER auth_service;" \
  -c "REVOKE ALL ON DATABASE auth_db FROM PUBLIC;" \
  -c "CREATE ROLE business_service LOGIN PASSWORD 'change-me-business';" \
  -c "CREATE DATABASE business_db OWNER business_service;" \
  -c "REVOKE ALL ON DATABASE business_db FROM PUBLIC;"
```

## Component configuration

### business-api

1. Create the virtual environment and install the service with its development tools:

   ```bash
   cd services/business-api
   python -m venv .venv
   source .venv/bin/activate
   pip install -e ".[dev]"
   ```

   On Windows PowerShell, activate it with `.venv\Scripts\Activate.ps1`.

2. Create the environment file and fill in the variables:

   ```bash
   cp .env.example .env
   ```

   | Variable | Required | Description |
   | --- | --- | --- |
   | `APP_NAME` | No | Service name, also the name of its log folder. Defaults to `business-api`. |
   | `ENVIRONMENT` | No | `local`, `test`, `staging` or `production`. Defaults to `local`. |
   | `HOST` / `PORT` | No | Address the server listens on. Defaults to `0.0.0.0:8000`. |
   | `DOCS_ENABLED` | No | Expose Swagger UI (`/docs`), ReDoc (`/redoc`) and `/openapi.json`. Defaults to `true`. |
   | `CORS_ORIGINS` | No | Comma separated origins allowed to call the API, such as the web app URL. |
   | `DB_HOST` / `DB_PORT` | No | PostgreSQL address. Defaults to `localhost:5432`. |
   | `DB_NAME` | Yes | Must match `BUSINESS_DB_NAME` of the root `.env`. |
   | `DB_USER` | Yes | Must match `BUSINESS_DB_USER` of the root `.env`. |
   | `DB_PASSWORD` | Yes | Must match `BUSINESS_DB_PASSWORD` of the root `.env`. |
   | `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` | No | Connection pool size. Defaults to `5` and `10`. |
   | `DB_ECHO` | No | Print every SQL statement. Defaults to `false`. |
   | `JWT_PUBLIC_KEY_PATH` | One of both | Path to the RS256 public key, relative to the service folder. |
   | `JWT_PUBLIC_KEY` | One of both | Inline PEM public key, used instead of the path in CI and servers; `\n` is accepted for line breaks. |
   | `JWT_ISSUER` | No | Expected `iss` claim. Must match the issuer of `auth-api`. |
   | `JWT_AUDIENCE` | No | Expected `aud` claim. Must match the audience of `auth-api`. |
   | `JWT_LEEWAY_SECONDS` | No | Clock skew tolerated on `exp` and `iat`. Defaults to `10`. |
   | `MAX_PAGE_SIZE` | No | Upper limit of the `limit` query parameter. Defaults to `100`. |
   | `RATE_LIMIT_WINDOW_SECONDS` / `RATE_LIMIT_MAX` | No | Requests allowed per client on `/api`. Defaults to `300` per `900` seconds. |
   | `FORWARDED_ALLOW_IPS` | No | Proxies whose `X-Forwarded-For` header uvicorn trusts to find the client address. Defaults to `127.0.0.1`; set the address of Nginx when it runs elsewhere. |
   | `LOG_LEVEL` | No | Minimum level printed: `DEBUG`, `INFO`, `SUCCESS`, `WARNING`, `ERROR` or `CRITICAL`. |
   | `LOG_VERBOSITY` | No | Highest verbosity printed; `1` shows only the most relevant lines. |
   | `LOG_SUPPRESS` | No | Levels or level/verbosity pairs never printed, such as `DEBUG:3,SUCCESS`. |
   | `LOG_TO_FILE` | No | Copy logs to `<LOG_DIR>/<APP_NAME>/<YYYY-MM>/<YYYY-MM-DD>.log`. Defaults to `true`. |
   | `LOG_DIR` | No | Folder of the log files, relative to the service folder. Defaults to `logs`. |

3. Apply the migrations and start the server:

   ```bash
   alembic upgrade head
   python -m app
   ```

   Check it with `curl http://localhost:8000/health` and open the API reference at `http://localhost:8000/docs`.

4. Run the linter and the tests:

   ```bash
   flake8
   pytest
   ```

### auth-api

The service runs on the Bun runtime, which also hashes passwords with its built-in Argon2id.

1. Install the dependencies; this also generates the Prisma client:

   ```bash
   cd services/auth-api
   bun install
   ```

2. Create the environment file and fill in the variables:

   ```bash
   cp .env.example .env
   ```

   | Variable | Required | Description |
   | --- | --- | --- |
   | `APP_NAME` | No | Service name, also the name of its log folder. Defaults to `auth-api`. |
   | `ENVIRONMENT` | No | `local`, `test`, `staging` or `production`. Defaults to `local`. |
   | `HOST` / `PORT` | No | Address the server listens on. Defaults to `0.0.0.0:3000`. |
   | `CORS_ORIGINS` | No | Comma separated origins allowed to call the API, such as the web app URL. |
   | `DB_HOST` / `DB_PORT` | No | PostgreSQL address. Defaults to `localhost:5432`. |
   | `DB_NAME` | Yes | Must match `AUTH_DB_NAME` of the root `.env`. |
   | `DB_USER` | Yes | Must match `AUTH_DB_USER` of the root `.env`. |
   | `DB_PASSWORD` | Yes | Must match `AUTH_DB_PASSWORD` of the root `.env`. |
   | `DB_POOL_SIZE` | No | Connection pool size. Defaults to `5`. |
   | `JWT_PRIVATE_KEY_PATH` | One of both | Path to the RS256 private key, relative to the service folder. |
   | `JWT_PRIVATE_KEY` | One of both | Inline PEM private key (PKCS#8), used instead of the path in CI and servers; `\n` is accepted for line breaks. |
   | `JWT_ISSUER` | No | `iss` claim of every token. Must match `JWT_ISSUER` of `business-api`. |
   | `JWT_AUDIENCE` | No | `aud` claim of every token. Must match `JWT_AUDIENCE` of `business-api`. |
   | `JWT_EXPIRES_IN_SECONDS` | No | Access token lifetime. Defaults to `900` (15 minutes). |
   | `REFRESH_TOKEN_TTL_SECONDS` | No | Absolute lifetime of a session, from the login. Defaults to `43200` (12 hours). |
   | `REFRESH_COOKIE_SECURE` | No | Send the refresh cookie only over HTTPS. Defaults to `true` and must stay `true` in `production`; browsers accept it on `http://localhost`. |
   | `MAX_PAGE_SIZE` | No | Upper limit of the `limit` query parameter. Defaults to `100`. |
   | `TRUST_PROXY` | No | Number of reverse proxies in front of the service, used to read the client address from `X-Forwarded-For`. Defaults to `0`; set `1` behind Nginx. |
   | `DOCS_ENABLED` | No | Expose Swagger UI (`/docs`) and `/openapi.json`. Defaults to `true`. |
   | `TURNSTILE_SECRET_KEY` | In production | Cloudflare Turnstile secret key. Empty disables the check outside `production`; `1x0000000000000000000000000000000AA` always passes and `2x0000000000000000000000000000000AA` always fails. |
   | `TURNSTILE_VERIFY_URL` | No | Turnstile validation endpoint. Defaults to Cloudflare's `siteverify`. |
   | `RATE_LIMIT_WINDOW_SECONDS` / `RATE_LIMIT_MAX` | No | Requests allowed per client on `/api`. Defaults to `300` per `900` seconds. |
   | `LOGIN_RATE_LIMIT_WINDOW_SECONDS` / `LOGIN_RATE_LIMIT_MAX` | No | Failed logins allowed per client. Defaults to `10` per `900` seconds. |
   | `ROOT_EMAIL` | Yes | Email of the single `root` account. |
   | `ROOT_PASSWORD` | Yes | Password of `root`, at least 12 characters. |
   | `ROOT_FULL_NAME` | No | Display name of `root`. Defaults to `Root`. |
   | `LOG_LEVEL` | No | Minimum level printed: `DEBUG`, `INFO`, `SUCCESS`, `WARNING`, `ERROR` or `CRITICAL`. |
   | `LOG_VERBOSITY` | No | Highest verbosity printed; `1` shows only the most relevant lines and `2` adds the access log. |
   | `LOG_SUPPRESS` | No | Levels or level/verbosity pairs never printed, such as `DEBUG:3,SUCCESS`. |
   | `LOG_TO_FILE` | No | Copy logs to `<LOG_DIR>/<APP_NAME>/<YYYY-MM>/<YYYY-MM-DD>.log`. Defaults to `true`. |
   | `LOG_DIR` | No | Folder of the log files, relative to the service folder. Defaults to `logs`. |

   `root` is seeded on every start from `ROOT_*`: it is created the first time, and later changes to these variables are applied to the account. It cannot be changed through the API.

3. Apply the migrations and start the server:

   ```bash
   bun run db:migrate
   bun run dev
   ```

   Check it with `curl http://localhost:3000/health` and open the API reference at `http://localhost:3000/docs`.

4. Run the linter, the type check and the tests:

   ```bash
   bun run lint
   bun run typecheck
   bun test
   ```

### web

React 19 with TypeScript, built with Vite and styled with Tailwind CSS. It talks to `auth-api` for the session and to `business-api` for the workshop data.

1. Install the dependencies:

   ```bash
   cd apps/web
   bun install
   ```

2. Create the environment file:

   ```bash
   cp .env.example .env
   ```

   | Variable | Required | Description |
   | --- | --- | --- |
   | `VITE_AUTH_API_URL` | No | Base URL of `auth-api`. Defaults to `http://localhost:3000`. |
   | `VITE_BUSINESS_API_URL` | No | Base URL of `business-api`. Defaults to `http://localhost:8000`. |
   | `VITE_TURNSTILE_SITE_KEY` | No | Public Cloudflare Turnstile site key of the login form. Empty hides the widget; `1x00000000000000000000AA` always passes. It must pair with `TURNSTILE_SECRET_KEY` of `auth-api`. |
   | `VITE_SITE_URL` | No | Public URL of the site, used in the canonical link and the Open Graph tags. |

   These values are embedded in the build and visible to anyone, so they never hold secrets.

3. Start the development server, with both APIs running, and open `http://localhost:5173`:

   ```bash
   bun run dev
   ```

   The web origin must be listed in `CORS_ORIGINS` of both APIs. The refresh cookie is `Secure`; browsers accept it on `http://localhost`.

4. Run the linter, the type check, the tests and the production build:

   ```bash
   bun run lint
   bun run typecheck
   bun run test
   bun run build
   ```

## Documentation

Serve the documentation locally:

```bash
pip install -r requirements-docs.txt
mkdocs serve
```

It is also published automatically: the `docs` workflow builds it with `mkdocs build --strict` on every pull request and push to `dev` and `main`, and deploys it to GitHub Pages on every push to `main`, at <https://zerik-official.github.io/Motorix/docs/>.
