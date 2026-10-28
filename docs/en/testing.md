# Testing and CI

Every component is tested on its own, and both APIs are also tested together. Each suite runs in GitHub Actions on every pull request and push to `dev` and `main` that touches its files.

## Test suites

| Suite | Tool | What it covers | Database |
| --- | --- | --- | --- |
| `business-api` | pytest + httpx | Token verification, permissions per endpoint, clients, engines, repair orders with keyset pagination and status history, rate limit | SQLite in memory, real SQL through the repositories |
| `auth-api` | `bun test` + supertest | Settings, logger, roles and permission rules, JWT issuing and verification, Argon2id, root seeding, users, login, roles, Turnstile, rate limit | In-memory repositories behind the same interfaces as Prisma |
| `web` | Vitest + Testing Library | Translation of API errors, shared refresh across callers with the token kept only in memory, permission gating, login form validation and its accessible messages, modal dialog behavior, the stage track, the order history, the status change form, the client and engine forms (validation and duplicates), the engine owner column, the numbered pagination, the button classes of links, the role hierarchy, the account form and the permission matrix | None: the session and the APIs are replaced in the tests |
| End to end (`tests/e2e`) | `bun test` + `fetch` | Both services running against PostgreSQL, talking only through HTTP and the JWT | Real PostgreSQL |

Run them locally:

```bash
cd services/business-api && pytest
cd services/auth-api && bun test
```

The end-to-end suite needs both services running. It reads their URLs and the `root` credentials from `AUTH_API_URL`, `BUSINESS_API_URL`, `ROOT_EMAIL` and `ROOT_PASSWORD`, which default to the local values:

```bash
cd tests/e2e && bun test
```

It creates its own accounts, client, engine and orders with a suffix unique to each run, so it can run against a database already in use.

## End-to-end scenarios

1. Both services and their databases answer `/health`.
2. A token issued by `auth-api` is accepted by `business-api`, which reads the identity and permissions it carries.
3. A copy of a real token signed with another key, and a real token with a tampered payload, are rejected with `401`; so is a request without a token.
4. An `admin` registers a client and an engine. The operator (`user`) can read them but gets `403` registering a client.
5. The operator opens a repair order, whose client comes from the engine, and moves it to `delivered`. The history records every status and who changed it.
6. An `admin` revokes `repair_orders:write` from `user`: the operator's current token keeps working until it expires, and a fresh login gets `403`. The permission is restored afterwards.
7. A session renewed with the refresh cookie gets an access token that `business-api` accepts; reusing the rotated cookie ends the session, and logout ends it too.
8. A deactivated account can no longer log in.

## Workflows

| Workflow | Trigger paths | Steps |
| --- | --- | --- |
| `business-api` | `services/business-api/**` | flake8, pytest, Alembic migrations against PostgreSQL, start the server and check `/health` |
| `auth-api` | `services/auth-api/**` | ESLint, `tsc`, `bun test`, Prisma migrations against PostgreSQL, start the server, check `/health` and log in as `root` |
| `e2e` | `services/**`, `tests/e2e/**`, the Postgres init script | Create both databases with the same init script as Docker, verify that each service role cannot open the other database, migrate and start both services with a throwaway key pair, run the end-to-end suite, print the service logs |
| `docs` | `docs/**`, `mkdocs.yml` | `mkdocs build --strict`, and deploy to GitHub Pages on `main` |

No secret is stored for CI: every run generates its own RS256 key pair.
