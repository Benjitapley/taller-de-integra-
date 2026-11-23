# SCRUM-113 · Envío y seguimiento de reportes web

Rama creada desde Jira: `SCRUM-113-Añadir-envío-y-seguimiento-de-reportes-en-web`.
Base: `origin/dev-web`, `ed41d33`. Dependencia: SCRUM-95 de Valderrama, ya
integrada en esa base. Alcance: S3R-D03 del backlog v1.4 revisado el 18/11,
página 25, y contrato de microservicios v2, sección de reportes.

## Comportamiento

- Reportar una publicación desde su detalle o una persona desde su contexto.
  En Mi arriendo se añadió el acceso a reportar integrantes consultados mediante
  Convivencia. Los permisos de pertenencia y relación se deciden en los servicios.
- Categorías de nuevos envíos: Conducta inapropiada, Incumplimiento de reglas y
  Otro. Descripción obligatoria de hasta 1000 caracteres; un solo objetivo.
- Confirmación de éxito únicamente tras una respuesta 201 válida y coherente
  con el objetivo/texto enviado. Los errores conservan el formulario; reportar
  no cierra, modifica ni oculta una publicación.
- Reintentar el mismo contenido reutiliza `Idempotency-Key`. El BFF exige una
  clave válida, el Gateway la conserva solo para este POST y el servicio registra
  la respuesta por denunciante/clave en una transacción. Contenido distinto con
  la misma clave devuelve 409. Los reintentos concurrentes no insertan dos filas.
- Mis reportes carga páginas del servidor, conserva filas si falla la página
  siguiente, reintenta esa misma página, elimina duplicados y diferencia vacío
  inicial de final de lista. Actualizar estados vuelve a consultar la API.
- Las respuestas web filtran notas administrativas, denunciante, correo y campos
  ajenos al contrato. La identidad sale de la cookie HttpOnly, nunca de un ID
  enviado en el formulario.

Se reutilizó el código de SCRUM-95/96 existente. La corrección de idempotencia en
Reportes y Gateway fue necesaria: el formulario anterior no enviaba clave, el
Gateway la descartaba y el INSERT del servicio no deduplicaba solicitudes.

## Configuración y despliegue

No se modificaron bases compartidas, Render, Vercel, `main`, `dev-web` ni las
ramas 111/112. No se copian credenciales a este documento ni al navegador.

Antes de habilitar la función en un entorno integrado:

1. El servicio Reportes necesita su rol aislado `sql_reportes`, los esquemas de
   SCRUM-95/96 y la migración aditiva `003_envio_idempotente.up.sql`. No borrar ni
   recrear tablas existentes. La suite local aplica las tres migraciones en una
   base nueva desechable; este trabajo no las aplicó en Supabase/Kubero.
2. Configurar `REPORTES_DATABASE_URL`, `REPORTES_CURSOR_SECRET`, las claves por
   pareja de servicios y sus upstreams según `backend/services/.env.example`.
   Las claves deben coincidir en los destinatarios. Mantener validación TLS.
3. Configurar `REPORTES_UPSTREAM_URL` en Gateway y publicar servicio/Gateway de
   esta versión. El servicio puede arrancarse con `backend/services/run_service.py
   reportes --env-file <archivo-privado>`; `--check` solo comprueba conectividad,
   tablas y proveedor de identidad, sin ejecutar migraciones.
4. Activar `WEB_REPORTES_ENABLED=true` en Next junto con su configuración real de
   sesión/Gateway. La opción queda desactivada en `.env.example` hasta que el
   entorno esté preparado. Convivencia debe exponer la consulta paginada de
   integrantes para usar el acceso desde Mi arriendo; una ruta inexistente muestra
   error recuperable y no se sustituye por una lista ficticia.
5. Probar con cuentas reales: publicación ajena, usuario relacionado/no relacionado,
   correo no verificado, nueva sesión y actualización administrativa del estado.

La comprobación de disponibilidad del 22/11 obtuvo 404 en
`https://taller-de-integra-frontend-next.vercel.app/web-api/reportes` y timeout
al consultar `/api/reportes/mios` en el Gateway de Render. Esto no acredita una
prueba autenticada ni permite afirmar que esta versión ya funciona en producción.

## Verificación reproducible

Desde `frontend-next`:

```powershell
node --test tests/reportes.test.mjs tests/admin-reportes.test.mjs
npm run typecheck
npm run lint
npm run build:isolated
```

Desde la raíz del repositorio:

```powershell
.\.venv\Scripts\python.exe -I -B taller-de-integra-dos/roomies-web/backend/services/reportes-service/tests/run_isolated.py
.\.venv\Scripts\python.exe -I -B taller-de-integra-dos/roomies-web/backend/api-gateway/tests/run_isolated.py
```

La suite de Reportes ejecuta PostgreSQL efímero con rol dedicado, sin dotenv ni
acceso a la base real. Cubre persistencia, 12 solicitudes concurrentes de la misma
operación, 43 reportes paginados, clave reutilizada con otro contenido, aislamiento
entre cuentas, actualización de estado y ausencia de notas internas en la API pública.

La prueba `tests/reportes-browser.test.mjs` usa Next y el BFF reales con un
transporte HTTP ficticio identificado. Requiere rutas locales explícitas en
`REPORTS_PLAYWRIGHT_PATH` y `REPORTS_BROWSER_PATH`; sin ellas queda omitida, no
aprobada. Comprueba formulario, recuperación de página fallida, contenido conservado,
reintento de respuesta perdida sin duplicar, recarga y acceso desde un integrante.
El indicador Insight de Next se cierra mediante su control para no tapar botones
en la vista móvil; no se desactivan los errores de aplicación.

Estas pruebas no equivalen a la evidencia del entorno final requerida por
SCRUM-116. No declarar cerrada la validación remota sin ejecutar el punto 5.

Resultados locales del 22/11:

| Comprobación | Resultado |
|---|---|
| Suite web completa | 117 aprobadas, 0 fallos; navegador omitido en ese comando |
| Navegador con dependencias explícitas | 1 aprobada; móvil/tableta/escritorio, sin errores de página |
| Reportes con PostgreSQL efímero | 8 aprobadas |
| Gateway | 135 aprobadas |
| TypeScript, ESLint y build aislado | Aprobados |

La prueba de navegador verifica Next/BFF con un servicio HTTP ficticio; la
persistencia/concurrencia se verificó aparte en el servicio real con PostgreSQL
efímero. No describir ambas pruebas como un recorrido completo por servicios
desplegados. El estado de la tarea en Jira no se modifica automáticamente al
publicar esta rama o abrir su PR.
