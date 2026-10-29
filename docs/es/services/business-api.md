# business-api

El servicio de negocio de Motorix: clientes, motores, órdenes de reparación y el historial de estados de cada orden. Nunca guarda contraseñas ni tiene login propio: solo confía en los JWT firmados por [auth-api](auth-api.md), que verifica localmente con la clave pública.

## Stack

| Aspecto | Elección |
| --- | --- |
| Framework | FastAPI, servido por uvicorn |
| Datos | SQLAlchemy 2.0 async con asyncpg, PostgreSQL `business_db` |
| Migraciones | Alembic |
| Validación | Esquemas de Pydantic v2 |
| Tokens | PyJWT, RS256 solo con la clave pública |
| Calidad | pytest con httpx, flake8 |

## Estructura

```
services/business-api/app/
├── api/            routers de /api/v1 y sus dependencias (sesión, llamante, permisos)
├── core/           configuración, logging, errores, verificación del JWT, rate limit
├── db/             engine, sesión y modelo base
├── models/         modelos de SQLAlchemy
├── schemas/        esquemas de petición y respuesta
├── repositories/   acceso a datos, uno por modelo, sobre un BaseRepository genérico
└── services/       reglas de negocio
```

Las peticiones van `router → service → repository`. Los routers nunca tocan la base, y cada petición es una unidad de trabajo que se confirma antes de enviar la respuesta.

## Endpoints

Todos viven bajo `/api/v1` y exigen un token Bearer válido, salvo `/health`.

### Clientes

| Método y ruta | Permiso | Para qué |
| --- | --- | --- |
| `POST /clients` | `clients:write` | Registrar un cliente; `409` si su identificación ya existe |
| `GET /clients` | `clients:read` | Listar con `limit`, `offset`, `search` (nombre o identificación) e `is_active` |
| `GET /clients/{id}` | `clients:read` | Leer un cliente |
| `PUT /clients/{id}` | `clients:write` | Reemplazar sus campos; `is_active: true` lo reactiva y omitirlo conserva el estado |
| `DELETE /clients/{id}` | `clients:write` | Desactivarlo; la fila y su historial se conservan |

### Motores

| Método y ruta | Permiso | Para qué |
| --- | --- | --- |
| `POST /engines` | `engines:write` | Registrar un motor de un cliente existente; `409` si su serie ya existe |
| `GET /engines` | `engines:read` | Listar con `limit`, `offset`, `search` (serie, fabricante o modelo), `client_id` e `is_active`; cada motor trae a su dueño |
| `GET /engines/{id}` | `engines:read` | Leer un motor con su dueño |
| `PUT /engines/{id}` | `engines:write` | Reemplazar sus campos, dueño incluido; `is_active: true` lo reactiva |
| `DELETE /engines/{id}` | `engines:write` | Desactivarlo; sus órdenes se conservan |

### Órdenes de reparación

| Método y ruta | Permiso | Para qué |
| --- | --- | --- |
| `POST /repair-orders` | `repair_orders:write` | Abrir una orden de un motor; su cliente sale del motor |
| `GET /repair-orders` | `repair_orders:read` | Listar de la más nueva a la más antigua con `limit` y `cursor`, filtrando por `status`, `client_id`, `engine_id` y `search` |
| `GET /repair-orders/summary` | `repair_orders:read` | Cantidad de órdenes en cada estado, para el tablero |
| `GET /repair-orders/{id}` | `repair_orders:read` | Leer una orden con todo su historial de estados |
| `PATCH /repair-orders/{id}/status` | `repair_orders:write` | Mover la orden a otro estado con una nota opcional |

### Otros

| Método y ruta | Acceso | Para qué |
| --- | --- | --- |
| `GET /me` | Cualquier token válido | Lo que dice el token del llamante: identidad, rol y permisos |
| `GET /health` | Público | Estado del servicio y de su base |

## Reglas de negocio

- Un cliente es único por tipo y número de identificación; un motor, por número de serie.
- Clientes y motores se desactivan, nunca se borran, así el historial de órdenes queda completo.
- El cliente de una orden se toma del motor al abrirla y se guarda en la orden, así los cambios posteriores de dueño nunca reescriben órdenes pasadas.
- Las órdenes reciben un número `RO-<año>-<8 caracteres hexadecimales>`, único sin secuencia de base de datos.
- Cualquier estado puede seguir a cualquier otro, porque una reparación puede volver atrás; cada cambio queda en el historial con la nota, quién lo hizo y cuándo.

## Configuración

Las variables están en [Primeros pasos](../getting-started.md#business-api). Las que cambian entre entornos:

| Variable | Local | Producción |
| --- | --- | --- |
| `ENVIRONMENT` | `local` | `production` |
| `DOCS_ENABLED` | `true` | `false` |
| `CORS_ORIGINS` | `http://localhost:5173` | la URL pública |
| `FORWARDED_ALLOW_IPS` | `127.0.0.1` | `*`, porque el puerto solo escucha en `127.0.0.1` detrás de nginx |
| `JWT_PUBLIC_KEY_PATH` | `../../secrets/jwt/public.pem` | `/run/secrets/jwt/public.pem`, montada en solo lectura |

## Ejecutar y probar

```bash
cd services/business-api
python -m app
pytest
flake8 app tests
```

En el contenedor, `alembic upgrade head` corre antes de arrancar el servidor.
