# SCRUM-72 — integración real desechable

Este lanzador prueba Edge/Chromium → Next.js → FastAPI/Uvicorn → PostgreSQL nativo
y el envío real de `email_service.py` a un receptor SMTP local con STARTTLS y AUTH.
El receptor captura los correos; no los retransmite. No usa TestClient ni dobles
de SQL, autenticación o emisión de JWT.

## Ejecución en Windows

Requisitos: PostgreSQL 18 con initdb/pg_ctl, las dependencias del backend en un
entorno Python aislado, las dependencias adicionales de `requirements.txt`,
Node con las dependencias de `frontend-next` ya instaladas, Playwright y un
binario Edge/Chromium instalado. No se descarga un navegador ni se utiliza un
perfil personal. Los procesos temporales pueden necesitar autorización para
arrancar y cerrarse en un entorno Windows restringido.

Comando comprobado en este equipo:

```powershell
.\.venv\Scripts\python.exe -I -B tests/e2e/run_e2e.py `
  --pg-bin 'C:/Program Files/PostgreSQL/18/bin' `
  --node 'C:/Users/gerla/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' `
  --playwright 'C:/Users/gerla/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright' `
  --browser 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
```

Los cuatro argumentos identifican dependencias **locales**; no se admite un DSN
externo. Si faltan binarios/dependencias o el clúster no puede arrancar, el runner
falla y no intenta acceder a Supabase ni al servicio PostgreSQL ya instalado.

Dependencias adicionales comprobadas: Uvicorn 0.49.0, aiosmtpd 1.4.6 y
cryptography 46.0.7. Sus rangos permiten usar las versiones fijadas por el backend;
no se modificó su archivo de requisitos ni configuración de producción.

## Aislamiento y limpieza

- Entornos de los procesos construidos desde una lista de variables del SO;
  se descartan credenciales, proxies, NODE_OPTIONS y configuración heredada.
- PostgreSQL inicializado en directorio temporal, puertos libres, escucha solo
  127.0.0.1; nunca utiliza el servicio existente. `trust` se usa solo en este
  clúster efímero sintético. La aplicación conecta como `e2e_backend`, sin
  superuser/BYPASSRLS; el propietario solo prepara/inspecciona las fixtures.
- Cuatro tablas de negocio sintéticas con los campos que utiliza el backend,
  seguidas de preflight, migración V2 y postflight sin alteraciones del SQL.
  Los tipos de las fixtures no certifican el esquema real del proveedor.
- Secretos JWT/HMAC independientes, contraseña DB y SMTP, clave de control y
  certificado TLS generados para cada ejecución. Se eliminan al finalizar.
- Lecturas `.env*` bloqueadas en Python; dotenv desactivado antes de importar
  FastAPI. Se copia una aplicación Next temporal sin archivos `.env*`; no se
  arranca Next desde la aplicación habitual ni se comparte su `.next`.
- El backend limita psycopg al DSN generado, SMTP al receptor local y sockets/DNS
  a loopback. Next carga `network-guard.cjs` para impedir sockets/DNS externos.
  Playwright bloquea HTTP/WebSocket de la aplicación fuera del origen Next.
  Chromium usa un contexto nuevo y se desactivan servicios de fondo habituales.
- El receptor exige STARTTLS y credenciales ficticias. El certificado se confía
  mediante `SSL_CERT_FILE` solo en el proceso backend; no se desactiva la
  validación TLS. Solo se capturan destinatarios `@example.com`.
- El control de fixtures tiene puerto y clave aleatorios; pertenece al lanzador,
  nunca se monta en Next/FastAPI ni se entrega a JavaScript del navegador.
- La clave, el DSN y los códigos no se escriben al informe. La cookie HttpOnly
  solo se inspecciona desde el driver Playwright; el código de la aplicación no
  recibe el JWT. El control genera un JWT vencido únicamente para la prueba
  negativa, sin proporcionar una forma alternativa de iniciar sesión.
- `finally` detiene los árboles de procesos creados, SMTP, servidor de control
  y PostgreSQL, y elimina clúster, certificados y aplicación temporal. Desvincula
  primero la junction de node_modules. Un fallo de limpieza hace fallar el runner.

## Recorridos comprobados

Las comprobaciones de formularios, sesión y navegación usan un navegador real.
La página `/perfil` y `GET /web-api/perfil` se prueban con la cookie real HttpOnly, sin proporcionar Bearer a JavaScript. Las pruebas de propiedad/CRUD del backend anterior usan HTTP a través de los rewrites de Next con el
Bearer obtenido por el **driver** de la cookie HttpOnly, nunca por JavaScript.
Esto prueba permisos del backend real, sin afirmar que el HTML antiguo ya tenga
un transporte de sesión web adaptado.

