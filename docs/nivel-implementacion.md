# Taller de Integración II: nivel de implementación

**Fecha:** 10 de noviembre de 2026. **Base revisada:** repositorio local, commit `af84fba`.

**Alcance:** aplicación web y servicios de `taller de integra dos/roomies-web`.

**Frontend web: aproximadamente 40%. Backend: aproximadamente 40%.**

El núcleo de acceso, perfiles, publicaciones, postulaciones y conexiones tiene desarrollo real. El alcance completo todavía está lejos de terminarse: chat, convivencia, identidad documental, reputación y moderación presentan las brechas más importantes.

## Frontend web: aproximadamente 40%

Tiene acceso, edición de perfil, publicaciones, filtros, postulaciones y conexiones con adaptadores HTTP. Chat está pendiente y no hay convivencia operativa. Administración permite consultar, sin moderar. La verificación disponible confirma el correo, pero no acredita identidad documental; tampoco hay evaluaciones de reputación.

## Backend: aproximadamente 40%

Existen servicios de autenticación/perfil, publicaciones, postulaciones y conexiones, con validaciones, permisos y repositorios PostgreSQL. El ciclo sigue incompleto: aceptar una postulación no incorpora al usuario al arriendo y el adaptador de convivencia está sin implementar. No se encontró chat persistente ni en tiempo real, verificación documental o evaluaciones. El panel administrativo es de consulta; faltan reportes y acciones de moderación. El compose de Supabase está preparado, pero su presencia no acredita un despliegue activo.

## Criterio de estimación

Se revisa únicamente el código de Taller de Integración II, usando como referencia los **ocho bloques funcionales del README principal, con igual peso**. El porcentaje estima cobertura frente a ese alcance del producto; no equivale al cumplimiento de una pauta académica específica de la asignatura. El HTML antiguo y las propuestas de migración no se cuentan como funciones adicionales terminadas.

La escala estima integración funcional: **0** sin integración real demostrable, aunque exista una demo; **25** inicial; **50** parcial; **75** avanzada con brechas o validación pendiente; **100** completa y validada para el bloque. Los porcentajes son un juicio técnico aproximado, no un conteo de pantallas, líneas ni pruebas aprobadas.

| Bloque | Frontend web | Backend |
| --- | ---: | ---: |
| Autenticación y perfil | 75% | 75% |
| Publicaciones y búsqueda | 75% | 75% |
| Postulaciones | 75% | 75% |
| Match y conexiones | 75% | 75% |
| Chat | 0% | 0% |
| Convivencia | 0% | 0% |
| Identidad documental y reputación | 0% | 0% |
| Moderación y administración | 25% | 25% |

Cálculo por capa: 325/800 = 40,625%. Los resultados comunicados se redondean al múltiplo de cinco más cercano: **frontend web 40%, backend 40%**. El margen de incertidumbre es relevante; no deben interpretarse como mediciones exactas. Que ambas capas tengan el mismo promedio no significa que falte el mismo trabajo en cada una.

## Evidencia principal

- [Alcance funcional declarado](../README.md).
- [Autenticación web](../taller%20de%20integra%20dos/roomies-web/frontend-next/src/lib/auth/supabase.ts), [edición de perfil](../taller%20de%20integra%20dos/roomies-web/frontend-next/src/features/perfil/ProfileEditor.tsx) y [publicaciones](../taller%20de%20integra%20dos/roomies-web/frontend-next/src/lib/publicaciones/server.ts).
- [Postulaciones web e incorporación pendiente](../taller%20de%20integra%20dos/roomies-web/frontend-next/src/features/publicaciones/Applications.tsx), [conexiones](../taller%20de%20integra%20dos/roomies-web/frontend-next/src/lib/conexiones/server.ts) y [navegación con chat pendiente](../taller%20de%20integra%20dos/roomies-web/frontend-next/src/config/navigation.ts).
- [Verificación web limitada al correo](../taller%20de%20integra%20dos/roomies-web/frontend-next/src/features/perfil/AccountVerification.tsx) y [administración de consulta](../taller%20de%20integra%20dos/roomies-web/frontend-next/src/lib/admin/server.ts).
- [Rutas activas del gateway](../taller%20de%20integra%20dos/roomies-web/backend/api-gateway/app/local_routes.py), [usuarios/perfil](../taller%20de%20integra%20dos/roomies-web/backend/services/auth-users-service/app/api/routes/local_users.py), [publicaciones y postulaciones](../taller%20de%20integra%20dos/roomies-web/backend/services/listado-applications-service/app/api/routes.py) y [conexiones persistentes](../taller%20de%20integra%20dos/roomies-web/backend/services/match-conexion-service/app/application/service.py).
- [Convivencia sin implementar](../taller%20de%20integra%20dos/roomies-web/backend/services/listado-applications-service/app/infrastructure/clients.py), [perfil sin verificación documental](../taller%20de%20integra%20dos/roomies-web/backend/services/auth-users-service/app/infrastructure/persistence/postgres_profile_repository.py) y [compose Supabase preparado, no activado](../taller%20de%20integra%20dos/roomies-web/docker-compose.supabase.yml).

## Verificación y límites

En esta revisión se aprobaron **264 pruebas aisladas de backend**: 43 de dominio/runtime, 120 del gateway y 101 de auth-users. Hubo **2 omitidas** por requerir PostgreSQL opt-in. La suite de auth-users no pudo recolectarse completa por falta de `cryptography`; las 101 aprobadas corresponden a una repetición que excluyó solamente `test_supabase_jwt_crypto.py`.

El intento de ejecutar las pruebas del frontend web se detuvo antes de ejecutar sus casos por ausencia de `typescript`. Lint, typecheck y build del frontend no se comprobaron. No se instalaron dependencias, no se ejecutaron recorridos E2E con base de datos ni se validó producción. Los resultados históricos del repositorio no se presentan como pruebas repetidas hoy. Esta corrección de alcance conserva los resultados de la revisión anterior; no implica una nueva ejecución de las suites.

Esta entrega añade documentación y un PDF; no modifica código ni añade comentarios al código.
