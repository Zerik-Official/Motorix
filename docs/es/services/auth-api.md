# auth-api

El servicio de identidad de Motorix: cuentas, login, sesiones, roles y los permisos de cada rol. Es el único componente que guarda contraseñas y el único que firma JWT, con una clave privada RSA que nunca sale de él.

## Stack

| Aspecto | Elección |
| --- | --- |
| Runtime y framework | Bun, Express 5, TypeScript |
| Datos | Prisma 7 con el adaptador de `pg`, PostgreSQL `auth_db` |
| Validación | Esquemas de zod, usados también para generar el documento OpenAPI |
| Tokens | `jose`, RS256 |
| Contraseñas | Argon2id con `Bun.password` |
| Endurecimiento | helmet, cors, Cloudflare Turnstile, rate limits |
| Calidad | `bun test` con supertest, ESLint, `tsc` |

## Estructura

```
services/auth-api/src/
├── routes/         routers de /api/v1, /health y la documentación de la API
├── controllers/    manejadores HTTP
├── services/       reglas de negocio: cuentas, sesiones, permisos, creación de root
├── repositories/   acceso a datos con Prisma
├── schemas/        esquemas de zod de peticiones y respuestas
├── middleware/     autenticación, permisos, rate limits
├── core/           configuración, logging, errores, JWT, Turnstile, hash de contraseñas
└── docs/           documento OpenAPI construido a partir de los esquemas
```

Las peticiones van `route → controller → service → repository`. Los tests reemplazan los repositorios de Prisma por unos en memoria que implementan las mismas interfaces.

## Endpoints

Todos viven bajo `/api/v1`, salvo `/health` y la documentación de la API.

### Sesión

| Método y ruta | Acceso | Para qué |
| --- | --- | --- |
| `POST /auth/login` | Público, Turnstile, rate limit de login | Comprobar correo y contraseña; responder el access token y dejar la cookie de refresh |
| `POST /auth/refresh` | Cookie de refresh | Rotar el refresh token y responder un access token nuevo |
| `POST /auth/logout` | Cookie de refresh | Terminar la sesión y borrar la cookie |

### Cuenta propia

| Método y ruta | Acceso | Para qué |
| --- | --- | --- |
| `GET /users/me` | Cualquier token válido | La cuenta del llamante con los permisos que su rol tiene ahora |
| `PUT /users/me/password` | Cualquier token válido | Cambiar la contraseña propia comprobando la actual; cierra todas las sesiones de la cuenta |

### Cuentas

| Método y ruta | Permiso | Para qué |
| --- | --- | --- |
| `GET /users` | `users:manage` | Listar con `limit`, `offset`, `search` (nombre o correo), `role` e `is_active` |
| `POST /users` | `users:manage` | Crear una cuenta de un rol inferior al del llamante |
| `GET /users/{id}` | `users:manage`, o el propio llamante | Leer una cuenta |
| `PUT /users/{id}` | `users:manage` | Reemplazar sus campos; `is_active` la desactiva o reactiva, y `password` la restablece |
| `DELETE /users/{id}` | `users:manage` | Desactivarla y cerrar sus sesiones |

### Roles

| Método y ruta | Permiso | Para qué |
| --- | --- | --- |
| `GET /roles` | `permissions:manage` | El catálogo y los permisos de cada rol, indicando si el llamante puede cambiarlos |
| `PUT /roles/{rol}/permissions/{permiso}` | `permissions:manage` | Otorgar un permiso a un rol inferior |
| `DELETE /roles/{rol}/permissions/{permiso}` | `permissions:manage` | Revocarlo |

### Otros

| Método y ruta | Acceso | Para qué |
| --- | --- | --- |
| `GET /health` | Público | Estado del servicio y de su base |

## Reglas

- `root` > `admin` > `user`. Una cuenta solo gestiona cuentas de un rol inferior, y solo asigna roles inferiores al suyo.
- Hay un único `root`, creado desde `ROOT_*` solo en el primer arranque; cambia su contraseña con `PUT /users/me/password`, y nadie puede editarlo ni desactivarlo.
- Los permisos son de los roles, no de las cuentas. Un rol solo lo cambia uno superior, y solo con permisos que el llamante tiene; `root` siempre tiene el catálogo completo.
- `auth-api` lee el llamante y los permisos de su rol desde la base en cada petición, así que una desactivación o un cambio de permisos aplica de inmediato aquí; `business-api` lo ve cuando se renueva el access token.

Los detalles de tokens, sesiones y permisos están en [Seguridad](../security.md).

## Configuración

Las variables están en [Primeros pasos](../getting-started.md#auth-api). Las que cambian entre entornos:

| Variable | Local | Producción |
| --- | --- | --- |
| `ENVIRONMENT` | `local` | `production`, que exige `TURNSTILE_SECRET_KEY` y `REFRESH_COOKIE_SECURE=true` |
| `DOCS_ENABLED` | `true` | `false` |
| `TRUST_PROXY` | `0` | `1`, nginx delante |
| `CORS_ORIGINS` | `http://localhost:5173` | la URL pública |
| `JWT_PRIVATE_KEY_PATH` | `../../secrets/jwt/private.pem` | `/run/secrets/jwt/private.pem`, montada en solo lectura |

## Ejecutar y probar

```bash
cd services/auth-api
bun install
bun run db:migrate
bun run dev
bun test
```

En el contenedor, `prisma migrate deploy` corre antes de arrancar el servidor.