1. Rutas privadas y sesión rechazan usuarios anónimos.
2. Registro desde formulario crea cuenta Argon2 pendiente y entrega SMTP local.
3. Código incorrecto devuelve 400 y conserva intentos en PostgreSQL.
4. Reenvío temprano devuelve 429; tras avanzar el tiempo de las filas sintéticas
   por el control se permite reenviar. No se cambia el cooldown del backend.
5. Verificación desde formulario consume el código y verifica la cuenta, sin sesión.
6. Contraseña incorrecta devuelve 401 sin cookie.
7. Login desde formulario llega a Inicio; cookie HttpOnly/Strict y consulta real
   de sesión identifican al usuario. JSON de login no devuelve JWT.
8. Segunda cuenta/contexto de navegador independientes completan el mismo flujo.
9. Perfil consulta/modifica solo el usuario del JWT, ignorando IDs ajenos aportados.
10. Creación/listas de publicaciones propias quedan separadas entre ambas cuentas.
11. Detalle usado para editar exige Bearer y propietario: 401 anónimo, 404 ajeno.
12. Edición/borrado ajenos fallan; los propios funcionan sin alterar la otra cuenta.
13. Catálogo de descubrimiento conserva su contrato público sin credenciales.
14. JWT firmado pero vencido se rechaza por Next y FastAPI.
15. Sesión revocada se rechaza aunque la firma/expiración del JWT sean válidas.
16. Logout desde navegador revoca en PostgreSQL y borra la cookie.
17. SMTP 451 produce 503 sin éxito ficticio; cuenta pendiente conservada y código
    no entregado consumido. No hay correo capturado ni sesión.
18. Recuperación del servicio SMTP permite reenviar/verificar/login de esa cuenta.
19. Origin ajeno o cabecera CSRF ausente rechazan logout sin alterar la sesión.
20. Alias `/auth/login`, barra final, codificación y caminos a través de otros
    namespaces no pueden entregar el contrato JWT al navegador.
21. LocalStorage/sessionStorage/document.cookie y cuerpos públicos carecen de JWT.
22. Sin errores JavaScript ni peticiones externas de la aplicación en el navegador.

### Ampliación final del perfil: 27/27

Los 22 recorridos anteriores se conservan y se amplían cinco casos:

- Abrir `/perfil` desde Sidebar y UserMenu, comprobar el handler real y los ocho campos normalizados, avatar cuando falta foto y ausencia de edición.
- Comparar las páginas/JSON de A y B, ignorando IDs ajenos en query, confirmar `no-store` y rechazar POST/PUT/DELETE en `/web-api/perfil`.
- Recargar el perfil y ver los datos de PostgreSQL y el conteo real de publicaciones.
- Cambiar los conteos de A/B mediante las fixtures de publicaciones y comprobar que no se comparte caché.
- Hacer logout de A y login de B en el mismo contexto; el perfil de A no reaparece.

Los casos de rechazo anónimo, expiración, revocación y logout también comprueban
`/perfil` y `/web-api/perfil`. La regresión de PUT del backend anterior solo toca
fixtures del clúster temporal: no añade una interfaz ni comportamiento nuevo de
edición de perfil, y no constituye implementación de SCRUM-78.

## Límites antes de conectar un proveedor real

- Esta ejecución usa `next dev` en HTTP loopback y su cookie de desarrollo. La
  cookie Secure/`__Host-` tiene pruebas unitarias; falta repetir bajo HTTPS con
  build/start y el reverse proxy definitivo. No se desactiva Secure en producción.
- Falta comprobar el esquema/ACL/RLS y las restricciones reales mediante revisión
  autorizada. No se consultó Supabase ni se certificó su configuración de red.
- Los clientes HTML anteriores y publicaciones todavía necesitan un transporte servidor
  que use la cookie; la consulta React de perfil ya utiliza su handler propio; no se les devuelve un token para conservar el patrón antiguo.
- Las imágenes subidas, búsquedas externas, conexiones, recuperación de cuentas
  antiguas y cargas masivas quedan fuera de este recorrido.
- Coordinar con Francisco y los consumidores los dos cambios descritos en
  `RESULTS.md`; preservar el catálogo público es una decisión funcional distinta
  de restringir la consulta privada usada por el editor.
