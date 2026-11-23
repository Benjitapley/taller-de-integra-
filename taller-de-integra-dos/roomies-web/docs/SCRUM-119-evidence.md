# SCRUM-119 · Mi arriendo e integrantes

## Implementado en el checkout

- `GET /api/arriendos/{id}` y la vista del dueño resuelven acceso en el servicio: integrante activo o dueño verificado. El rol admin no concede acceso por sí solo.
- `GET /api/arriendos/{id}/integrantes` consulta el backend y pagina con `limite` (20 por defecto, 1–100) y cursor firmado ligado a usuario, arriendo y filtro `activos`.
- La pantalla consulta publicación, capacidad y miembros; distingue carga, 404 y error. Respuestas upstream fallidas o incompletas no se convierten en listas vacías ni en capacidad asumida.
- La aceptación confirmada conserva el enlace a `/mi-arriendo`; la carga vuelve a consultar API al recargar.

## Alcance que sigue pendiente

**Chat y tareas para integrantes no están implementados en esta rama:** faltan API y pantallas. Tampoco puede demostrarse que el dueño no pueda abrir conversaciones, ni que un integrante logre entrar a chat/tareas. La revocación de esos accesos al retirar a una persona queda pendiente. Esta entrega no declara cumplimiento completo de FR-48/50 o BR-11/25/74.

**Verificación integrada pendiente:** las pruebas de permisos ejercitan reglas de servicio con repositorio controlado; las pruebas de 403/503 del BFF usan respuestas simuladas. Falta repetir los escenarios con el Gateway, Convivencia y dependencias desplegados.

## Preparación para integrar en `dev-web`

- Rama fuente limpia: `SCRUM-119-dev-web`, basada directamente en `origin/dev-web` SHA `0bffc08e81d8e036a2dec23e92f29b54f9ff068f`.
- La tarea E02 se reaplicó desde sus dos commits funcionales y se resolvieron los conflictos conservando los contratos actuales de `dev-web`.
- Las nuevas rutas y componentes quedaron bajo `taller-de-integra-dos/...`; se eliminó la copia accidental bajo `taller de integra dos/...`.
- La rama local tiene una sola base común con `origin/dev-web`, evitando el error de GitHub `multiple merge bases found`. Aún no está publicada y no se ha creado un PR.

## Evidencia local sanitizada

Entorno: Windows, PowerShell, Node `v24.20.0`, Python `3.14.7` usando `venv` del repositorio. Los resultados previos corresponden a la rama original `SCRUM-119-Conectar-Mi-arriendo-e-integrantes`; se repetirá la validación focalizada en `SCRUM-119-dev-web` antes de publicarla.

```text
frontend-next> node --test tests/arriendos.test.mjs
5 tests passed, 0 failed

frontend-next> node node_modules/next/dist/bin/next typegen
Types generated successfully

frontend-next> node node_modules/typescript/bin/tsc --noEmit
exit 0

roomies-web> python -c "import ast,pathlib; ..."
Python AST: 5 files parsed

roomies-web> git diff --check
exit 0

roomies-web> venv/Scripts/python.exe backend/services/convivencia-mensajeria-service/tests/run_offline.py
41 passed

backend/api-gateway> venv/Scripts/python.exe -m pytest tests/test_convivencia_routes.py -q
16 passed
```

La suite Convivencia usa su runner offline y no acredita PostgreSQL. La prueba de regla de acceso usa un repositorio controlado: verifica que integrante y dueño verificado pueden consultar, y que un actor sin membresía —incluido un admin sin membresía— es rechazado. La prueba BFF de arriendo ajeno y el caso 503 usan transporte simulado; no equivalen a pruebas contra un servicio desplegado. No se certifica aquí el caso 503 de producción.

## Seguimiento

- Jira: `SCRUM-119` (la URL del proyecto Jira no está configurada en el repositorio).
- Pull request: no creado.
- Rama original: [SCRUM-119-Conectar-Mi-arriendo-e-integrantes](https://github.com/Benjitapley/taller-de-integra-/tree/SCRUM-119-Conectar-Mi-arriendo-e-integrantes). La rama preparada para el PR es `SCRUM-119-dev-web`.
