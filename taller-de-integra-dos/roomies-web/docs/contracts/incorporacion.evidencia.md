# Evidencia de Convivencia v1 - TI2 / dev-web

**Fecha:** 18 de noviembre de 2026, America/Santiago.
**Carpeta:** `taller-de-integra-dos/roomies-web` (con espacios).
**Rama:** `dev-web`. **SHA base:** `616747fa15692d65278b7b31e200f892eba85ac3`.
La entrega queda en el árbol de trabajo, sin commit, push ni PR creados.
No se modificaron otras carpetas del repositorio ni se cambió de rama.

## Entorno y alcance de la prueba

Windows, Python 3.13.15, PostgreSQL 18.6, FastAPI 0.141.1, Pydantic 2.13.5,
Uvicorn 0.53.0, HTTPX 0.28.1, psycopg 3.3.6 y pytest 9.2.0.
Se usó el Python local con las dependencias ya disponibles.
No se leyó dotenv ni se consultaron datos reales de usuarios.

PostgreSQL se inició en un directorio temporal único, puerto aleatorio de
loopback, base `roomies_sprint2_disposable` y rol dedicado. Se aplicó la migración
real y se ensayaron transacciones, índices, trigger y permisos. El runner detuvo
y limpió sus clústeres; no modificó la instancia PostgreSQL del usuario.
Los puertos de Identidad y Listado se simularon: no se declara integración
con proveedores remotos reales ni admisión completa de F01.

## Comandos y resultados sanitizados

Ejecutados desde `taller-de-integra-dos/roomies-web`:

```text
python -I -B backend/api-gateway/tests/run_isolated.py
134 passed

python -I -B backend/local_stack/run_unit.py listado
40 passed in 0.29s

python -I -B backend/services/convivencia-mensajeria-service/tests/run_offline.py
34 passed, 1 warning in 1.12s

python -I -B backend/services/convivencia-mensajeria-service/tests/run_isolated.py
56 passed, 1 warning in 13.01s

python -I -B backend/services/convivencia-mensajeria-service/tests/run_smoke.py
PASS TCP Uvicorn loopback: health=200; GET sin sesion=401;
POST sin dependencias=503; no-store en las 3 respuestas.
```

**230 casos distintos aprobados:** 134 Gateway + 40 Listado + 56 Convivencia.
Los 56 de Convivencia incluyen **34 HTTP/adaptadores y 22 SQL reales**.
El comando offline repite esos 34; no se cuentan dos veces.
La advertencia es de deprecación del cliente HTTPX de Starlette TestClient;
no se cambió la dependencia del proyecto por ese aviso. Los tiempos son
observaciones locales, no una promesa de rendimiento.

Sintaxis Python, exportación OpenAPI y `git diff --check`: aprobados.
Runner sin configuración: salida 1 con mensaje sanitizado, sin migraciones.
Docker no está disponible en PATH: imagen y compose no se ejecutaron.
El PDF se extrae y renderiza para comprobar visualmente todas sus páginas.

## Cambios de integración comprobados

- `run_service.py` registra Convivencia en puerto 8004, DSN/rol propio y check
  de sus cuatro tablas. El arranque no aplica migraciones.
- Gateway permite solo GET en `/api/arriendos/mio` y `/api/arriendos/{id}`;
  nunca expone `POST /internal/incorporaciones`.
- Se corrigió la conservación de `Cache-Control: no-store` en consultas de
  arriendos por gateway, tanto en éxito como en errores 401/403/404/503.
- El consumidor `HttpIncorporations` valida cuerpo, UUID canónico, recibo 201,
  IDs, cabecera replay y códigos conocidos. Los errores ajenos se sanitizan.
- Aceptar en Listado mantiene `incorporacion_pendiente: true`; el consumidor
  está preparado, todavía no conectado automáticamente al flujo F01.
- Overlay `docker-compose.convivencia.yml` independiente. Requiere aplicar
  antes la migración con rol autorizado; el bootstrap anterior no crea el esquema.

## Esquema e índices: revisión y ensayo real

