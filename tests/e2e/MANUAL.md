# Desarrollo manual aislado — SCRUM-78

Este modo permite probar el registro, correo simulado, login y edición de perfil
desde el navegador habitual. Reutiliza la infraestructura E2E; no usa el `.env`
del repositorio, Supabase, el PostgreSQL instalado como servicio ni correo externo.
No cambia las credenciales del proyecto ni el sistema de autenticación.

## Iniciar desde PowerShell en Windows

Desde la raíz del repositorio:

```powershell
cd C:\Users\gerla\taller-de-integra-
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\e2e\start-manual.ps1
```

`ExecutionPolicy Bypass` solo se aplica a ese proceso de PowerShell, no modifica
la política del equipo. También puedes ejecutar `& .\tests\e2e\start-manual.ps1`
si tu política ya permite scripts locales.

El lanzador comprueba estas dependencias locales, sin descargarlas:

- `.venv/Scripts/python.exe`, con las dependencias del backend y
  `tests/e2e/requirements.txt` instaladas.
- PostgreSQL 18: `C:/Program Files/PostgreSQL/18/bin` (`initdb.exe`, `pg_ctl.exe`).
- Node: `C:/Program Files/nodejs/node.exe`, con `frontend-next/node_modules` existente.

Si tus rutas son diferentes:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\e2e\start-manual.ps1 `
  -PgBin 'C:/Program Files/PostgreSQL/18/bin' `
  -Node 'C:/Users/gerla/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
```

Para evitar abrir el navegador automáticamente, agrega `-NoOpen`. No se necesita
Playwright para el uso manual. El comando equivalente sin wrapper es:

```powershell
.\.venv\Scripts\python.exe -I -B tests/e2e/run_e2e.py --manual `
  --pg-bin 'C:/Program Files/PostgreSQL/18/bin' `
  --node 'C:/Program Files/nodejs/node.exe'
