# Glosario

## Taller

**Cliente**
:   Persona o empresa dueña de motores. Única por tipo de identificación (`cc`, `nit`, `ce`, `passport`) y número.

**Motor**
:   Un motor de minería pesada de un cliente, identificado por su número de serie o código interno.

**Orden de reparación**
:   El registro de una visita de un motor al taller, desde la recepción hasta la entrega. Su número tiene la forma `RO-2026-1A2B3C4D`.

**Etapa**
:   El estado de una orden de reparación. Son siete, en este orden: Recibido, En diagnóstico, Esperando aprobación, En reparación, En pruebas, Finalizado y Entregado.

**Historial de estados**
:   Cada cambio de etapa de una orden, con la etapa que dejó, la que alcanzó, una nota opcional, quién lo hizo y cuándo.

**Técnico**
:   La persona a cargo de una reparación, guardada como texto de referencia en la orden; no necesita cuenta.

**Desactivación**
:   Marcar un cliente, un motor o una cuenta como inactivo en lugar de borrarlo, para conservar su historial. Se puede deshacer.

## Acceso

**Rol**
:   El nivel de una cuenta: `root` (Superadministrador), `admin` (Administrador) o `user` (Operativo). Un rol solo gestiona roles inferiores.

**Permiso**
:   Una operación del catálogo, como `clients:write` o `repair_orders:read`. Los permisos se otorgan a roles, no a cuentas.

**Access token**
:   Un JWT firmado por `auth-api` con RS256 que prueba la identidad y los permisos del llamante. Dura 15 minutos y viaja en la cabecera `Authorization: Bearer`.

**Refresh token**
:   Un token opaco guardado en una cookie httpOnly que renueva el access token. Cada uso lo reemplaza, y reutilizar uno viejo cierra la sesión.

**RS256**
:   Firmas de JWT con un par de claves RSA: `auth-api` firma con la clave privada y `business-api` verifica con la pública, así quien verifica nunca puede emitir tokens.

**Turnstile**
:   La comprobación de Cloudflare que distingue personas de bots en el login, sin acertijos.

## Ingeniería

**Paginación por cursor**
:   Paginar por la posición del último elemento, `(created_at, id)`, en lugar de saltar filas con `OFFSET`. Cada página cuesta lo mismo sin importar cuántas filas haya. Se usa en las órdenes de reparación.

**Paginación por offset**
:   Paginar con `limit` y `offset`, que también da el total. Se usa en clientes, motores y cuentas.

**Consultas N+1**
:   Hacer una consulta extra por cada fila de un listado para cargar datos relacionados. Motorix carga las filas relacionadas en un solo lote.

**Unidad de trabajo**
:   Una sesión de base de datos por petición, confirmada cuando la petición sale bien y revertida cuando falla.

**Health check**
:   `GET /health`, que usan Docker, CI y el despliegue para saber que un servicio y su base están arriba.

**GHCR**
:   GitHub Container Registry, donde el despliegue publica las imágenes de cada commit que llega a `main`.

**Origen único**
:   Servir la web y las dos API desde el mismo dominio, así el navegador no necesita CORS y la cookie de refresh sigue funcionando.
