# Primeros pasos

Esta guía instala todas las herramientas que necesita Motorix, configura el entorno y levanta el stack.

## Requisitos previos

| Herramienta | Versión | Usada por |
| --- | --- | --- |
| Docker Engine + plugin de Compose | 24+ | Stack local (`compose.yaml`) |
| Bun | 1.1+ | `services/auth-api`, `apps/web` |
| Python | 3.12+ | `services/business-api`, documentación |
| OpenSSL | 3+ | Generación del par de claves JWT |
| Git | 2.40+ | Control de versiones |

## Instalar Bun

Si `bun` no está instalado, ejecuta el instalador oficial:

```bash
curl -fsSL https://bun.sh/install | bash
```

Recarga la configuración de tu shell y verifica la instalación:

```bash
source ~/.bashrc
bun --version
```

Si usas Zsh, ejecuta `source ~/.zshrc` en su lugar. Si el comando sigue sin encontrarse, añade el directorio de binarios de Bun a tu `PATH`:

```bash
echo 'export BUN_INSTALL="$HOME/.bun"' >> ~/.bashrc
echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

En Windows, usa PowerShell:

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

También puedes instalar Bun con Homebrew (`brew install oven-sh/bun/bun`) o npm (`npm install -g bun`). Verifica con `bun --version` antes de continuar.

## Instalar Docker

### Linux

Instala Docker Engine y el plugin de Compose con el script oficial, y permite que tu usuario use Docker sin `sudo`:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
```

Cierra sesión y vuelve a entrar, luego verifica con `docker compose version`.

### macOS

