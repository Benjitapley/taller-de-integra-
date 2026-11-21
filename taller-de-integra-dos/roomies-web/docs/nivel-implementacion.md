# Taller de Integración II: nivel de implementación

**Fecha:** 14 de noviembre de 2026. **Base revisada:** rama `main` y cambios locales sin commit.

**Alcance:** aplicación web y servicios de `taller-de-integra-dos/roomies-web`.

**Frontend web: aproximadamente 40%. Backend: aproximadamente 55%.**

El núcleo de acceso, perfiles, publicaciones, postulaciones y conexiones tiene desarrollo real. Se añadió la base API persistente de Convivencia/Mensajería y su coordinación versionada de capacidad. Falta integrar el flujo de aceptación de postulaciones y validar las migraciones contra PostgreSQL antes de considerar operativa la entrega completa.

## Frontend web: aproximadamente 40%

Tiene acceso, edición de perfil, publicaciones, filtros, postulaciones y conexiones con adaptadores HTTP. La interfaz de chat/convivencia aún no está integrada. Administración permite consultar, sin moderar. La verificación disponible confirma el correo, pero no acredita identidad documental; tampoco hay evaluaciones de reputación.

## Backend: aproximadamente 40%

Existen servicios de autenticación/perfil, publicaciones, postulaciones, conexiones y el nuevo servicio de Convivencia/Mensajería, con API, permisos, migraciones y outbox. El ciclo sigue incompleto: el endpoint actual de aceptación todavía no llama a la incorporación; las migraciones y el comportamiento transaccional requieren validación contra PostgreSQL. No hay Realtime, verificación documental ni evaluaciones. El panel administrativo es de consulta; faltan reportes y acciones de moderación. El compose de Supabase está preparado, pero su presencia no acredita un despliegue activo.

## Criterio de estimación

Se revisa únicamente el código de Taller de Integración II, usando como referencia los **ocho bloques funcionales del README principal, con igual peso**. El porcentaje estima cobertura frente a ese alcance del producto; no equivale al cumplimiento de una pauta académica específica de la asignatura. El HTML antiguo y las propuestas de migración no se cuentan como funciones adicionales terminadas.

La escala estima integración funcional: **0** sin integración real demostrable, aunque exista una demo; **25** inicial; **50** parcial; **75** avanzada con brechas o validación pendiente; **100** completa y validada para el bloque. Los porcentajes son un juicio técnico aproximado, no un conteo de pantallas, líneas ni pruebas aprobadas.

| Bloque | Frontend web | Backend |
| --- | ---: | ---: |
| Autenticación y perfil | 75% | 75% |
| Publicaciones y búsqueda | 75% | 75% |
| Postulaciones | 75% | 75% |
| Match y conexiones | 75% | 75% |
| Chat | 0% | 50% |
| Convivencia | 0% | 50% |
| Identidad documental y reputación | 0% | 0% |
| Moderación y administración | 25% | 25% |

Cálculo por capa: frontend 325/800 = 40,625%; backend 425/800 = 53,125%. Los resultados comunicados se redondean al múltiplo de cinco más cercano: **frontend web 40%, backend 55%**. El margen de incertidumbre es relevante; no deben interpretarse como mediciones exactas ni como aceptación académica.

## Evidencia principal

- [Alcance funcional declarado](../../../README.md).
- [Autenticación web](../frontend-next/src/lib/auth/supabase.ts), [edición de perfil](../frontend-next/src/features/perfil/ProfileEditor.tsx) y [publicaciones](../frontend-next/src/lib/publicaciones/server.ts).
- [Postulaciones web e incorporación pendiente](../frontend-next/src/features/publicaciones/Applications.tsx), [conexiones](../frontend-next/src/lib/conexiones/server.ts) y [navegación con chat pendiente](../frontend-next/src/config/navigation.ts).
- [Verificación web limitada al correo](../frontend-next/src/features/perfil/AccountVerification.tsx) y [administración de consulta](../frontend-next/src/lib/admin/server.ts).
- [Rutas del Gateway](../backend/api-gateway/app/local_routes.py), [usuarios/perfil](../backend/services/auth-users-service/app/api/routes/local_users.py), [Listado y reservas de capacidad](../backend/services/listado-applications-service/app/api/routes.py) y [Convivencia/Mensajería](../backend/services/convivencia-mensajeria-service/app/api/routes.py).
- [Contrato y migración de Convivencia](./contracts/convivencia-mensajeria.md), [perfil sin verificación documental](../backend/services/auth-users-service/app/infrastructure/persistence/postgres_profile_repository.py) y [compose Supabase preparado, no activado](../docker-compose.supabase.yml).

## Verificación y límites

La revisión anterior aprobó **264 pruebas aisladas de backend**: 43 de dominio/runtime, 120 del gateway y 101 de auth-users; hubo **2 omitidas** por requerir PostgreSQL opt-in. En esta actualización se añaden pruebas unitarias/API enfocadas en Convivencia y en el enrutamiento del Gateway. No se pudo ejecutar PostgreSQL ni Docker en este entorno; las pruebas aisladas no sustituyen esa validación.

El intento anterior de ejecutar las pruebas del frontend web se detuvo antes de ejecutar sus casos por ausencia de `typescript`. Lint, typecheck, build, recorridos E2E con base de datos y producción no se comprobaron. Los resultados históricos del repositorio no se presentan como pruebas repetidas hoy.

Esta actualización incorpora APIs de Convivencia/Mensajería y de reserva/ocupación, rutas del Gateway, migraciones, pruebas y documentación. No certifica el flujo de aceptación completo hasta integrar S3R-C03.
