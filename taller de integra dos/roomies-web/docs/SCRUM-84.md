# SCRUM-84 — Panel administrativo de consulta

## Alcance

`/admin` muestra estadísticas reales de usuarios, publicaciones y conexiones,
y publicaciones paginadas de todas las cuentas (20 por página). Incluye carga,
listado vacío, actualización, sesión expirada, acceso denegado y reintento.
Es solo consulta: no modifica usuarios, publicaciones ni conexiones.

Se reutilizan AppShell, Card, Button, JWT, sesiones revocables, cookie HttpOnly
y el lanzador de pruebas existente. Sin dependencias nuevas, migraciones,
cambios de credenciales ni operaciones sobre Supabase productivo.

## Acceso y APIs

FastAPI valida el JWT y la sesión vigente con `get_current_user`; después exige
que el ID esté en `ADMIN_USER_IDS`, configurado únicamente en el proceso backend
como IDs positivos separados por coma. Ausente/vacío: acceso denegado;
configuración inválida: servicio no disponible. Registro, perfil, correo y claims
de rol no conceden privilegios. Cambiar la configuración requiere actualizar
los procesos del servidor. No se habilitaron administradores reales.

| GET | Resultado |
| --- | --- |
| `/api/admin/resumen` | Totales de usuarios, publicaciones y conexiones |
| `/api/admin/publicaciones?limite=20&pagina=1` | `items`, `pagina`, `hay_mas`; límite 1..100, página 1..100000 |
| `/web-api/admin?pagina=1` | Adaptador Next: resumen y página de 20 publicaciones |

Las respuestas privadas usan `no-store`. Next toma el token de la cookie
HttpOnly sin exponerlo al navegador; 401 elimina la cookie y 403 conserva
la sesión común. No se publican correos, contraseñas ni participantes de conexiones.
El catálogo público existente conserva su contrato.

## Validación

Resultados ejecutados el 31 de octubre de 2026:

| Comprobación | Resultado |
| --- | --- |
| Backend aislado | 85/85; cuatro avisos de deprecación existentes |
| Frontend: API, autenticación, perfil y administración | 58/58 |
| Proxy Next | 12/12 |
| Navegador + Next + FastAPI + PostgreSQL desechable | 35/35; sin solicitudes externas del navegador |
| Lint, compilación y TypeScript | Correctos |

Las pruebas aisladas usan dobles SQL; el E2E usa PostgreSQL y SMTP STARTTLS
locales con datos sintéticos. No acredita entrega de correo externo ni el
esquema desplegado de Supabase. El conteo de conexiones se probó con tabla vacía.
Los comandos y dependencias están en [README de E2E](../tests/e2e/README.md).

Revisión manual realizada: cuentas ficticias `admin84@example.com` (ID 1) y
`normal84@example.com` (ID 2), registradas y verificadas con SMTP local. Correctos:
panel vacío, totales, 21 publicaciones en dos páginas (20 + 1), actualización,
retorno por teclado, recarga con sesión vigente, denegación a cuenta normal sin
cerrar su sesión y redirección al acceso después de logout. Se ajustó el ancho
mínimo de la tabla para conservar columnas legibles con desplazamiento horizontal.
Compilación aislada y TypeScript repetidos correctamente después del ajuste.
El entorno, las cuentas y los datos sintéticos se eliminaron al finalizar.

Para reproducirla, usar el [entorno manual desechable](../tests/e2e/MANUAL.md):
primera cuenta sintética (ID 1) administradora; segunda cuenta normal.
Comprobar denegación, totales, vacío, paginación, actualización y cierre de sesión.
Los códigos se reciben solo en la terminal. `salir` detiene y limpia el entorno.

## Entrega y pendientes

Base de revisión: `dev-web`, commit `47cd6bd`. Los 15 archivos abarcan router
administrativo, panel/adaptador/rutas Next, enlace de cuenta, pruebas y este documento.
Título propuesto del PR: **SCRUM-84: panel administrativo de consulta y pruebas de integración**.

El equipo debe aprobar los administradores reales y cualquier futura acción de
escritura. Verificación documental, Match, postulaciones y cambios de otros
integrantes quedan fuera. Pendiente revisión visual del equipo y lector de pantalla.
No se hizo commit, push, merge ni se modificó Jira.
