# Evidencia de pruebas de SCRUM-111

24 de noviembre de 2026. Revisión probada `623a95f` de `origin/dev-web`, en una copia temporal del proyecto.

## Recorrido local por el Gateway

Se ejecutaron el Gateway y los servicios FastAPI de la revisión con PostgreSQL temporal. Se usaron dobles HTTP de Supabase Auth y Storage, y cuentas e imágenes sintéticas.

| Operación | Resultado observado |
| --- | --- |
| `POST /api/usuarios/me` | Creó el perfil. Una segunda inicialización devolvió el mismo ID y conservó el nombre original. |
| `GET /api/usuarios/me` | Devolvió el perfil propio. Sin sesión o con el token revocado devolvió `401`. |
| `PATCH /api/usuarios/me` | Guardó la ciudad y devolvió `422` al intentar cambiar el nombre. |
| `PUT /api/usuarios/me/foto` | Recibió el PNG como multipart `foto`, devolvió una URL pública del bucket `perfiles` y rechazó con `415` un archivo que no era una imagen. |
| Reemplazo de foto | La segunda subida produjo una URL distinta y se descargó con los mismos bytes. La URL anterior pasó a devolver `404`. El perfil de otra cuenta conservó su foto vacía. |
| Cierre de sesión y nuevo ingreso | El token anterior recibió `401`. El nuevo token de la misma cuenta recuperó el ID, la ciudad y la última URL. La descarga seguía devolviendo los bytes del segundo PNG. |

El recorrido de perfil por Next.js y su BFF también pasó. Verificó el contrato `v1`, la edición, el reemplazo y la retirada de la foto anterior, la revocación, la lectura tras iniciar sesión otra vez y el aislamiento entre cuentas. El arranque de Next con el ejecutor original agotó el tiempo de espera. El reintento usó Webpack en la copia temporal.

## Suites

| Suite | Resultado |
| --- | --- |
| Gateway | 151 aprobadas. |
| Auth/Users | 155 aprobadas, 2 omitidas. Se adaptó el arranque del ejecutor aislado para importar `backend.service_runtime` desde esta revisión. |
| Web, perfil y sesión | 57 aprobadas. |

## Despliegues consultados

| Gateway | `GET /health` | `GET /api/usuarios/me` sin sesión |
| --- | --- | --- |
| Kubero TEST | `200` | `404` |
| Render PoC | Tiempo de espera excedido | `404` |

La aceptación en un entorno desplegado sigue pendiente. Requiere un Gateway que exponga el contrato y una cuenta de pruebas confirmada para repetir la subida, la revocación y la descarga después de iniciar sesión contra Supabase real.
