# SCRUM-72 — resultado integral, 2026-10-24

**PostgreSQL 18.6 desechable + FastAPI real + Next.js 16.4.3 + Edge headless +
SMTP local STARTTLS/AUTH. Sin Supabase, datos ni credenciales de producción.**

La primera ejecución completó 19/22 comprobaciones y detectó dos problemas:

1. `GET /api/publicaciones/{id}` servía datos del editor sin autenticar. Se añadió
   la dependencia JWT y el filtro por propietario en la consulta parametrizada.
   Ahora devuelve 401 sin sesión, 404 para un propietario ajeno y 200 para el
   propietario. Se añadió `Cache-Control: no-store` y regresión backend.
2. El rewrite `/auth/*` entregaba la respuesta JWT de FastAPI directamente a JS.
   Se retiró ese namespace del proxy y se añadió una ruta local que devuelve 410.
   El navegador debe usar `/web-api/auth/*` con CSRF/cookie HttpOnly. FastAPI
   conserva su contrato de JWT servidor-servidor y no se cambió su login JSON.
   La comprobación de ausencia de JWT fallaba como consecuencia de esta misma fuga.

La ejecución final pasó **22/22**, incluyendo alias y rutas codificadas a través
de otros namespaces. La ampliación encontró un rechazo legítimo HTTP 405 del
router: se ajustó la expectativa de la prueba para admitir ese rechazo, manteniendo
obligatoria la ausencia de JWT y prohibiendo respuestas satisfactorias. Cero
peticiones externas de la aplicación en el navegador. Cualquier fallo hace salir
al runner con código 1.

Otras verificaciones aprobadas tras las correcciones:

| Verificación | Resultado |
| --- | --- |
| Lint, typecheck, build de Next.js | Aprobados |
| Pruebas unitarias API/validación/gateway Next | 35 aprobadas |
| Suite HTTP con Next y doble de backend | 10 escenarios + contenedor aprobados |
| Backend aislado con dobles | 63 aprobadas |
| Consistencia estática de migración V2 | 11 aprobadas |

La migración V2, preflight y postflight se ejecutaron sin cambiar sus scripts,
solo en el clúster recién creado. La prueba ejercita el lifespan real de FastAPI
y SQL/transacciones del backend con un rol no privilegiado. Los únicos cambios
de tiempo/token los realiza el control sobre fixtures para probar cooldown y
expiración; no se modifica el comportamiento productivo ni se simulan éxitos.

El catálogo `GET /api/publicaciones` sigue siendo público para descubrimiento;
las listas propias, detalle de edición y operaciones de gestión exigen identidad
y propietario. No afirmar que todo contenido del catálogo es privado.

Los servidores temporales y contextos de navegador se cerraron y sus directorios
se eliminaron al terminar, también en la ejecución que detectó fallos. No hubo
peticiones externas de la aplicación en el navegador. Quedan avisos de deprecación
de dependencias (Starlette/Pydantic/aiosmtpd); no fallos funcionales.

## Coordinación pendiente

- Consumidores web de `/auth/*`: migrar a `/web-api/auth/*`; 410 es deliberado y
  evita devolver JWT a JavaScript. No afecta al consumidor servidor de FastAPI.
- Consumidores de detalle del editor: añadir Bearer en servidor y tratar 401/404.
  El HTML antiguo no se modifica; su integración segura sigue pendiente.
- Confirmar con Francisco el alcance de los endpoints públicos de descubrimiento
  y mantener aislado el backend de autenticación respecto a clientes web directos.
- Repetir en HTTPS con proxy definitivo, revisar ACL/RLS del entorno aprobado y
  acordar recuperación de cuentas antiguas antes de habilitar integración real.


## Validación final con perfil — preparación del commit local

Se ejecutó nuevamente el clúster propio con preflight, migración V2 y postflight,
autorizados exclusivamente sobre esta base desechable. **27/27 recorridos aprobados**,
cero peticiones externas de la aplicación en el navegador y limpieza completa.
Se conservan los 22 originales y se agregan cinco comprobaciones de la consulta
React de perfil, campos reales/estadísticas, navegación, aislamiento entre cuentas,
rechazo de escritura y cambio de cuenta dentro del mismo navegador. Los recorridos
anónimo/expirado/revocado/logout ahora verifican también página y handler de perfil.

No aparecieron errores funcionales nuevos: no fue necesario cambiar contratos ni
lógica de producción. Se actualizaron el driver E2E y comentarios/documentación
que todavía hablaban de una integración futura o de SQL nunca ejecutado. No se
modificó el cuerpo de la migración, no se usó Supabase y no se implementó edición.

Verificaciones finales de esta revisión:

| Comprobación | Resultado |
| --- | --- |
| E2E real con perfil | 27/27 |
| Lint, typecheck, build | Aprobados |
| Next API/validación/gateway/perfil | 45 pruebas aprobadas |
| HTTP + perfil en navegador con backend simulado | 12 escenarios + contenedor aprobados |
| Backend aislado | 63 pruebas aprobadas |
| Consistencia SQL estática | 11 pruebas aprobadas |
| git diff --check | Sin errores |

Revisión de Git y lista exacta de candidatos: `COMMIT-REVIEW.md`. No se ejecutó
`git add`, commit, push, merge, cambio de rama ni creación de Pull Request.
