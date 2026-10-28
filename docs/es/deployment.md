# Despliegue

Cada merge a `main` despliega Motorix en una sola VPS con Ubuntu. GitHub Actions construye una imagen por componente, las publica en el GitHub Container Registry (GHCR) y le indica al servidor que las descargue y reinicie el stack. Cada API aplica sus propias migraciones al arrancar su contenedor, antes de atender peticiones. Esta página explica cómo funciona y cómo configurarlo desde cero.

## Cómo funciona

### Topología

```mermaid
flowchart LR
    user[Navegador] -->|HTTPS| cf[Cloudflare]
    cf -->|HTTPS| nginx[nginx en la VPS]
    nginx -->|/api/v1/auth, /users, /roles| auth[auth-api 127.0.0.1:3100]
    nginx -->|resto de /api| business[business-api 127.0.0.1:8100]
    nginx -->|todo lo demás| web[web 127.0.0.1:8090]
    auth --> pg[(PostgreSQL)]
    business --> pg
```

- **Un solo origen.** La web y las dos API responden en `https://motorix.zerikapi.site`. El navegador no necesita CORS y la cookie de refresh conserva su `Path=/api/v1/auth`.
- **Puertos solo locales.** Los contenedores publican puertos solo en `127.0.0.1`, y PostgreSQL no publica ninguno. Los servicios se comunican entre sí y con la base por la red de Docker del stack.
- **Dirección real del cliente.** nginx toma la dirección del visitante de `CF-Connecting-IP` solo cuando la petición llega desde un rango de Cloudflare, y la reenvía como único valor de `X-Forwarded-For`. Los rate limits de las dos API cuentan visitantes reales, no a Cloudflare.

### Qué pasa en un merge a `main`

```mermaid
sequenceDiagram
    participant GH as GitHub Actions
    participant REG as GHCR
    participant VPS as VPS
    participant WEB as Sitio público
    GH->>GH: Construye auth-api, business-api y web (en paralelo)
    GH->>REG: Publica cada imagen con la etiqueta del commit y latest
    GH->>VPS: docker login ghcr.io con el token de la ejecución
    GH->>VPS: git reset al commit y ejecuta deploy.sh
    VPS->>REG: Descarga las tres imágenes del commit
    VPS->>VPS: Levanta el stack y espera cada health check
    Note over VPS: auth-api corre prisma migrate deploy<br/>business-api corre alembic upgrade head
    VPS->>VPS: Borra las imágenes anteriores de Motorix
    GH->>VPS: docker logout ghcr.io
    GH->>WEB: Comprueba /, /api/v1/users/me y /api/v1/me
```

1. **Imágenes.** El job `images` construye las tres imágenes en paralelo y las publica como `ghcr.io/zerik-official/motorix-<componente>:<commit>` y `:latest`. La imagen de la web incrusta `PUBLIC_URL` y `TURNSTILE_SITE_KEY` al construirse.
2. **Login en el registry.** El job `deploy` inicia sesión del servidor en GHCR con el token de la ejecución. El token caduca con la ejecución y se borra al final, así que en el servidor no queda ninguna credencial del registry.
3. **Archivos de despliegue.** El servidor mueve su copia del repositorio, `~/motorix`, al commit exacto. Eso trae `compose.yaml`, `compose.prod.yaml` y los scripts; los `.env` y `secrets/` están ignorados por Git y nunca se tocan.
4. **Reinicio.** `deploy.sh` descarga las imágenes del commit y ejecuta `docker compose up --wait`. Cada contenedor de API aplica primero sus migraciones pendientes y luego arranca; Compose espera a que pasen todos los health checks y hace fallar el despliegue si alguno no lo logra en 180 segundos.
5. **Limpieza y comprobación.** Se borran las imágenes anteriores de Motorix, y el job comprueba que el sitio responde `200` y que las dos API responden `401` sin token.