| Invariante / protección | Implementación ensayada |
| --- | --- |
| Un arriendo por publicación | UNIQUE arriendo(id_publicacion). |
| Una pertenencia activa por usuario | Índice UNIQUE parcial sobre usuario WHERE estado='Activa'. |
| Una incorporación por postulación | UNIQUE pertenencia(id_postulacion). |
| Una pertenencia por operación | UNIQUE pertenencia(id_operacion), FK al ledger propio. |
| Idempotencia | PK UUID de incorporacion; payload, estado y recibo persistidos. |
| Capacidad y versión | CHECK positivos, bloqueo local y trigger de pertenencia. |
| Registro terminado consistente | Terminada/Rechazada rechazan http_status NULL, ensayado en PostgreSQL. |
| Recuperación | Intención durable; outbox; índices y rotación por último intento. |
| Permisos | Rol propio sin lectura de otro esquema ni edición de capacidad/estado de pertenencia. |

El rol `sql_convivencia_mensajeria` no es superusuario, dueño del esquema ni
administrador. La migración exige NOINHERIT y ausencia de membresías.
Solo se permite UPDATE de `creado_en` en arriendo para habilitar bloqueo de
fila; capacidad y versión no son editables por el runtime. Las FK quedan dentro
del esquema propio; no hay SQL contra Identidad/Listado.

## Ejemplos exigidos y resultados

Los datos son ficticios, no cuentas ni tokens reales.

| Caso | Resultado de las pruebas SQL |
| --- | --- |
| Usuario 22 ya activo solicita otro arriendo | 409 USER_ALREADY_ACTIVE; no duplica pertenencia; reserva previa se libera por outbox. |
| Dos usuarios compiten por el último cupo | Un 201 y un 409 NO_CAPACITY; solo una pertenencia y un arriendo. |
| Dos publicaciones intentan incorporar al mismo usuario | Solo una incorporación activa. |
| Misma UUID y cuerpo tras recrear servicio | Mismo status/recibo, replay true y una pertenencia. |
| Misma UUID con otro cuerpo | 409 IDEMPOTENCY_CONFLICT. |
| Respuesta de reserva perdida | Se reutiliza la misma reserva y clave al recuperar. |
| Usuario deshabilitado después de perder la reserva | Se resuelve y libera la reserva; no crea pertenencia. |
| Confirmación remota indisponible | Outbox conserva el mensaje; luego lo entrega sin duplicar. |
| Usuario ajeno consulta arriendo | 404, sin revelar el arriendo. |
| SQL directo omite el caso de uso | Trigger/índice impiden sobreocupación y segunda pertenencia activa. |

El proveedor simulado permite comprobar la defensa local de ocupación.
La corrección de reserva/versionado **en Listado real** debe aprobarse
e implementarse por sus responsables antes de activar la integración.

## Reproducción del ensayo SQL

```powershell
python -m pip install -r backend/services/convivencia-mensajeria-service/requirements.txt
python -m pip install -r backend/services/convivencia-mensajeria-service/tests/requirements.txt
python -I -B backend/services/convivencia-mensajeria-service/tests/run_isolated.py
```

El runner encuentra PostgreSQL instalado o acepta `POSTGRES_BIN` apuntando a
su carpeta `bin`. Limpia variables de configuración, usa loopback y crea sus
propios datos desechables. Se corrigió el ejecutor Windows para enviar la salida
de `pg_ctl` a un archivo temporal: así el proceso servidor no mantiene abiertos
los pipes del ejecutor. Los timeouts se informan de forma sanitizada.

El down de la migración es destructivo; no se ejecutó sobre datos útiles.
La API no ejecuta up/down al arrancar.

## Pendientes de aceptación

- Cotejar SRS/contrato 8.3 y ratificar decisiones D; no están disponibles completos.
- Aprobar/implementar habilitación en Auth y reserva/versionado en Listado.
- Conectar la aceptación de Listado y verificar F01 con proveedores reales.
- Obtener revisión y firmas humanas de Listado/Larenas. No se inventaron firmas.
- Construir/ejecutar Docker y comprobar despliegue; no ensayados aquí.
- Jira: a cargo de Benjamín. PR: todavía no creado.

SHA base y hashes de la entrega: `incorporacion.manifest.json`. Los hashes
identifican fuentes/documentación actuales; no se presentan como un commit nuevo.
**Estado: base preparada y ensayada; admisión integrada todavía no Terminado.**
