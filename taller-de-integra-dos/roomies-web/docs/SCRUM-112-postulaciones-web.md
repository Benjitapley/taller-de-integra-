# SCRUM-112 · Postulantes e ingreso desde web

Rama existente de Jira: `SCRUM-112-Completar-la-gestión-de-postulantes-y-el-ingreso-desde-web`.
PR: [#41](https://github.com/Benjitapley/taller-de-integra-/pull/41), destino `dev-web`.
Reconciliada con `dev-web` en `2d8d32c`; conserva la aceptación de SCRUM-107,
commit `225433f`, y la limpieza del PR #60.

Alcance: S3R-D02 del backlog TI2 v1.4 revisado el 18/11, páginas 24–25.
Se conserva el flujo Next/BFF/Gateway y la incorporación de Convivencia de
SCRUM-124. Las rutas y los cambios se mantienen en la carpeta con guiones.

## Comportamiento

- Postular, consultar listas propias o postulantes, preseleccionar, rechazar y
  retirar una postulación. El retiro es una operación propia del postulante con
  motivo fijo; el arrendador no envía `Cancelada` mediante la decisión de estado.
- El retiro repetido del mismo ID devuelve el resultado existente, sin repetir
  la actuación. Una incorporación pendiente o una aceptación confirmada impiden
  retirarlo. El servicio conserva el orden de bloqueos publicación/postulación.
- Listas privadas con `limite` 1–100, `cursor` opaco y filtro `estado` opcional.
  La web pide páginas de 20. La API mantiene el arreglo anterior cuando no se
  pide paginación, para no romper clientes existentes. El BFF normaliza ambas
  respuestas a `items` y `siguiente_cursor`.
- Cursor firmado por cuenta, publicación y filtros; orden descendente por fecha
  e ID de postulación. Los permisos del dueño se comprueban antes del cursor.
  El repositorio consulta filas por keyset, sin cortar el recorrido en 100.
- Si falla una página, se conservan las filas y se reintenta el mismo cursor.
  Se eliminan duplicados por ID; al revocar el acceso se retiran las filas
  privadas de pantalla. Los postulantes siguen separados de los integrantes.
- La aceptación conserva el protocolo de la 107: UUID por operación, consulta
  autorizada de detalle antes de repetir, respuesta 202 mientras está pendiente,
  y misma clave después de una respuesta perdida o una recarga. No se guardan
  credenciales ni operaciones de cuenta en sessionStorage/localStorage.
- `Aceptada` solo se presenta como incorporación confirmada si hay arriendo
  válido, `incorporacion_pendiente=false` y operación coherente. Un conflicto
  terminal exige un intento explícito nuevo; no genera un éxito ficticio.
- Mi arriendo adapta el DTO real de la 124 (`ocupacion`, `cupos_totales`,
  `version_capacidad`). La ocupación y los cupos disponibles proceden de ese
  resultado. La consulta de la 124 solo entrega pertenencias activas; el BFF
  representa ese resultado como Activo y filtra los campos privados.
- Gateway conserva una sola Idempotency-Key al reportar y reenvía las operaciones
  de postulaciones al servicio Listado. No se cambiaron límites ni autorización
  para hacer pasar las pruebas.

## Verificación local

Desde `frontend-next`:

```powershell
node --test tests/*.test.mjs
npm run typecheck
npm run lint
npm run build:isolated
```

La ejecución completa con las opciones de navegador explícitas obtuvo 133
aprobadas y una omitida: la prueba separada de reportes en navegador no se
acredita con ese comando. Después se amplió el caso de navegador de aceptación
para recorrer 41 filas, fallar la segunda página, conservar filas, reintentar y
llegar al final sin duplicados. La ejecución separada de `tests/proxy.test.mjs`
con `APPLICATIONS_BROWSER_TESTS=1` obtuvo 13 aprobadas. Estos casos usan Next/BFF
reales y un doble HTTP identificado, no servicios desplegados.

Desde la raíz del repositorio:

```powershell
.\.venv\Scripts\python.exe -I -B taller-de-integra-dos/roomies-web/backend/services/listado-applications-service/tests/run_isolated.py
.\.venv\Scripts\python.exe -I -B taller-de-integra-dos/roomies-web/backend/api-gateway/tests/run_isolated.py
.\.venv\Scripts\python.exe -I -B taller-de-integra-dos/roomies-web/tests/integration/run_c03.py --web
```

Listado: 62 aprobadas con PostgreSQL temporal real, incluidos más de 100
postulantes con fecha empatada, aislamiento de cursores y retiro idempotente.
Gateway: 145 aprobadas. TypeScript, lint y compilación aislada aprobados.

El ensayo `--web` añade sesiones separadas de dueño, postulante y tercero ante
Next/BFF, Gateway, Auth/Users, Listado y Convivencia reales, con PostgreSQL nuevo
efímero. Comprueba postulación, retiro repetido, rechazo, preselección, aceptación,
consulta de Mi arriendo, reintentos sin segunda pertenencia y permisos ajenos.
La identidad externa es un proveedor HTTP simulado explícito: no es Supabase
Cloud. C03 comprueba además último cupo concurrente, pertenencia única, timeout,
confirmación interrumpida y recuperación después de reiniciar Listado.

Los cortes de red intencionales pueden emitir WinError 10053 en el proxy de
prueba. Los procesos y la base temporal se detienen al finalizar. No se cargan
archivos dotenv en estos ensayos ni se usan cuentas reales.

## Límites y entorno habitual

No se aplicaron migraciones ni se modificaron registros en bases compartidas.
El entorno habitual todavía necesita las migraciones de la 106/107/124, roles,
claves internas coincidentes, firma estable de cursores y destinos locales o
remotos de los servicios. El ensayo aislado no prepara esa base habitual.
No se acredita con estas pruebas la versión publicada ni la persistencia tras
un despliegue: esa validación sigue en SCRUM-116.

La corrección local independiente de perfil se conservó mediante stash y parche
privado; no se incluye en esta entrega ni se fusionó la 111. No se modifica
Integración 4, main, Vercel, buckets ni el `frontend-next/` sin seguimiento de la
raíz. El PR permanece para revisión hasta autorizar su fusión.