Si un paso falla, el job falla y los contenedores que ya corrían siguen atendiendo: un contenedor nuevo solo reemplaza al anterior cuando su imagen ya se descargó.

### Archivos

| Archivo | Función |
| --- | --- |
| `services/auth-api/Dockerfile` | Imagen de `auth-api`: corre `prisma migrate deploy` y luego el servidor, con el usuario sin privilegios `bun`. |
| `services/business-api/Dockerfile` | Imagen de `business-api`: corre `alembic upgrade head` y luego el servidor, con un usuario sin privilegios. |
| `apps/web/Dockerfile`, `apps/web/nginx.conf` | Imagen de la web: la construye y sirve los archivos estáticos, con caché larga para `/assets` y cualquier otra ruta resuelta con `index.html`. |
| `compose.yaml` | El stack completo, que también se levanta en local con `docker compose up -d --build`. |
| `compose.prod.yaml` | Override de producción: imágenes del commit desde GHCR, configuración de producción, puertos en `127.0.0.1` y sin puerto de PostgreSQL. |
| `infrastructure/nginx/motorix.zerikapi.site.conf` | Sitio del nginx del servidor: TLS, cabeceras de seguridad y enrutamiento a los tres contenedores. |
| `infrastructure/nginx/cloudflare-real-ip.conf` | Rangos de Cloudflare en los que se confía para la dirección del visitante. |
| `infrastructure/scripts/bootstrap-server.sh` | Preparación única: escribe los `.env` de producción con contraseñas aleatorias y genera el par de claves RS256. Nunca sobrescribe un archivo existente. |
| `infrastructure/scripts/deploy.sh` | Descarga las imágenes de un commit, levanta el stack, espera los health checks y borra las imágenes anteriores. |
| `.github/workflows/deploy.yml` | El pipeline: corre en cada push a `main`, o a mano desde la pestaña Actions. |

### Dónde vive cada valor

| Valor | Dónde | Quién lo lee |
| --- | --- | --- |
| Dirección del servidor, usuario, clave de despliegue, clave del host | GitHub, environment `production`, secrets | El job `deploy`, para conectarse por SSH |
| URL pública, site key de Turnstile | GitHub, environment `production`, variables | El job `images`, incrustadas en el build de la web |
| Contraseñas de PostgreSQL y de las bases | `~/motorix/.env` en el servidor | PostgreSQL y las dos API, a través de Compose |
| Secret key de Turnstile, primera contraseña de `root` | `~/motorix/services/auth-api/.env` en el servidor | `auth-api` |
| Par de claves RS256 | `~/motorix/secrets/jwt/` en el servidor | `auth-api` (privada), `business-api` (pública) |
| Certificado TLS | `/etc/letsencrypt/` en el servidor, renovado por certbot | nginx |

En el repositorio no se guarda nada secreto, y nada de lo que está en el servidor se guarda en GitHub.

## Configuración desde cero

Haz estos pasos una sola vez y en orden. Los ejemplos usan el servidor `148.113.252.229`, el usuario `ubuntu` y el dominio `motorix.zerikapi.site`.

### 1. Requisitos del servidor

- Ubuntu con Docker Engine y el plugin de Compose (v2.24 o superior, por `!reset` y `!override`), Git, OpenSSL, nginx y certbot con su plugin de nginx.
- Un usuario del grupo `docker` que haga los despliegues (`ubuntu`), y acceso SSH con `sudo` para los pasos de nginx.
- Los puertos locales `3100`, `8100` y `8090` libres.

### 2. Registro DNS en Cloudflare

En **Cloudflare → zerikapi.site → DNS → Records**, añade:

| Tipo | Nombre | Contenido | Estado del proxy | TTL |
| --- | --- | --- | --- | --- |
| `A` | `motorix` | `148.113.252.229` | **Solo DNS** (nube gris) por ahora | Auto |

Se queda en solo DNS hasta que exista el certificado (paso 8), porque certbot tiene que llegar directo al servidor.