Instala [Docker Desktop](https://docs.docker.com/desktop/setup/install/mac-install/) u [OrbStack](https://orbstack.dev/).

### Windows sin Docker Desktop

Docker Engine puede ejecutarse dentro de WSL2 sin Docker Desktop, con un consumo de recursos mucho menor. La distribución se puede guardar en cualquier disco, así el disco del sistema no necesita espacio libre para imágenes y volúmenes.

1. Instala Ubuntu en el disco que prefieras (por ejemplo `D:`) desde PowerShell:

   ```powershell
   wsl --install Ubuntu-24.04 --name motorix --location D:\WSL\motorix
   ```

   Crea el usuario y la contraseña de Linux cuando se soliciten.

2. Limita los recursos que puede usar WSL2 creando `%UserProfile%\.wslconfig`:

   ```ini
   [wsl2]
   memory=3GB
   processors=2
   swap=1GB
   ```

   Aplica el cambio con `wsl --shutdown`.

3. Abre la distribución e instala Docker Engine:

   ```powershell
   wsl -d motorix
   ```

   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker "$USER"
   ```

4. Cierra la terminal, abre la distribución de nuevo y verifica:

   ```bash
   docker run --rm hello-world
   docker compose version
   ```

Los discos de Windows están disponibles dentro de WSL en `/mnt`, así que el repositorio se puede usar desde `/mnt/c/...` o `/mnt/d/...`. Para un acceso a archivos más rápido, clónalo dentro del directorio home de Linux.

## Instalar Python

Instala Python 3.12 o superior desde [python.org](https://www.python.org/downloads/) o tu gestor de paquetes, y verifica con `python --version`.

## Configuración del entorno

1. Clona el repositorio y entra en él:

   ```bash
   git clone https://github.com/Zerik-Official/Motorix
   cd Motorix
   ```

2. Crea el archivo de entorno raíz que usa Docker Compose:

   ```bash
   cp .env.example .env
   ```

3. Completa las variables:

   | Variable | Requerida | Descripción |
   | --- | --- | --- |
   | `POSTGRES_USER` | Sí | Superusuario de PostgreSQL, usado solo para inicializar la instancia. |
   | `POSTGRES_PASSWORD` | Sí | Contraseña del superusuario de PostgreSQL. |
   | `POSTGRES_DB` | No | Base de mantenimiento del superusuario. Por defecto `postgres`. |
   | `POSTGRES_PORT` | No | Puerto del host enlazado a `127.0.0.1`. Por defecto `5432`. |
   | `AUTH_DB_NAME` | Sí | Base de datos de `auth-api`. |
   | `AUTH_DB_USER` | Sí | Rol usado por `auth-api`; solo puede conectarse a su propia base. |
   | `AUTH_DB_PASSWORD` | Sí | Contraseña del rol de `auth-api`. |
   | `BUSINESS_DB_NAME` | Sí | Base de datos de `business-api`. |
   | `BUSINESS_DB_USER` | Sí | Rol usado por `business-api`; solo puede conectarse a su propia base. |
   | `BUSINESS_DB_PASSWORD` | Sí | Contraseña del rol de `business-api`. |

   Cada componente tiene su propio `.env.example` dentro de su carpeta. Sus variables se describen en la sección de ese componente más abajo.

4. Genera el par de claves RS256 para firmar y verificar los JWT.

   En Linux, macOS, WSL o Git Bash:

   ```bash
   sh infrastructure/scripts/generate-jwt-keys.sh
   ```

   En Windows PowerShell (usa `openssl` del `PATH` o el incluido con Git for Windows):

   ```powershell
   powershell -ExecutionPolicy Bypass -File infrastructure\scripts\generate-jwt-keys.ps1
   ```

   Ambos scripts aceptan un directorio de salida opcional y se niegan a sobrescribir claves existentes.

   La clave privada (`secrets/jwt/private.pem`) solo la usa `auth-api`; la clave pública (`secrets/jwt/public.pem`) la usa `business-api`. Git ignora la carpeta `secrets/`.

## Levantar el stack

```bash
docker compose up -d
```

Verifica que se crearon las bases de datos de ambos servicios:

```bash
docker compose exec postgres psql -U postgres -c "\l"
```

El script de inicialización solo se ejecuta cuando el volumen de datos está vacío. Para volver a ejecutarlo, elimina el volumen con `docker compose down -v`.

## Configuración por componente

### business-api

1. Crea el entorno virtual e instala el servicio con sus herramientas de desarrollo:

   ```bash
   cd services/business-api
   python -m venv .venv
   source .venv/bin/activate
   pip install -e ".[dev]"
   ```

   En Windows PowerShell, actívalo con `.venv\Scripts\Activate.ps1`.

2. Crea el archivo de entorno y rellena las variables:

   ```bash
   cp .env.example .env
   ```

   | Variable | Obligatoria | Descripción |
   | --- | --- | --- |
   | `APP_NAME` | No | Nombre del servicio, y también de su carpeta de logs. Por defecto `business-api`. |
   | `ENVIRONMENT` | No | `local`, `test`, `staging` o `production`. Por defecto `local`. |
   | `HOST` / `PORT` | No | Dirección en la que escucha el servidor. Por defecto `0.0.0.0:8000`. |
   | `DOCS_ENABLED` | No | Expone Swagger UI (`/docs`), ReDoc (`/redoc`) y `/openapi.json`. Por defecto `true`. |
   | `CORS_ORIGINS` | No | Orígenes separados por comas que pueden llamar a la API, como la URL de la app web. |
   | `DB_HOST` / `DB_PORT` | No | Dirección de PostgreSQL. Por defecto `localhost:5432`. |
   | `DB_NAME` | Sí | Debe coincidir con `BUSINESS_DB_NAME` del `.env` raíz. |
   | `DB_USER` | Sí | Debe coincidir con `BUSINESS_DB_USER` del `.env` raíz. |
   | `DB_PASSWORD` | Sí | Debe coincidir con `BUSINESS_DB_PASSWORD` del `.env` raíz. |
   | `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` | No | Tamaño del pool de conexiones. Por defecto `5` y `10`. |
   | `DB_ECHO` | No | Imprime cada sentencia SQL. Por defecto `false`. |
   | `JWT_PUBLIC_KEY_PATH` | Una de las dos | Ruta a la clave pública RS256, relativa a la carpeta del servicio. |
   | `JWT_PUBLIC_KEY` | Una de las dos | Clave pública PEM en línea, usada en lugar de la ruta en CI y servidores; acepta `\n` como salto de línea. |
   | `JWT_ISSUER` | No | Claim `iss` esperado. Debe coincidir con el emisor de `auth-api`. |
   | `JWT_AUDIENCE` | No | Claim `aud` esperado. Debe coincidir con la audiencia de `auth-api`. |
   | `JWT_LEEWAY_SECONDS` | No | Desfase de reloj tolerado en `exp` e `iat`. Por defecto `10`. |
   | `MAX_PAGE_SIZE` | No | Límite superior del parámetro `limit`. Por defecto `100`. |
   | `LOG_LEVEL` | No | Nivel mínimo que se imprime: `DEBUG`, `INFO`, `SUCCESS`, `WARNING`, `ERROR` o `CRITICAL`. |
   | `LOG_VERBOSITY` | No | Verbosidad máxima que se imprime; `1` muestra solo las líneas más relevantes. |
   | `LOG_SUPPRESS` | No | Niveles o pares nivel/verbosidad que nunca se imprimen, como `DEBUG:3,SUCCESS`. |
   | `LOG_TO_FILE` | No | Copia los logs en `<LOG_DIR>/<APP_NAME>/<YYYY-MM>/<YYYY-MM-DD>.log`. Por defecto `true`. |
   | `LOG_DIR` | No | Carpeta de los logs, relativa a la carpeta del servicio. Por defecto `logs`. |

3. Aplica las migraciones y arranca el servidor:

   ```bash
   alembic upgrade head
   python -m app
   ```

   Compruébalo con `curl http://localhost:8000/health` y abre la referencia de la API en `http://localhost:8000/docs`.

4. Ejecuta el linter y los tests:

   ```bash
   flake8
   pytest
   ```

### auth-api

Se documenta cuando se añada el servicio.

### web

Se documenta cuando se añada la aplicación.

## Documentación

Sirve la documentación en local:

```bash
pip install -r requirements-docs.txt
mkdocs serve
```

También se publica automáticamente: el workflow `docs` la compila con `mkdocs build --strict` en cada pull request y push a `dev` y `main`, y la despliega en GitHub Pages en cada push a `main`, en <https://zerik-official.github.io/Motorix/docs/>.
