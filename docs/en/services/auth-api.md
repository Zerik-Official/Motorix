# auth-api

The identity service of Motorix: accounts, login, sessions, roles and the permissions of each role. It is the only component that stores passwords and the only one that signs JWTs, with an RSA private key that never leaves it.

## Stack

| Concern | Choice |
| --- | --- |
| Runtime and framework | Bun, Express 5, TypeScript |
| Data | Prisma 7 with the `pg` adapter, PostgreSQL `auth_db` |
| Validation | zod schemas, also used to generate the OpenAPI document |
| Tokens | `jose`, RS256 |
| Passwords | Argon2id through `Bun.password` |
| Hardening | helmet, cors, Cloudflare Turnstile, rate limits |
| Quality | `bun test` with supertest, ESLint, `tsc` |

## Structure

```
services/auth-api/src/
├── routes/         routers of /api/v1, /health and the API documentation
├── controllers/    HTTP handlers
├── services/       business rules: accounts, sessions, permissions, root seeding
├── repositories/   data access through Prisma
├── schemas/        zod schemas of requests and responses
├── middleware/     authentication, permissions, rate limits
├── core/           settings, logging, errors, JWT, Turnstile, password hashing
└── docs/           OpenAPI document built from the schemas
```

Requests go `route → controller → service → repository`. The tests replace the Prisma repositories with in-memory ones that implement the same interfaces.

## Endpoints

All of them live under `/api/v1`, except `/health` and the API documentation.

### Session

| Method and path | Access | Purpose |
| --- | --- | --- |
| `POST /auth/login` | Public, Turnstile, login rate limit | Check the email and password; answer the access token and set the refresh cookie |
| `POST /auth/refresh` | Refresh cookie | Rotate the refresh token and answer a new access token |
| `POST /auth/logout` | Refresh cookie | End the session and clear the cookie |

### Own account

| Method and path | Access | Purpose |
| --- | --- | --- |
| `GET /users/me` | Any valid token | The caller's account with the permissions its role holds right now |
| `PUT /users/me/password` | Any valid token | Change the own password after checking the current one; ends every session of the account |

### Accounts

| Method and path | Permission | Purpose |
| --- | --- | --- |
| `GET /users` | `users:manage` | List with `limit`, `offset`, `search` (name or email), `role` and `is_active` |
| `POST /users` | `users:manage` | Create an account of a role below the caller's |
| `GET /users/{id}` | `users:manage`, or the caller itself | Read one account |
| `PUT /users/{id}` | `users:manage` | Replace its fields; `is_active` deactivates or reactivates it, and `password` resets it |
| `DELETE /users/{id}` | `users:manage` | Deactivate it and end its sessions |

### Roles

| Method and path | Permission | Purpose |
| --- | --- | --- |
| `GET /roles` | `permissions:manage` | The catalog and the permissions of every role, with whether the caller may change them |
| `PUT /roles/{role}/permissions/{permission}` | `permissions:manage` | Grant a permission to a lower role |
| `DELETE /roles/{role}/permissions/{permission}` | `permissions:manage` | Revoke it |

### Other

| Method and path | Access | Purpose |
| --- | --- | --- |
| `GET /health` | Public | Status of the service and its database |

## Rules

- `root` > `admin` > `user`. An account only manages accounts of a lower role, and only gives roles lower than its own.
- There is one `root`, created from `ROOT_*` on the first start only; it changes its own password with `PUT /users/me/password`, and nobody can edit or deactivate it.
- Permissions belong to roles, not to accounts. A role is only changed by a higher one, and only with permissions the caller holds; `root` always holds the whole catalog.
- `auth-api` reads the caller and the permissions of its role from the database on every request, so a deactivation or a permission change applies at once here; `business-api` sees it when the access token is renewed.

Details of tokens, sessions and permissions are in [Security](../security.md).

## Configuration

The variables are listed in [Getting started](../getting-started.md#auth-api). The ones that change between environments:

| Variable | Local | Production |
| --- | --- | --- |
| `ENVIRONMENT` | `local` | `production`, which requires `TURNSTILE_SECRET_KEY` and `REFRESH_COOKIE_SECURE=true` |
| `DOCS_ENABLED` | `true` | `false` |
| `TRUST_PROXY` | `0` | `1`, nginx in front |
| `CORS_ORIGINS` | `http://localhost:5173` | the public URL |
| `JWT_PRIVATE_KEY_PATH` | `../../secrets/jwt/private.pem` | `/run/secrets/jwt/private.pem`, mounted read only |

## Run and test

```bash
cd services/auth-api
bun install
bun run db:migrate
bun run dev
bun test
```

In the container, `prisma migrate deploy` runs before the server starts.
