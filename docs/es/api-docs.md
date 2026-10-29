# Documentación de la API

Las dos API describen sus endpoints con OpenAPI y sirven una referencia interactiva para probarlos. La referencia se genera desde el código, así que siempre coincide con lo que el servicio acepta.

## Rutas

| Servicio | Referencia interactiva | Vista alternativa | Documento OpenAPI | Se genera desde |
| --- | --- | --- | --- | --- |
| business-api | `/docs` (Swagger UI) | `/redoc` (ReDoc) | `/openapi.json` | Los routers de FastAPI y los esquemas de Pydantic |
| auth-api | `/docs` (Swagger UI) | | `/openapi.json` | Los esquemas de zod que validan las peticiones, con `zod-to-openapi` |

En local, con los puertos por defecto:

| Servicio | Referencia | Documento |
| --- | --- | --- |
| business-api | <http://localhost:8000/docs> y <http://localhost:8000/redoc> | <http://localhost:8000/openapi.json> |
| auth-api | <http://localhost:3000/docs> | <http://localhost:3000/openapi.json> |

## Cuándo están disponibles

Las rutas solo existen mientras `DOCS_ENABLED` sea `true`. Cuando es `false` ni siquiera se registran, así que responden `404` como cualquier ruta desconocida.

| Entorno | `DOCS_ENABLED` | Accesibles |
| --- | --- | --- |
| Local (`.env.example`) | `true` | Sí |
| Docker Compose en local (`compose.yaml`) | `true`, desde el `.env` de cada servicio | Sí, en `127.0.0.1` |
| CI | `true` por defecto | Solo dentro del runner |
| Producción (`compose.prod.yaml`) | `false` | No |

Producción las apaga a propósito: listan cada ruta y esquema, lo que le ayuda a un atacante a mapear la API, y ahí nadie las necesita. Aunque estuvieran activas, el nginx del servidor solo reenvía a las API las rutas de `/api`, así que `/docs` y `/openapi.json` llegarían a la web.

## Probar un endpoint con un token

1. Inicia sesión con `POST /api/v1/auth/login` en la referencia de `auth-api` y copia `access_token` de la respuesta.
2. En la referencia de cualquiera de las dos API, abre **Authorize** y pega el token como valor Bearer.
3. Los endpoints protegidos ahora corren con esa cuenta y sus permisos. El token dura 15 minutos; vuelve a iniciar sesión cuando empiecen a responder `401`.

El login necesita un token de Turnstile cuando `TURNSTILE_SECRET_KEY` tiene valor. En local está vacía por defecto, así que el login funciona desde la referencia sin él.
