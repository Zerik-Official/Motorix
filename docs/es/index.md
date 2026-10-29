# Motorix

Motorix es una plataforma interna para un taller de reparación de motores de minería pesada. Centraliza clientes, motores y órdenes de reparación, y permite al personal autorizado seguir cada reparación por sus siete etapas, desde la recepción hasta la entrega.

Está formada por dos API independientes y una aplicación web: `auth-api` (Express y TypeScript) es dueña de la identidad y firma tokens RS256, `business-api` (FastAPI y Python) es dueña de los datos del taller y solo verifica esos tokens, y la web es la interfaz de ambas. El sitio en producción es <https://motorix.zerikapi.site>.

## Por dónde empezar

| Si quieres | Lee |
| --- | --- |
| Ejecutar Motorix en tu máquina | [Primeros pasos](getting-started.md) |
| Entender cómo encajan las piezas | [Arquitectura](architecture.md) y luego [Modelo de datos](data-model.md) |
| Ver cómo funcionan el login, los tokens y los permisos | [Seguridad](security.md) |
| Saber qué hace cada servicio y sus endpoints | [Servicios](services/index.md): [auth-api](services/auth-api.md), [business-api](services/business-api.md), [web](services/web.md) |
| Probar los endpoints en el navegador | [Documentación de la API](api-docs.md) |
| Correr las pruebas o leer el CI | [Pruebas y CI](testing.md) |
| Desplegar u operar el servidor | [Despliegue](deployment.md) |
| Buscar un término | [Glosario](glossary.md) |

## Contenido

**Arquitectura**

- [Visión general](architecture.md): componentes, comunicación, diseño por capas y decisiones de escalabilidad.
- [Modelo de datos](data-model.md): bases de datos, entidades, relaciones, restricciones e índices.
- [Seguridad](security.md): flujo de autenticación, RS256, gestión de claves, sesiones, roles y permisos.

**Servicios**

- [Servicios](services/index.md): los tres componentes y sus convenciones compartidas.
- [auth-api](services/auth-api.md), [business-api](services/business-api.md) y [web](services/web.md): stack, estructura, endpoints, reglas y configuración de cada uno.
- [Documentación de la API](api-docs.md): las rutas de Swagger y ReDoc, cuándo están activas y cómo probar un endpoint con un token.

**Operación**

- [Pruebas y CI](testing.md): suites de pruebas, escenarios extremo a extremo y workflows de GitHub Actions.
- [Despliegue](deployment.md): imágenes, despliegue continuo en la VPS, nginx y Cloudflare, paso a paso.

**Referencia**

- [Glosario](glossary.md): términos del taller, de acceso y de ingeniería.
