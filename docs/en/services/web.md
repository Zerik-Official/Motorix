# web

The interface of the workshop: a single page app that authenticates against [auth-api](auth-api.md) and reads and writes the workshop data through [business-api](business-api.md). It stores no data of its own.

## Stack

| Concern | Choice |
| --- | --- |
| Build | Vite, TypeScript, Bun as package manager |
| UI | React 19, Tailwind CSS 4, Base UI and Radix primitives, react-icons |
| Routing | React Router, every page loaded on demand |
| Data | Axios, one client per API |
| Forms | zod |
| Guided tour | `@reactour/tour` |
| Quality | Vitest with Testing Library, ESLint, `tsc` |

## Structure

```
apps/web/src/
├── app/              router and root component
├── features/         one folder per area: auth, dashboard, repair-orders, clients, engines,
│                     users, roles, tour, landing and shell (layout and navigation)
├── shared/           API clients, session, permissions, shared components and domain values
├── components/ui/    base components: buttons, inputs, selects, checkboxes, tooltips
└── styles/           design tokens and the light and dark themes
```

## Views

| Route | View | Permission |
| --- | --- | --- |
| `/` | Landing | Public |
| `/login` | Login with Turnstile | Public |
| `/app` | Dashboard: orders per stage and the latest orders | Signed in |
| `/app/ordenes` | Repair orders with search and filters by stage, client and engine | `repair_orders:read` |
| `/app/ordenes/:id` | Order detail, stage track, history and stage change | `repair_orders:read` |
| `/app/clientes`, `/app/clientes/:id` | Clients: list, detail, create, edit, deactivate and reactivate | `clients:read` |
| `/app/motores`, `/app/motores/:id` | Engines: list, detail, create, edit, deactivate and reactivate | `engines:read` |
| `/app/usuarios` | Accounts of lower roles | `users:manage` |
| `/app/permisos` | Permissions of each role | `permissions:manage` |

Actions a role cannot perform are hidden; the APIs check every request again, so hiding is a convenience, not the security boundary.

## Session

- The access token lives **only in memory**, never in `localStorage`, so an injected script cannot read it. On reload, the app asks `auth-api` for a new one with the httpOnly refresh cookie.
- Refreshes are shared by every request and serialized across tabs with `navigator.locks`, because two refreshes with the same cookie would look like a reused token and end the session.
- API errors are turned into Spanish messages, and validation errors are placed under their field.

## Configuration

| Variable | Purpose |
| --- | --- |
| `VITE_AUTH_API_URL` | Base URL of `auth-api` |
| `VITE_BUSINESS_API_URL` | Base URL of `business-api` |
| `VITE_TURNSTILE_SITE_KEY` | Public site key of Turnstile |
| `VITE_SITE_URL` | Public URL for the canonical link and the Open Graph tags |

They are embedded when the app is built, so they are public and never hold secrets. In production all three URLs are the same origin, `https://motorix.zerikapi.site`.

## Run and test

```bash
cd apps/web
bun install
bun run dev
bun run test
bun run build
```

The production image serves the build with nginx, with long caching for `/assets` and every other route answered with `index.html`.
