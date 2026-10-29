# web

La interfaz del taller: una aplicación de una sola página que se autentica contra [auth-api](auth-api.md) y lee y escribe los datos del taller a través de [business-api](business-api.md). No guarda datos propios.

## Stack

| Aspecto | Elección |
| --- | --- |
| Build | Vite, TypeScript, Bun como gestor de paquetes |
| Interfaz | React 19, Tailwind CSS 4, primitivas de Base UI y Radix, react-icons |
| Rutas | React Router, cada página cargada bajo demanda |
| Datos | Axios, un cliente por API |
| Formularios | zod |
| Recorrido guiado | `@reactour/tour` |
| Calidad | Vitest con Testing Library, ESLint, `tsc` |

## Estructura

```
apps/web/src/
├── app/              router y componente raíz
├── features/         una carpeta por área: auth, dashboard, repair-orders, clients, engines,
│                     users, roles, tour, landing y shell (layout y navegación)
├── shared/           clientes de API, sesión, permisos, componentes compartidos y valores de dominio
├── components/ui/    componentes base: botones, inputs, selects, checkboxes, tooltips
└── styles/           tokens de diseño y los temas claro y oscuro
```

## Vistas

| Ruta | Vista | Permiso |
| --- | --- | --- |
| `/` | Landing | Público |
| `/login` | Login con Turnstile | Público |
| `/app` | Tablero: órdenes por etapa y las últimas órdenes | Sesión iniciada |
| `/app/ordenes` | Órdenes de reparación con búsqueda y filtros por etapa, cliente y motor | `repair_orders:read` |
| `/app/ordenes/:id` | Detalle de la orden, pista de etapas, historial y cambio de etapa | `repair_orders:read` |
| `/app/clientes`, `/app/clientes/:id` | Clientes: listado, detalle, crear, editar, desactivar y reactivar | `clients:read` |
| `/app/motores`, `/app/motores/:id` | Motores: listado, detalle, crear, editar, desactivar y reactivar | `engines:read` |
| `/app/usuarios` | Cuentas de roles inferiores | `users:manage` |
| `/app/permisos` | Permisos de cada rol | `permissions:manage` |

Las acciones que un rol no puede hacer se ocultan; las API vuelven a comprobar cada petición, así que ocultar es una comodidad, no la barrera de seguridad.

## Sesión

- El access token vive **solo en memoria**, nunca en `localStorage`, así un script inyectado no puede leerlo. Al recargar, la app le pide uno nuevo a `auth-api` con la cookie httpOnly de refresh.
- Todas las peticiones comparten el mismo refresh, y se serializa entre pestañas con `navigator.locks`, porque dos refresh con la misma cookie parecerían un token reutilizado y cerrarían la sesión.
- Los errores de las API se convierten en mensajes en español, y los errores de validación se muestran debajo de su campo.

## Configuración

| Variable | Para qué |
| --- | --- |
| `VITE_AUTH_API_URL` | URL base de `auth-api` |
| `VITE_BUSINESS_API_URL` | URL base de `business-api` |
| `VITE_TURNSTILE_SITE_KEY` | Site key pública de Turnstile |
| `VITE_SITE_URL` | URL pública para el enlace canónico y las etiquetas Open Graph |

Se incrustan al construir la app, así que son públicas y nunca llevan secretos. En producción las tres URL son el mismo origen, `https://motorix.zerikapi.site`.

## Ejecutar y probar

```bash
cd apps/web
bun install
bun run dev
bun run test
bun run build
```

La imagen de producción sirve el build con nginx, con caché larga para `/assets` y cualquier otra ruta respondida con `index.html`.
