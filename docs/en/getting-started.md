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

## Component configuration

### business-api

Documented when the service is added.

### auth-api

Documented when the service is added.

### web

Documented when the application is added.

## Documentation

Serve the documentation locally:

```bash
pip install -r requirements-docs.txt
mkdocs serve
```
