# business-api

The business service of Motorix: clients, engines, repair orders and the status history of every order. It never stores passwords and has no login of its own: it trusts only the JWTs signed by [auth-api](auth-api.md), which it verifies locally with the public key.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | FastAPI, served by uvicorn |
| Data | SQLAlchemy 2.0 async with asyncpg, PostgreSQL `business_db` |
| Migrations | Alembic |
| Validation | Pydantic v2 schemas |
| Tokens | PyJWT, RS256 with the public key only |
| Quality | pytest with httpx, flake8 |

## Structure

```
services/business-api/app/
├── api/            routers of /api/v1 and their dependencies (session, caller, permissions)
├── core/           settings, logging, errors, JWT verification, rate limit
├── db/             engine, session and base model
├── models/         SQLAlchemy models
├── schemas/        request and response schemas
├── repositories/   data access, one per model, on a generic BaseRepository
└── services/       business rules
```

Requests go `router → service → repository`. Routers never touch the database, and each request is one unit of work, committed before the response is sent.

## Endpoints

All of them live under `/api/v1` and require a valid Bearer token, except `/health`.

### Clients

| Method and path | Permission | Purpose |
| --- | --- | --- |
| `POST /clients` | `clients:write` | Register a client; `409` when its identification is taken |
| `GET /clients` | `clients:read` | List with `limit`, `offset`, `search` (name or identification) and `is_active` |
| `GET /clients/{id}` | `clients:read` | Read one client |
| `PUT /clients/{id}` | `clients:write` | Replace its fields; `is_active: true` reactivates it, omitted keeps the state |
| `DELETE /clients/{id}` | `clients:write` | Deactivate it; the row and its history are kept |

### Engines

| Method and path | Permission | Purpose |
| --- | --- | --- |
| `POST /engines` | `engines:write` | Register an engine for an existing client; `409` when its serial is taken |
| `GET /engines` | `engines:read` | List with `limit`, `offset`, `search` (serial, manufacturer or model), `client_id` and `is_active`; each engine embeds its owner |
| `GET /engines/{id}` | `engines:read` | Read one engine with its owner |
| `PUT /engines/{id}` | `engines:write` | Replace its fields, the owner included; `is_active: true` reactivates it |
| `DELETE /engines/{id}` | `engines:write` | Deactivate it; its orders are kept |

### Repair orders

| Method and path | Permission | Purpose |
| --- | --- | --- |
| `POST /repair-orders` | `repair_orders:write` | Open an order for an engine; its client is taken from the engine |
| `GET /repair-orders` | `repair_orders:read` | List newest first with `limit` and `cursor`, filtered by `status`, `client_id`, `engine_id` and `search` |
| `GET /repair-orders/summary` | `repair_orders:read` | Number of orders in each status, for the dashboard |
| `GET /repair-orders/{id}` | `repair_orders:read` | Read one order with its full status history |
| `PATCH /repair-orders/{id}/status` | `repair_orders:write` | Move the order to another status with an optional note |

### Other

| Method and path | Access | Purpose |
| --- | --- | --- |
| `GET /me` | Any valid token | What the token says about the caller: identity, role and permissions |
| `GET /health` | Public | Status of the service and its database |

## Business rules

- A client is unique by identification type and number; an engine by serial number.
- Clients and engines are deactivated, never deleted, so the order history stays complete.
- The client of an order is taken from its engine when the order is opened and stored on the order, so later changes of owner never rewrite past orders.
- Orders get a number `RO-<year>-<8 hex characters>`, unique without a database sequence.
- Any status can follow any other, since a repair may go back a stage; every change is stored in the history with the note, who made it and when.

## Configuration

The variables are listed in [Getting started](../getting-started.md#business-api). The ones that change between environments:

| Variable | Local | Production |
| --- | --- | --- |
| `ENVIRONMENT` | `local` | `production` |
| `DOCS_ENABLED` | `true` | `false` |
| `CORS_ORIGINS` | `http://localhost:5173` | the public URL |
| `FORWARDED_ALLOW_IPS` | `127.0.0.1` | `*`, since the port only listens on `127.0.0.1` behind nginx |
| `JWT_PUBLIC_KEY_PATH` | `../../secrets/jwt/public.pem` | `/run/secrets/jwt/public.pem`, mounted read only |

## Run and test

```bash
cd services/business-api
python -m app
pytest
flake8 app tests
```

In the container, `alembic upgrade head` runs before the server starts.