```

## URL y recorrido

La terminal muestra y abre una URL como:

```text
MANUAL_URL=http://127.0.0.1:PUERTO/registro
```

**Usa la URL exacta que imprime tu sesión.** El puerto es libre y cambia en cada
arranque. No utiliza el Next.js que pudiera estar abierto en 3000. No reemplaces
`127.0.0.1` por `localhost`: el origen debe coincidir para la cookie y CSRF.

1. Registra una cuenta ficticia, por ejemplo `roomie@example.com`, nombre de
   prueba y fecha de nacimiento sintética de una persona mayor de edad.
2. Usa la contraseña aleatoria de prueba sugerida en esa terminal; no reutilices
   contraseñas personales. La sugerencia no crea ninguna cuenta automáticamente.
3. En `/verificar`, introduce el mismo correo y el código recibido en la terminal.
4. Inicia sesión desde `/`. La confirmación no inicia sesión automáticamente.
5. Abre `/perfil` y comprueba «Correo verificado» en «Verificación de cuenta».
6. Pulsa «Editar perfil», modifica los campos y selecciona una imagen sintética.
   Guarda y recarga para comprobar la persistencia dentro de la sesión temporal.

Solo se admiten direcciones `@example.com`, incluido el login y reenvío. No se
envía nada al dominio: SMTP captura el mensaje en memoria y nunca lo retransmite.
Los códigos se muestran únicamente en la terminal del runner de desarrollo:

```text
CORREO LOCAL "roomie@example.com" | código: 012345
```

Para volver a consultar el último código recibido por cada cuenta, escribe:

```text
correos
```

El comando muestra el último recibido, aunque ya haya sido utilizado o expirado;
no crea ni renueva códigos. Siguen vigentes las restricciones reales: seis
dígitos, 15 minutos por defecto, cinco intentos, 60 segundos entre envíos y cinco
envíos por hora. La sesión JWT dura 15 minutos por defecto; vuelve a hacer login
si expira. No hay bypass de usuarios ni de verificación.

## Detener y limpiar

Mantén abierta la terminal durante las pruebas. Para detener, escribe:

```text
salir
```

También funciona `Ctrl+C` o el fin de stdin. Espera la confirmación:

```text
PASS cleanup: owned servers stopped; temporary app, cluster and credentials removed
```

Se detienen los árboles de procesos Next.js/FastAPI creados por el runner, SMTP y
el clúster PostgreSQL temporal. Se retira la junction de dependencias antes de
eliminar la copia de la app, y se eliminan DB, imágenes, logs, certificado y claves.
El navegador puede conservar una pestaña/cookie de un puerto que ya no responde;
los datos y sesiones del servidor se destruyen. Una nueva ejecución empieza vacía.

Utiliza `salir` o `Ctrl+C` y espera la limpieza antes de cerrar la ventana. El cierre
forzado del proceso, un corte eléctrico o `taskkill /F` no permiten garantizar la
ejecución de `finally`; no son mecanismos de parada admitidos.

## Aislamiento

- Entorno de los hijos construido con una lista de variables del SO: descarta
  credenciales, proxies y configuración heredada. Python se ejecuta con `-I -B`.
- `.env*` no se copia ni se permite leer en Python; dotenv se desactiva antes de
  importar la aplicación. Next usa una copia temporal, sin esos archivos.
- PostgreSQL se inicializa en `%TEMP%/haycupo-manual-*`, puerto libre, escucha
  exclusivamente en `127.0.0.1`. La migración V2, preflight y postflight se aplican
  solo allí. El usuario de aplicación no es superusuario ni tiene BYPASSRLS.
- JWT, HMAC, DB, SMTP y TLS se generan por sesión. Se habilitan JWT y autenticación
  web solo en los entornos de procesos creados; no se escriben archivos de entorno.
- FastAPI limita psycopg al DSN generado, SMTP a su puerto local y DNS/sockets a
  loopback. Next carga la barrera de red externa del E2E. Se prueban las barreras
  al arrancar y un fallo impide continuar.
- SMTP requiere STARTTLS y autenticación, usa un certificado efímero confiado solo
  por el backend y únicamente captura destinatarios sintéticos.
- La copia Next está en `frontend-next/.proxy-test-manual-*`. No comparte `.next`
  ni bloqueos con el servidor habitual. Si cambias código fuente, reinicia el
  entorno manual para copiar los cambios nuevos.
- El modo manual no inicia el servidor de control privado de fixtures del E2E.
  La consulta de correo es solo de terminal; no se añade un endpoint de códigos
  a FastAPI, Next ni producción.
- Si un hijo termina inesperadamente, el runner retira el resto. La limpieza
  valida las rutas absolutas y solo detiene procesos creados por su ejecución.

## Pruebas

```powershell
node --test tests/e2e/manual.test.mjs
```

Las pruebas requieren Playwright y Edge locales, según `README.md`. Sus rutas
pueden configurarse con `MANUAL_PLAYWRIGHT_PATH`, `MANUAL_BROWSER_PATH` y
`MANUAL_PG_BIN`. No se usan para ejecutar la sesión manual normal.

Se comprueban registro, captura SMTP, verificación, cookie HttpOnly, login, perfil,
foto/edición persistente, rechazo de correos externos, variables heredadas falsas,
almacenamiento del navegador, cierre de los cuatro puertos y ausencia de nuevos
directorios temporales después de `salir`, EOF y SIGINT (mecanismo de `Ctrl+C`).

Resultados comprobados:

- **3/3** pruebas del modo manual: recorrido real en Edge, salida por `salir`,
  EOF y SIGINT; en todos los cierres se verificaron cuatro puertos cerrados y
  ausencia de directorios temporales nuevos.
- **31/31** recorridos del E2E anterior, con cero solicitudes externas de la
  aplicación y sin errores JavaScript.
- Barreras de `.env`, DNS, sockets, psycopg y SMTP comprobadas antes de servir
  peticiones. El test manual introduce configuración heredada falsa para comprobar
  que el runner la descarta y utiliza únicamente sus servicios generados.
- El launcher PowerShell se valida sintácticamente y con arranque/parada reales.
