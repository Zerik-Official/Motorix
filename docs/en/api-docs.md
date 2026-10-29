# API documentation

Both APIs describe their endpoints with OpenAPI and serve an interactive reference to try them. The reference is generated from the code, so it always matches what the service accepts.

## Routes

| Service | Interactive reference | Alternative view | OpenAPI document | Generated from |
| --- | --- | --- | --- | --- |
| business-api | `/docs` (Swagger UI) | `/redoc` (ReDoc) | `/openapi.json` | FastAPI routers and Pydantic schemas |
| auth-api | `/docs` (Swagger UI) | | `/openapi.json` | The zod schemas that validate the requests, through `zod-to-openapi` |

Locally, with the default ports:

| Service | Reference | Document |
| --- | --- | --- |
| business-api | <http://localhost:8000/docs> and <http://localhost:8000/redoc> | <http://localhost:8000/openapi.json> |
| auth-api | <http://localhost:3000/docs> | <http://localhost:3000/openapi.json> |

## When they are available

The routes exist only while `DOCS_ENABLED` is `true`. When it is `false` they are not registered at all, so they answer `404` like any unknown path.

| Environment | `DOCS_ENABLED` | Reachable |
| --- | --- | --- |
| Local (`.env.example`) | `true` | Yes |
| Docker Compose in local (`compose.yaml`) | `true`, from the `.env` of each service | Yes, on `127.0.0.1` |
| CI | default `true` | Only inside the runner |
| Production (`compose.prod.yaml`) | `false` | No |

Production turns them off on purpose: they list every route and schema, which helps an attacker map the API, and nobody needs them there. Even if they were on, the nginx of the server only forwards `/api` paths to the APIs, so `/docs` and `/openapi.json` would reach the web app instead.

## Trying an endpoint with a token

1. Sign in with `POST /api/v1/auth/login` in the reference of `auth-api` and copy `access_token` from the response.
2. In the reference of either API, open **Authorize** and paste the token as the Bearer value.
3. Protected endpoints now run with that account and its permissions. The token lasts 15 minutes; sign in again when they start answering `401`.

The login needs a Turnstile token when `TURNSTILE_SECRET_KEY` is set. Locally it is empty by default, so the login works from the reference without it.
