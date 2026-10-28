# Seguridad

## Flujo de autenticación

```mermaid
sequenceDiagram
    participant W as App web
    participant A as auth-api
    participant B as business-api

    W->>A: POST /auth/login (correo, contraseña, token Turnstile)
    A->>A: Verifica Turnstile, rate limit, hash Argon2id
    A-->>W: JWT (RS256, firmado con clave privada)
    W->>B: GET /api/v1/... (Authorization: Bearer JWT)
    B->>B: Verifica firma, exp, iss, aud con la clave pública
    B-->>W: Recurso protegido
```

## JWT con RS256

- `auth-api` firma los tokens con una **clave privada RSA**. Es el único componente que puede emitir tokens.
- `business-api` solo tiene la **clave pública**. Puede verificar tokens pero nunca crearlos, por lo que la responsabilidad de autenticación no se duplica.
- No se comparten credenciales de usuarios entre servicios.

Claims incluidos en cada token:

| Claim | Propósito |
| --- | --- |
| `sub` | Identificador del usuario |
| `role` | Rol de autorización (`root`, `admin` o `user`) |
| `iss` | Emisor, debe coincidir con el esperado por `business-api` |
| `aud` | Audiencia, debe coincidir con la esperada por `business-api` |
| `iat` / `exp` | Fecha de emisión y expiración |

`business-api` rechaza un token si la firma es inválida, si expiró o si `iss`/`aud` no coinciden. Decodificar el contenido nunca es suficiente.

## Gestión de claves por entorno

| Entorno | Cómo se proveen las claves |
| --- | --- |
| Local | Se generan con `infrastructure/scripts/generate-jwt-keys.sh` en `secrets/jwt/` (ignorado por Git) y se montan en solo lectura en los contenedores |
| CI | Se genera un par nuevo en cada ejecución; no se almacena ningún secreto |
| Staging / producción | La clave privada se guarda como secreto de GitHub Actions y se escribe en el servidor con permisos `600`; solo `auth-api` la recibe |

Rotación: se genera un par nuevo, se despliega la clave pública en `business-api` y luego la privada en `auth-api`. Los tokens firmados con la clave anterior expiran por sí solos.

## Roles

Los roles siguen una jerarquía estricta: `root` > `admin` > `user`. Un usuario solo puede gestionar cuentas con un rol inferior al suyo.

| Acción | root | admin | user |
| --- | --- | --- | --- |
| Usar la API de negocio | Sí | Sí | Sí |
| Crear, actualizar y desactivar cuentas `user` | Sí | Sí | No |
| Crear, actualizar y desactivar cuentas `admin` | Sí | No | No |
| Modificar o desactivar la cuenta `root` | No | No | No |

- Con solo dos roles, un admin podría desactivar a otro admin y la plataforma podría quedarse sin ningún administrador. Un único `root` por encima de ellos elimina ese estado sin reglas adicionales.
- Existe exactamente un `root`. Sus credenciales se definen en el entorno de `auth-api` y se siembran al arrancar: la contraseña se cifra con Argon2id antes de guardarse, y la cuenta no se puede crear, modificar ni desactivar a través de la API.

## Permisos

Un rol solo limita hasta dónde puede llegar una cuenta administrando otras cuentas (`4.1.6`); no dice nada sobre qué operaciones de negocio puede hacer esa cuenta. Sin una capa de permisos separada, todos los roles llamarían a los mismos endpoints de `business-api` con los mismos derechos, lo cual anula el sentido de tener más de un rol. Los permisos cierran esa brecha: un catálogo fijo de operaciones, otorgadas a un rol por defecto y ajustables por rol por quien tenga autorización para hacerlo.

**Catálogo** (`recurso:acción`):

| Permiso | Por defecto: `root` | Por defecto: `admin` | Por defecto: `user` |
| --- | --- | --- | --- |
| `clients:read` | Sí | Sí | Sí |
| `clients:write` | Sí | Sí | Sí |
| `engines:read` | Sí | Sí | Sí |
| `engines:write` | Sí | Sí | Sí |
| `repair_orders:read` | Sí | Sí | Sí |
| `repair_orders:write` | Sí | Sí | Sí |
| `users:manage` | Sí | Sí | No |
| `permissions:manage` | Sí | Sí | No |

`write` cubre crear, actualizar y desactivar ese recurso; `root` siempre tiene todos los permisos.

**Otorgar y revocar.** Los permisos se asignan a un rol, no a una cuenta individual, y se guardan en `role_permissions` (`auth_db`). Quien tenga `permissions:manage` solo puede cambiar los permisos de un rol estrictamente inferior al suyo:

- `root` puede cambiar los permisos de `admin` y de `user`.
- `admin` solo puede cambiar los permisos de `user`.
- Nadie puede cambiar los permisos de su propio rol ni de uno superior: un `admin` no puede cambiar los permisos de otro `admin` (no hay distinción por cuenta, solo por rol), y `user` no puede cambiar los de nadie.
- Los permisos de `root` están fijos en el código como "todos los permisos" y nunca se leen de `role_permissions`; la API rechaza cualquier intento de modificarlos.

**Cómo llega a `business-api`.** Al iniciar sesión, `auth-api` resuelve los permisos actuales de la cuenta (los del rol por defecto, sobrescritos por `role_permissions`) y los incluye como claim `permissions` en el JWT. `business-api` sigue verificando firma, `exp`, `iss` y `aud` como siempre, y además comprueba que ese claim contenga el permiso que exige cada endpoint. Como la lista viaja dentro del token, revocar un permiso solo tiene efecto la próxima vez que la cuenta inicia sesión, la misma concesión que ya se acepta para el claim `role`; así `business-api` nunca necesita llamar de vuelta a `auth-api` para resolver autorización.

**Estado.** Todavía no está implementado. Hoy cada endpoint de `clients` y `engines` solo exige un token válido, sin importar el rol. La tabla `role_permissions`, los endpoints de otorgar/revocar con su verificación de jerarquía, el claim `permissions` y la dependencia `require_permission` en `business-api` se construyen juntos en las ramas de `auth-api`, porque es ahí donde se administran los datos de permisos.

## Contraseñas

Las contraseñas se cifran con **Argon2id** en `auth-api`. Nunca se almacenan ni se registran en logs en texto plano. `business-api` no almacena contraseñas.

## Endurecimiento

- Cloudflare Turnstile en el login para bloquear intentos automatizados.
- Rate limiting en ambas API, más estricto en los endpoints de autenticación.
- Cabeceras de seguridad y orígenes CORS restringidos.
- Validación de entradas en cada endpoint (Pydantic y zod).
- Toda la configuración viene de variables de entorno; los `.env` nunca se suben, solo `.env.example` con valores no sensibles.

## Aislamiento de bases de datos

Cada servicio se conecta con su propio rol de PostgreSQL, dueño únicamente de su base de datos. Se revoca `CONNECT` a `PUBLIC`, por lo que el rol de un servicio no puede abrir la base del otro.
