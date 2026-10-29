# Services

Motorix is made of three components that are built, tested and deployed separately. Each one owns its data and its configuration, and they only talk through HTTP and the JWT.

| Component | Stack | Responsibility | Owns | Port (local) |
| --- | --- | --- | --- | --- |
| [auth-api](auth-api.md) | Express 5, TypeScript, Bun, Prisma | Accounts, login, sessions, roles and permissions, JWT issuing | `auth_db`, RSA private key | `3000` |
| [business-api](business-api.md) | FastAPI, Python, SQLAlchemy, Alembic | Clients, engines, repair orders and their status history | `business_db`, RSA public key | `8000` |
| [web](web.md) | React 19, TypeScript, Vite, Tailwind CSS | The interface of the workshop | No data | `5173` |

Every API serves its interactive reference while `DOCS_ENABLED` is true; see [API documentation](../api-docs.md).

## Shared conventions

- **Versioned routes**: every endpoint lives under `/api/v1`, except `/health` and the API documentation.
- **One error shape**: both APIs answer errors as `{"error": {"code", "message", "details"}}`, with codes such as `validation_error`, `unauthorized`, `forbidden`, `not_found`, `conflict` and `too_many_requests`.
- **Pagination**: listings take `limit` and `offset`, or `limit` and `cursor` for repair orders, and cap `limit` at `MAX_PAGE_SIZE`.
- **Health**: `GET /health` answers `200` when the service and its database are up and `503` otherwise; containers and CI use it.
- **Configuration**: every setting comes from environment variables, with a `.env.example` per component; see [Getting started](../getting-started.md#component-configuration).
