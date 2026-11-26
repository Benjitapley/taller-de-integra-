# E03 — comprobación con identidad real y diagnóstico de Kubero

Fecha: 26/11/2026. Base local: `f422d84ca3f2bd96e6a785812c04b042ff07af55` más los cambios de la sesión.

## Resultado actual

Las dos cuentas facilitadas autenticaron contra el proyecto Supabase confirmado por el usuario. Ambas respondieron HTTP 200, con correo confirmado y sin identidad anónima. Las cuentas se identifican como `actor-1` y `actor-2` en la evidencia; no se registran sus correos, contraseñas ni tokens.

El Gateway de Test respondió HTTP 200 en `/health`. Para ambas identidades, estas consultas autenticadas devolvieron HTTP 503:

- `GET /api/usuarios/me`.
- `GET /local/v1/perfil`.
- `GET /api/arriendos/mio`.
- `GET /api/conversaciones`.

Esto acredita un bloqueo de dependencias; no permite concluir si las cuentas tienen perfil o pertenencia. Un 503 no significa «sin arriendo».

La web publicada también devolvió HTTP 503 al iniciar sesión con ambos actores, sin emitir cookies de sesión de Supabase. El intento visual del primer actor mostró el error en pantalla. La captura no se guarda porque el formulario contenía un correo real. Los dos resultados reproducibles por HTTP están en el informe del BFF.

## Despliegue observado en Kubero

Se consultó la sesión compartida del usuario en el pipeline `roomies`, fase `test`. Aplicaciones presentes:

- `roomies-db-admin-test`.
- `roomies-db-test`.
- `roomies-db-test2`.
- `roomies-gateway-test`: `ghcr.io/cparra2007/roomies-api-gateway:sha-1267d9e`.
- `roomies-match-test`: `ghcr.io/cparra2007/roomies-match-conexion:sha-72e4bd6`.

No aparecen aplicaciones de Auth/Users, Listado ni Convivencia en esa fase. El Gateway tiene `ROOMIES_RUNTIME_MODE=kubero` y solo el destino `MATCH_UPSTREAM_URL` configurado. Le faltan los destinos de los tres servicios requeridos por el recorrido del chat.

La configuración del pipeline declara `deploymentstrategy=docker`, `buildstrategy=plain`; no se observó un repositorio Git conectado. La creación de una aplicación solicita una imagen y una etiqueta. No se creó ninguna aplicación ni se cambió la configuración del pipeline, los servicios existentes o la base de datos durante esta comprobación.

La consulta anónima a los nombres candidatos de imágenes de Auth, Listado y Convivencia en GHCR devolvió 401/403. Esto no demuestra que no existan imágenes privadas: siguen faltando las referencias accesibles y las versiones que se van a desplegar. La imagen publicada del Gateway sí se pudo consultar.

## Datos ficticios e imágenes Docker

Los datos de ensayo pueden ser ficticios: publicaciones, motivos, nombres de demostración y mensajes. Una imagen Docker es el paquete ejecutable del servicio. Para validar E03 en destino debe construirse a partir del código y estar disponible para Kubero; inventar una referencia de imagen o usar un contenedor que solo responda `/health` no acredita el chat.

El repositorio dispone de Dockerfiles para los tres servicios. Sus contextos de construcción son la raíz de `roomies-web`, porque también copian `backend/service_runtime`. La publicación requiere un constructor Docker y acceso al registro elegido; no se dispone de Docker/Podman en este equipo. El pipeline actual tampoco ofrece esa construcción desde Git.

## Evidencia

- [Preflight actualizado de Supabase y Gateway](preflight-current.json).
- [Login HTTP en la web publicada](published-bff.json).
- [Preflight anterior conservado](preflight.json).
- [BFF local anterior conservado](bff.json).

No hubo mutaciones de datos de negocio. Los POST realizados son inicios de sesión autorizados. La evidencia se limita a respuestas sanitizadas y metadatos de despliegue.

## Próximo requisito para cerrar

Publicar y desplegar Auth/Users, Listado y Convivencia con sus migraciones y roles en PostgreSQL Kubero; configurar los destinos del Gateway y la web; preparar dos pertenencias reales al mismo arriendo y ejecutar el guion del chat. Registrar las imágenes/digests y el SHA efectivamente probado. El bloqueo pasa de credenciales pendientes a despliegue e integración pendientes; E03 sigue sin aceptación final.
