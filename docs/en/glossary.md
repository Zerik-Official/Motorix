# Glossary

## Workshop

**Client**
:   A person or company that owns engines. Unique by identification type (`cc`, `nit`, `ce`, `passport`) and number.

**Engine**
:   A heavy mining engine owned by one client, identified by its serial number or internal code.

**Repair order**
:   The record of one visit of an engine to the workshop, from reception to delivery. Its number looks like `RO-2026-1A2B3C4D`.

**Stage**
:   The status of a repair order. There are seven, in this order: Received, In diagnosis, Awaiting approval, In repair, In testing, Finished and Delivered.

**Status history**
:   Every stage change of an order, with the stage it left, the stage it reached, an optional note, who made it and when.

**Technician**
:   The person in charge of a repair, stored as reference text on the order; no account is needed.

**Deactivation**
:   Marking a client, an engine or an account as inactive instead of deleting it, so its history is kept. It can be undone.

## Access

**Role**
:   The level of an account: `root` (Superadministrador), `admin` (Administrador) or `user` (Operativo). A role only manages lower roles.

**Permission**
:   One operation of the catalog, such as `clients:write` or `repair_orders:read`. Permissions are granted to roles, not to accounts.

**Access token**
:   A JWT signed by `auth-api` with RS256 that proves the identity and permissions of the caller. It lasts 15 minutes and travels in the `Authorization: Bearer` header.

**Refresh token**
:   An opaque token kept in an httpOnly cookie that renews the access token. Each use replaces it, and reusing an old one ends the session.

**RS256**
:   JWT signatures with an RSA key pair: `auth-api` signs with the private key and `business-api` verifies with the public key, so the verifier can never issue tokens.

**Turnstile**
:   The Cloudflare check that tells people from bots on the login, without puzzles.

## Engineering

**Cursor pagination**
:   Paging by the position of the last item, `(created_at, id)`, instead of skipping rows with `OFFSET`. Every page costs the same no matter how many rows exist. Used for repair orders.

**Offset pagination**
:   Paging with `limit` and `offset`, which also gives the total. Used for clients, engines and accounts.

**N+1 queries**
:   Running one extra query per row of a list to load related data. Motorix loads related rows in one batch instead.

**Unit of work**
:   One database session per request, committed when the request succeeds and rolled back when it fails.

**Health check**
:   `GET /health`, used by Docker, CI and the deploy to know that a service and its database are up.

**GHCR**
:   GitHub Container Registry, where the deploy publishes the images of every commit merged to `main`.

**Single origin**
:   Serving the web app and both APIs from the same domain, so the browser needs no CORS and the refresh cookie keeps working.
