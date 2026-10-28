# Security

## Authentication flow

```mermaid
sequenceDiagram
    participant W as Web app
    participant A as auth-api
    participant B as business-api

    W->>A: POST /auth/login (email, password, Turnstile token)
    A->>A: Verify Turnstile, rate limit, Argon2id hash
    A-->>W: JWT (RS256, signed with private key)
    W->>B: GET /api/v1/... (Authorization: Bearer JWT)
    B->>B: Verify signature, exp, iss, aud with public key
    B-->>W: Protected resource
```

## JWT with RS256

- `auth-api` signs tokens with an **RSA private key**. It is the only component that can issue tokens.
- `business-api` holds only the **public key**. It can verify tokens but never create them, so the authentication responsibility is not duplicated.
- No user credentials are shared between services.

Claims included in every token:

| Claim | Purpose |
| --- | --- |
| `sub` | User identifier |
| `role` | Authorization role (`root`, `admin` or `user`) |
| `iss` | Issuer, must match the value expected by `business-api` |
| `aud` | Audience, must match the value expected by `business-api` |
| `iat` / `exp` | Issue and expiration time |

`business-api` rejects a token when the signature is invalid, the token is expired, or `iss`/`aud` do not match. Decoding the payload alone is never enough.

## Key management per environment

| Environment | How keys are provided |
| --- | --- |
| Local | Generated with `infrastructure/scripts/generate-jwt-keys.sh` into `secrets/jwt/` (ignored by Git) and mounted read-only into the containers |
| CI | A fresh key pair is generated on every run; no secret is stored |
| Staging / production | Private key stored as a GitHub Actions secret and written to the server with `600` permissions; only `auth-api` receives it |

Rotation: generate a new pair, deploy the public key to `business-api`, then the private key to `auth-api`. Tokens signed with the old key expire on their own.

## Roles

Roles follow a strict hierarchy: `root` > `admin` > `user`. A user can only manage accounts with a lower role than their own.

| Action | root | admin | user |
| --- | --- | --- | --- |
| Use the business API | Yes | Yes | Yes |
| Create, update and deactivate `user` accounts | Yes | Yes | No |
| Create, update and deactivate `admin` accounts | Yes | No | No |
| Modify or deactivate the `root` account | No | No | No |

- With only two roles, an admin could deactivate another admin and the platform could end up without any administrator. A single `root` above them removes that state without extra rules.
- There is exactly one `root`. Its credentials are defined in the `auth-api` environment and seeded on startup: the password is hashed with Argon2id before it is stored, and the account cannot be created, changed or deactivated through the API.

## Passwords

Passwords are hashed with **Argon2id** in `auth-api`. Plain passwords are never stored or logged. `business-api` stores no passwords.

## Hardening

- Cloudflare Turnstile on login to block automated attempts.
- Rate limiting on both APIs, stricter on authentication endpoints.
- Security headers and restricted CORS origins.
- Input validation on every endpoint (Pydantic and zod).
- Every setting comes from environment variables; `.env` files are never committed, only `.env.example` with non-sensitive values.

## Database isolation

Each service connects with its own PostgreSQL role, which owns only its database. `CONNECT` is revoked from `PUBLIC`, so the role of one service cannot open the database of the other.