### 3. Widget de Turnstile

En **Cloudflare → Turnstile → Add widget**, usa el hostname `motorix.zerikapi.site` y el modo administrado. Ten a mano las dos claves:

- La **site key** es pública: va a GitHub (paso 5).
- La **secret key** es privada: va al servidor (paso 7).

### 4. Clave de despliegue y clave del host

En tu computador, crea un par de claves solo para desplegar, sin passphrase para que el runner pueda usarla. En Windows PowerShell 5.1 la passphrase vacía se escribe `'""'`:

```bash
ssh-keygen -t ed25519 -C motorix-deploy -f ~/.ssh/motorix_deploy -N ""
```

```powershell
ssh-keygen -t ed25519 -C motorix-deploy -f "$HOME\.ssh\motorix_deploy" -N '""'
```

Autoriza la clave pública en el servidor, desde una sesión SSH como `ubuntu`:

```bash
echo "<contenido de motorix_deploy.pub>" >> ~/.ssh/authorized_keys
```

Compruébalo desde tu computador; debe imprimir `ok`:

```bash
ssh -i ~/.ssh/motorix_deploy ubuntu@148.113.252.229 "echo ok"
```

Obtén la clave del host del servidor, para que el runner verifique que habla con la máquina correcta. El `ssh-keyscan` que trae Windows puede fallar con `unsupported KEX method`; usa el de Git Bash, WSL o Linux:

```bash
ssh-keyscan -t ed25519 148.113.252.229
```

Quédate con la línea que empieza por `148.113.252.229 ssh-ed25519`.

### 5. Environment de GitHub

En **GitHub → repositorio → Settings → Environments → New environment**, crea `production` y añade:

**Environment secrets**

| Nombre | Valor |
| --- | --- |
| `VPS_HOST` | `148.113.252.229` |
| `VPS_USER` | `ubuntu` |
| `VPS_SSH_KEY` | El archivo de la clave privada `motorix_deploy` completo, desde `-----BEGIN OPENSSH PRIVATE KEY-----` hasta `-----END OPENSSH PRIVATE KEY-----` |
| `VPS_KNOWN_HOSTS` | La línea de `ssh-keyscan` del paso 4 |

**Environment variables**

| Nombre | Valor |
| --- | --- |
| `PUBLIC_URL` | `https://motorix.zerikapi.site` |
| `TURNSTILE_SITE_KEY` | La site key del paso 3 |

`PUBLIC_URL` y `TURNSTILE_SITE_KEY` deben ser **variables**, no secrets: el workflow las lee como `vars.*`, y como secrets llegarían vacías.

### 6. Repositorio y archivos de producción en el servidor

Como `ubuntu`, clona el repositorio y ejecuta el bootstrap con la URL pública y el correo de `root`:

```bash
git clone https://github.com/Zerik-Official/Motorix.git ~/motorix
cd ~/motorix
sh infrastructure/scripts/bootstrap-server.sh https://motorix.zerikapi.site root@motorix.zerikapi.site
```

Escribe `.env`, `services/auth-api/.env` y `services/business-api/.env` con contraseñas aleatorias y permisos `600`, y el par de claves RS256 en `secrets/jwt/`. Volver a ejecutarlo nunca los sobrescribe.

### 7. Secret key de Turnstile

Edita `~/motorix/services/auth-api/.env` y pon la secret key del paso 3:

```bash
nano ~/motorix/services/auth-api/.env
```

```ini
TURNSTILE_SECRET_KEY=<secret key del widget>
```

`auth-api` se niega a arrancar en producción sin ella, y el despliegue falla en su health check.

### 8. nginx y el certificado

Con `sudo`, instala el fragmento de Cloudflare, saca el certificado mientras el registro DNS sigue en solo DNS y activa el sitio:

```bash
sudo cp ~/motorix/infrastructure/nginx/cloudflare-real-ip.conf /etc/nginx/snippets/
sudo certbot certonly --nginx -d motorix.zerikapi.site
sudo cp ~/motorix/infrastructure/nginx/motorix.zerikapi.site.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/motorix.zerikapi.site.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Hasta el primer despliegue el sitio responde `502`; es lo esperado. certbot renueva el certificado solo.

### 9. Primer despliegue

Mergea `dev` en `main`. El workflow `deploy` arranca solo; síguelo en la pestaña **Actions**. La primera ejecución construye sin caché y tarda unos minutos. Cuando quede en verde, `docker compose ps` en el servidor muestra los cuatro contenedores como `healthy`.

### 10. Proxy de Cloudflare y modo TLS

Cuando el sitio ya funcione por HTTPS:

1. En **DNS → Records**, cambia `motorix` a **Proxied** (nube naranja).
2. En **SSL/TLS → Overview**, usa **Full (strict)**: así Cloudflare verifica el certificado del servidor. Este modo aplica a toda la zona `zerikapi.site`, así que antes comprueba que sus otros subdominios sirvan un certificado válido.

### 11. Contraseña de `root`

La primera contraseña de `root` está en el archivo del servidor, y solo se muestra ahí:

```bash
grep ROOT_PASSWORD ~/motorix/services/auth-api/.env
```

Inicia sesión con ella, cámbiala con `PUT /api/v1/users/me/password` y borra la línea `ROOT_PASSWORD`: los cambios posteriores en `ROOT_*` se ignoran, así que el archivo ya no la necesita.

## Día a día

### Volver a desplegar sin cambios

**Actions → deploy → Run workflow**, sobre `main`. Construye y despliega el commit actual de `main`.

### Volver a una versión anterior

Las imágenes de cada commit desplegado se quedan en GHCR. En el servidor, mueve los archivos a ese commit y ejecuta el script con él:

```bash
cd ~/motorix
git fetch origin && git reset --hard <commit>
sh infrastructure/scripts/deploy.sh <commit>
```

Las migraciones solo avanzan, así que volver atrás pasando por una migración que cambió el esquema necesita una migración que la deshaga.

### Logs y estado

```bash
cd ~/motorix
docker compose -f compose.yaml -f compose.prod.yaml ps
docker compose -f compose.yaml -f compose.prod.yaml logs --tail 100 auth-api
docker compose -f compose.yaml -f compose.prod.yaml logs --tail 100 business-api
```

### Migraciones

Una migración nueva es solo un archivo nuevo en `services/auth-api/prisma/migrations/` o en `services/business-api/migrations/versions/`. En el siguiente despliegue, el contenedor de ese servicio la aplica antes de arrancar. Si una migración falla, el contenedor no queda sano, el despliegue falla y el error está en sus logs.

## Problemas frecuentes

| Síntoma | Causa y solución |
| --- | --- |
| El despliegue falla en los pasos de SSH con `Permission denied (publickey)` | La clave pública no está en `~/.ssh/authorized_keys` de `VPS_USER`, o `VPS_SSH_KEY` no es el archivo completo de la clave privada. |
| `Host key verification failed` | `VPS_KNOWN_HOSTS` está vacío o es de otra clave de host. Vuelve a escanearla (paso 4). |
| `auth-api` nunca queda sano | Casi siempre `TURNSTILE_SECRET_KEY` está vacía en producción. Revisa `logs auth-api`. |
| El login rechaza todos los intentos como no humanos | La site key y la secret key son de widgets distintos, o el widget no incluye `motorix.zerikapi.site`. |
| El sitio responde `502` | Los contenedores están caídos o aún no están sanos; revisa `ps` y los logs. |
| Cloudflare muestra el error `526` | SSL/TLS está en Full (strict) y el servidor no tiene un certificado válido para el hostname; repite el paso 8. |
| La web llama a `localhost` | Falta `PUBLIC_URL` en las variables de GitHub, o se creó como secret. Corrígelo y vuelve a ejecutar el workflow. |
