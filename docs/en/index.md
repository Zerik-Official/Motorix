# Motorix

Motorix is an internal platform for a heavy mining engine repair shop. It centralizes clients, engines and repair orders, and lets authorized staff follow every repair through its seven stages, from reception to delivery.

It is made of two independent APIs and a web app: `auth-api` (Express and TypeScript) owns identity and signs RS256 tokens, `business-api` (FastAPI and Python) owns the workshop data and only verifies those tokens, and the web app is the interface of both. The live site is <https://motorix.zerikapi.site>.

## Where to start

| If you want to | Read |
| --- | --- |
| Run Motorix on your machine | [Getting started](getting-started.md) |
| Understand how the pieces fit | [Architecture](architecture.md), then [Data model](data-model.md) |
| See how login, tokens and permissions work | [Security](security.md) |
| Know what each service does and its endpoints | [Services](services/index.md): [auth-api](services/auth-api.md), [business-api](services/business-api.md), [web](services/web.md) |
| Try the endpoints in the browser | [API documentation](api-docs.md) |
| Run the tests or read the CI | [Testing and CI](testing.md) |
| Deploy or operate the server | [Deployment](deployment.md) |
| Look up a term | [Glossary](glossary.md) |

## Contents

**Architecture**

- [Overview](architecture.md): components, communication, layered design and scalability decisions.
- [Data model](data-model.md): databases, entities, relationships, constraints and indexes.
- [Security](security.md): authentication flow, RS256, key management, sessions, roles and permissions.

**Services**

- [Services](services/index.md): the three components and their shared conventions.
- [auth-api](services/auth-api.md), [business-api](services/business-api.md) and [web](services/web.md): stack, structure, endpoints, rules and configuration of each one.
- [API documentation](api-docs.md): the Swagger and ReDoc routes, when they are enabled, and how to try an endpoint with a token.

**Operations**

- [Testing and CI](testing.md): test suites, end-to-end scenarios and GitHub Actions workflows.
- [Deployment](deployment.md): images, continuous deployment to the VPS, nginx and Cloudflare, step by step.

**Reference**

- [Glossary](glossary.md): workshop, access and engineering terms.
