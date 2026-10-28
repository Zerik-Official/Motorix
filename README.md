<h1 align="center">
  Motorix
</h1>

<p align="center">
  <img src="https://img.shields.io/badge/Python-111111?style=for-the-badge&logo=python">
  <img src="https://img.shields.io/badge/FastAPI-111111?style=for-the-badge&logo=fastapi">
  <img src="https://img.shields.io/badge/SQLAlchemy-111111?style=for-the-badge&logo=sqlalchemy">
  <img src="https://img.shields.io/badge/Express-111111?style=for-the-badge&logo=express&logoColor=white">
  <img src="https://img.shields.io/badge/TypeScript-111111?style=for-the-badge&logo=typescript">
  <img src="https://img.shields.io/badge/Bun-111111?style=for-the-badge&logo=bun">
  <img src="https://img.shields.io/badge/Prisma-111111?style=for-the-badge&logo=prisma">
  <img src="https://img.shields.io/badge/PostgreSQL-111111?style=for-the-badge&logo=postgresql">
  <img src="https://img.shields.io/badge/React-111111?style=for-the-badge&logo=react">
  <img src="https://img.shields.io/badge/Vite-111111?style=for-the-badge&logo=vite">
  <img src="https://img.shields.io/badge/Tailwind_CSS-111111?style=for-the-badge&logo=tailwindcss">
  <img src="https://img.shields.io/badge/React_Router-111111?style=for-the-badge&logo=reactrouter">
  <img src="https://img.shields.io/badge/Vitest-111111?style=for-the-badge&logo=vitest">
  <img src="https://img.shields.io/badge/JWT_RS256-111111?style=for-the-badge&logo=jsonwebtokens&logoColor=white">
  <img src="https://img.shields.io/badge/Cloudflare_Turnstile-111111?style=for-the-badge&logo=cloudflare">
  <img src="https://img.shields.io/badge/Docker-111111?style=for-the-badge&logo=docker">
  <img src="https://img.shields.io/badge/Nginx-111111?style=for-the-badge&logo=nginx">
  <img src="https://img.shields.io/badge/GitHub_Actions-111111?style=for-the-badge&logo=githubactions">
  <img src="https://img.shields.io/badge/MkDocs_Material-111111?style=for-the-badge&logo=materialformkdocs">
</p>

<p align="center">
  <img src=".github/preview.en.png" alt="Motorix preview"/>
</p>

<p align="center">
  <a href="./README.es.md">Español</a> | <strong>English</strong>
</p>

Motorix is an internal platform for a heavy mining engine repair shop. It tracks clients, engines and repair orders through every stage of the repair process, built as a microservices architecture with two independent APIs, a web frontend and role-based access secured with RS256-signed JWTs.

## Tech stack

| Component | Stack | Responsibility |
| --- | --- | --- |
| `apps/web` | React, TypeScript, Vite, Tailwind CSS, React Router, Axios, Bun | User interface |
| `services/auth-api` | Express, TypeScript, Prisma, Argon2, Bun | Users, roles (`root`, `admin`, `user`), login and JWT issuance (RS256) |
| `services/business-api` | FastAPI, Python, SQLAlchemy, Alembic, Uvicorn | Clients, engines, repair orders and status history |
| `postgres` | PostgreSQL 17 | One instance, one isolated database per service |
| Delivery | Docker Compose, Nginx, GitHub Actions, MkDocs Material | Local stack, reverse proxy, CI and documentation |

The auth API signs tokens with an RSA private key. The business API only holds the public key and verifies signature, expiration, issuer and audience on every protected request. Neither service can read the other's database.

See the [technical documentation](docs/README.md) for details.

## Repository structure

```
motorix/
├── apps/
│   └── web/                   # React + TypeScript
├── services/
│   ├── auth-api/              # Express + TypeScript
│   └── business-api/          # FastAPI + Python
├── infrastructure/
│   ├── docker/
│   ├── nginx/
│   └── scripts/               # Postgres init and key generation
├── docs/
│   ├── en/                    # English documentation
│   └── es/                    # Spanish documentation
├── .github/workflows/         # One CI workflow per component
├── compose.yaml
├── mkdocs.yml
└── .env.example
```

## Requirements

- Docker Engine with the Compose plugin
- OpenSSL (to generate the JWT key pair)
- Python 3.12+ and Bun 1.1+ for local development without containers

## Getting started

The [getting started guide](docs/en/getting-started.md) covers installing Bun and Docker (including Windows without Docker Desktop) and describes every environment variable. Quick start:

1. Copy the environment templates and set real values:

   ```bash
   cp .env.example .env
   ```

   Each component also has its own `.env.example` inside its folder.

2. Generate the RS256 key pair used to sign and verify JWTs:

   ```bash
   sh infrastructure/scripts/generate-jwt-keys.sh
   ```

   Keys are written to `secrets/jwt/`, which is ignored by Git.

3. Start the stack:

   ```bash
   docker compose up -d
   ```

## Documentation

The documentation is built with MkDocs Material in English and Spanish:

```bash
pip install -r requirements-docs.txt
mkdocs serve
```