<h1 align="center">
  Motorix
</h1>

<p align="center">
  <img src="https://img.shields.io/badge/Python-111111?style=for-the-badge&logo=python">
  <img src="https://img.shields.io/badge/FastAPI-111111?style=for-the-badge&logo=fastapi">
  <img src="https://img.shields.io/badge/Express-111111?style=for-the-badge&logo=express&logoColor=white">
  <img src="https://img.shields.io/badge/TypeScript-111111?style=for-the-badge&logo=typescript">
  <img src="https://img.shields.io/badge/Bun-111111?style=for-the-badge&logo=bun">
  <img src="https://img.shields.io/badge/Prisma-111111?style=for-the-badge&logo=prisma">
  <img src="https://img.shields.io/badge/PostgreSQL-111111?style=for-the-badge&logo=postgresql">
  <img src="https://img.shields.io/badge/React-111111?style=for-the-badge&logo=react">
  <img src="https://img.shields.io/badge/JWT_RS256-111111?style=for-the-badge&logo=jsonwebtokens&logoColor=white">
  <img src="https://img.shields.io/badge/Docker-111111?style=for-the-badge&logo=docker">
  <img src="https://img.shields.io/badge/GitHub_Actions-111111?style=for-the-badge&logo=githubactions">
</p>

<p align="center">
  <img src=".github/preview.es.png" alt="Vista previa de Motorix"/>
</p>

<p align="center">
  <strong>Español</strong> | <a href="./README.md">English</a>
</p>

Motorix es una plataforma interna para un taller de reparación de motores de minería pesada. Permite hacer seguimiento de clientes, motores y órdenes de reparación en cada etapa del proceso, construida como una arquitectura de microservicios con dos API independientes, un frontend web y control de acceso por roles protegido con JWT firmados con RS256.

## Stack tecnológico

| Componente | Stack | Responsabilidad |
| --- | --- | --- |
| `apps/web` | React, TypeScript, Vite, Tailwind CSS, React Router, Axios, Bun | Interfaz de usuario |
| `services/auth-api` | Express 5, TypeScript, Prisma, zod, jose, Bun (runtime y Argon2id), Cloudflare Turnstile | Usuarios, roles (`root`, `admin`, `user`), permisos, inicio de sesión y emisión de JWT (RS256) |
| `services/business-api` | FastAPI, Python, SQLAlchemy, Alembic, Uvicorn | Clientes, motores, órdenes de reparación e historial de estados |
| `postgres` | PostgreSQL 17 | Una instancia, una base de datos aislada por servicio |
| Entrega | Docker Compose, Nginx, GitHub Actions, MkDocs Material | Stack local, proxy inverso, CI y documentación |

La API de autenticación firma los tokens con una clave privada RSA. La API de negocio solo tiene la clave pública y verifica firma, expiración, emisor y audiencia en cada petición protegida. Ningún servicio puede leer la base de datos del otro.

Consulta la [documentación técnica](docs/README.md) para más detalles.

## Estructura del repositorio

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
│   └── scripts/               # Init de Postgres y generación de claves
├── docs/
│   ├── en/                    # Documentación en inglés
│   └── es/                    # Documentación en español
├── .github/workflows/         # Un workflow de CI por componente
├── compose.yaml
├── mkdocs.yml
└── .env.example
```

## Requisitos

- Docker Engine con el plugin de Compose, o PostgreSQL instalado de forma nativa (ver [Sin Docker](docs/es/getting-started.md#sin-docker))
- OpenSSL (para generar el par de claves JWT)
- Python 3.12+ y Bun 1.1+ para desarrollo local sin contenedores

## Puesta en marcha

La [guía de primeros pasos](docs/es/getting-started.md) explica cómo instalar Bun y Docker (incluido Windows sin Docker Desktop) y describe cada variable de entorno. Inicio rápido:

1. Copia las plantillas de entorno y define valores reales:

   ```bash
   cp .env.example .env
   ```

   Cada componente tiene además su propio `.env.example` dentro de su carpeta.

2. Genera el par de claves RS256 para firmar y verificar los JWT:

   ```bash
   sh infrastructure/scripts/generate-jwt-keys.sh
   ```

   En Windows PowerShell, usa `infrastructure\scripts\generate-jwt-keys.ps1` en su lugar. Las claves se escriben en `secrets/jwt/`, que Git ignora.

3. Levanta el stack:

   ```bash
   docker compose up -d
   ```

   Sin Docker, crea las bases en un PostgreSQL nativo como se describe en [Sin Docker](docs/es/getting-started.md#sin-docker).

## Documentación

La documentación se construye con MkDocs Material en inglés y español, y se publica en <https://zerik-official.github.io/Motorix/docs/>. Para servirla en local:

```bash
pip install -r requirements-docs.txt
mkdocs serve
```