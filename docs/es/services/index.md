# Servicios

Motorix está formado por tres componentes que se construyen, prueban y despliegan por separado. Cada uno es dueño de sus datos y de su configuración, y solo se comunican por HTTP y el JWT.

| Componente | Stack | Responsabilidad | Es dueño de | Puerto (local) |
| --- | --- | --- | --- | --- |
| [auth-api](auth-api.md) | Express 5, TypeScript, Bun, Prisma | Cuentas, login, sesiones, roles y permisos, emisión del JWT | `auth_db`, clave privada RSA | `3000` |
| [business-api](business-api.md) | FastAPI, Python, SQLAlchemy, Alembic | Clientes, motores, órdenes de reparación y su historial de estados | `business_db`, clave pública RSA | `8000` |
| [web](web.md) | React 19, TypeScript, Vite, Tailwind CSS | La interfaz del taller | Ningún dato | `5173` |

Cada API sirve su referencia interactiva mientras `DOCS_ENABLED` sea `true`; ver [Documentación de la API](../api-docs.md).

## Convenciones compartidas

- **Rutas versionadas**: todos los endpoints viven bajo `/api/v1`, salvo `/health` y la documentación de la API.
- **Una sola forma de error**: las dos API responden los errores como `{"error": {"code", "message", "details"}}`, con códigos como `validation_error`, `unauthorized`, `forbidden`, `not_found`, `conflict` y `too_many_requests`.
- **Paginación**: los listados reciben `limit` y `offset`, o `limit` y `cursor` en las órdenes de reparación, y limitan `limit` a `MAX_PAGE_SIZE`.
- **Salud**: `GET /health` responde `200` cuando el servicio y su base están arriba y `503` si no; los contenedores y CI lo usan.
- **Configuración**: todo sale de variables de entorno, con un `.env.example` por componente; ver [Primeros pasos](../getting-started.md#configuracion-por-componente).
