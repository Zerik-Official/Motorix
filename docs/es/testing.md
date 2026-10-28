# Pruebas y CI

Cada componente se prueba por separado, y las dos API también se prueban juntas. Cada suite corre en GitHub Actions en cada pull request y push a `dev` y `main` que toque sus archivos.

## Suites de pruebas

| Suite | Herramienta | Qué cubre | Base de datos |
| --- | --- | --- | --- |
| `business-api` | pytest + httpx | Verificación del token, permisos por endpoint, clientes, motores, órdenes de reparación con paginación por cursor e historial de estados, rate limit | SQLite en memoria, SQL real a través de los repositorios |
| `auth-api` | `bun test` + supertest | Configuración, logger, reglas de roles y permisos, emisión y verificación de JWT, Argon2id, sembrado de root, usuarios, login, roles, Turnstile, rate limit | Repositorios en memoria detrás de las mismas interfaces que Prisma |
| `web` | Vitest + Testing Library | Traducción de errores de las API, refresh compartido entre llamadas con el token solo en memoria, visibilidad por permisos, validación del login y sus mensajes accesibles, comportamiento del modal, la pista de etapas, el historial de la orden, el formulario de cambio de etapa, los formularios de clientes y motores (validación y duplicados), la columna de dueño de los motores, la paginación numerada, las clases de botón de los enlaces, la jerarquía de roles, el formulario de cuentas y la matriz de permisos | Ninguna: la sesión y las API se sustituyen en los tests |
| Extremo a extremo (`tests/e2e`) | `bun test` + `fetch` | Los dos servicios corriendo contra PostgreSQL, comunicándose solo por HTTP y el JWT | PostgreSQL real |

Ejecútalas en local:

```bash
cd services/business-api && pytest
cd services/auth-api && bun test
cd apps/web && bun run test
```

La suite extremo a extremo necesita los dos servicios corriendo. Lee sus URL y las credenciales de `root` de `AUTH_API_URL`, `BUSINESS_API_URL`, `ROOT_EMAIL` y `ROOT_PASSWORD`, que por defecto apuntan a los valores locales:

```bash
cd tests/e2e && bun test
```

Crea sus propias cuentas, cliente, motor y órdenes con un sufijo único por ejecución, así puede correr contra una base que ya está en uso.

## Escenarios extremo a extremo

1. Los dos servicios y sus bases responden `/health`.
2. Un token emitido por `auth-api` es aceptado por `business-api`, que lee la identidad y los permisos que trae.
3. Una copia de un token real firmada con otra clave, y un token real con el payload alterado, se rechazan con `401`; también una petición sin token.
4. Un `admin` registra un cliente y un motor. El operativo (`user`) puede consultarlos pero recibe `403` al registrar un cliente.
5. El operativo abre una orden de reparación, cuyo cliente sale del motor, y la lleva hasta `delivered`. El historial registra cada estado y quién lo cambió.
6. Un `admin` le revoca `repair_orders:write` a `user`: el token actual del operativo sigue sirviendo hasta que expira, y un login nuevo recibe `403`. Después se restaura el permiso.
7. Una sesión renovada con la cookie de refresco obtiene un token de acceso que `business-api` acepta; reutilizar la cookie rotada termina la sesión, y el logout también.
8. Una cuenta desactivada ya no puede iniciar sesión.

## Workflows

| Workflow | Rutas que lo disparan | Pasos |
| --- | --- | --- |
| `business-api` | `services/business-api/**` | flake8, pytest, migraciones Alembic contra PostgreSQL, arranque del servidor y comprobación de `/health` |
| `auth-api` | `services/auth-api/**` | ESLint, `tsc`, `bun test`, migraciones Prisma contra PostgreSQL, arranque del servidor, comprobación de `/health` y login como `root` |
| `web` | `apps/web/**` | ESLint, `tsc`, Vitest, build de producción con Vite y una comprobación de que el build reemplazó todos los placeholders `%VITE_*%` de `index.html` |
| `e2e` | `services/**`, `tests/e2e/**`, el script de inicialización de Postgres | Crea las dos bases con el mismo script de inicialización que Docker, verifica que el rol de cada servicio no puede abrir la base del otro, migra y arranca los dos servicios con un par de claves desechable, corre la suite extremo a extremo e imprime los logs de los servicios |
| `deploy` | Cada push a `main` | Construye y publica las tres imágenes en GHCR, las descarga en la VPS, reinicia el stack y comprueba el sitio público; ver [Despliegue](deployment.md) |
| `docs` | `docs/**`, `mkdocs.yml` | `mkdocs build --strict`, y despliegue en GitHub Pages en `main` |

No se guarda ningún secreto para CI: cada ejecución genera su propio par de claves RS256.
