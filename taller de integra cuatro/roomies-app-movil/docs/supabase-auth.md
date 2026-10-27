# Supabase Auth: preparación móvil

Responsable: Gustavo Martínez. Tareas: M4-A02, M4-A03, M4-A04 y M4-A05.

## Proyecto de pruebas y proyecto compartido

Gustavo confirmó el 20 de octubre de 2026 que se puede utilizar un proyecto
personal como entorno de pruebas mientras averigua si TI2 ya tiene uno común.
La aplicación selecciona el proyecto mediante variables de entorno.
Las cuentas creadas en proyectos diferentes son independientes: cambiar la URL
y clave no migra usuarios ni sesiones. Usar cuentas de prueba en este entorno.

Vincular un repositorio GitHub es opcional y no es requisito de Supabase Auth.
La conexión de la app necesita la URL y la clave publishable del mismo proyecto.

## Configuración local

1. Crear el proyecto de pruebas sin seleccionar repositorio GitHub, con Postgres
   por defecto y una región de Americas adecuada al equipo.
2. Para este trabajo no crear tablas de negocio: solo se preparará Auth.
   `Automatically expose new tables` puede dejarse desmarcado. Si se usa Data API,
   habilitar RLS y definir políticas antes de exponer datos. Estos ajustes de
   tablas no reemplazan la configuración de Authentication.
3. En `Get connected` (seleccionando Expo) o `Settings > API Keys`, obtener
   Project URL y Publishable key.
4. Copiar `.env.example` a `.env.local` y completar:

   ```dotenv
   EXPO_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
   EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_TU_CLAVE
   ```

   El nombre `EXPO_PUBLIC_SUPABASE_KEY` coincide con el ejemplo del dashboard.
   `EXPO_PUBLIC_` es el prefijo que Expo reconoce para incluir una variable en
   la app; el resto del nombre lo define el código de cada proyecto.

5. Recargar completamente la app después de guardar las variables. Si el servidor
   Expo estaba abierto, se puede reiniciar con `npx expo start`.

`.env.local` ya está ignorado por Git. El `.env` existente está versionado y
contiene la configuración previa de API; colocar estos valores en `.env.local`.
Las variables `EXPO_PUBLIC_*` se incluyen en el bundle: usar exclusivamente la
clave publishable. No colocar contraseña de BD, claves secret ni service_role.

## Qué prepara M4-A02

- `src/lib/supabase.ts` mantiene una instancia única y valida la configuración.
- `getSupabaseClient()` entrega esa instancia a los servicios de Auth.
- En Android/iOS, AsyncStorage guarda la sesión; en web se usa el almacenamiento
  del SDK. AsyncStorage no es una bóveda cifrada: esta elección sigue la guía de
  React Native de Supabase y deberá revisarse si cambia el requisito de almacenamiento.
- Se habilita persistencia y renovación de tokens; el layout controla la renovación
  al entrar y salir del primer plano y retira la suscripción al desmontarse.
- Si faltan variables, el layout sigue funcionando con el flujo actual. Pedir el
  cliente desde un servicio sin configuración genera un error explícito.
- La detección automática de sesiones desde URL está desactivada. La confirmación
  de correo y sus enlaces requieren definir el flujo en las tareas de registro.

La preparación de M4-A02 no sustituye por sí sola la autenticación simulada.
M4-A04 conecta el registro y M4-A05 conecta login/logout. La restauración del
estado visual al abrir o recargar la app sigue pendiente en M4-A06.

## Qué define M4-A03

`src/types/Auth.ts` reutiliza `User` y `Session` del SDK mediante los nombres
`IdentidadSupabase` y `SesionSupabase`. `UsuarioActual` reúne la identidad y un
perfil Roomies opcional. El UUID de Auth no sustituye `UsuarioPerfil.idUsuario`.
El perfil se obtendrá desde la API de TI2 y no se inventará al crear una sesión.

## Coordinación con TI2 antes de usar el proyecto compartido

- Confirmar con TI2 qué proyecto compartido se usará y su política de confirmación
  de correo. En el proyecto de pruebas, mantener la confirmación habilitada para
  preparar el caso de cuenta creada pero sesión aún no iniciada.
- La integración personal usa `nombre` y `fecha_nacimiento` (AAAA-MM-DD) en metadata.
  Confirmar este contrato con TI2 antes de llevarlo al proyecto compartido.
- Se preparó un hook para rechazar menores en el proyecto personal, con aprobación
  de Gustavo el 26 de octubre. Coordinar con TI2 su instalación y mantenimiento
  en el proyecto compartido; no dar por implementada AUTH-02 allí.
- Definir la creación/sincronización del perfil Roomies tras el alta de Auth.
- La URL del Gateway y el OpenAPI son necesarios para M4-A07 y posteriores,
  pero no para preparar este cliente.

## Comprobar desde Expo

Con URL y clave reales, abrir Expo y confirmar que la instancia inicializa sin
errores. Comprobar registro con confirmación, login y logout; al conectar M4-A06,
comprobar también sesión tras reiniciar en dispositivo. Una comprobación de tipos
o un bundle web no acreditan una sesión real ni persistencia nativa.

Después de configurar `.env.local`, ejecutar `npx expo start` desde la raíz móvil
y abrir la app en Expo Go/dispositivo o web. El layout inicializa el cliente
cuando existen ambas variables. No hay una pantalla nueva ni un aviso visual de
conexión. El registro real se incorporó en M4-A04 y el login/logout real en M4-A05.

## M4-A04: registro real y confirmación

`src/services/authService.ts` utiliza `auth.signUp()` y envía únicamente correo,
contraseña y metadata de nombre/fecha. No guarda contraseñas en los mocks ni crea
un perfil Roomies con un ID inventado. `useAuth` conserva la sesión que devuelve
el proveedor, cuando existe, y utiliza el contrato `UsuarioActual` con `perfil: null`.

Con confirmación de correo activada, un registro aceptado normalmente devuelve
`session: null`. La pantalla muestra **Revisa tu correo**, borra los campos de
contraseña y no navega a las pestañas. El texto no asegura que se creó una cuenta
nueva: el proveedor puede ocultar la existencia de una dirección ya registrada.
Los errores de contraseña, correo, límites, conexión y edad se muestran en el formulario.

La política del formulario coincide con la selección indicada por Gustavo:
longitud mínima **6** (valor que mostraba el panel), al menos una minúscula ASCII,
una mayúscula ASCII, un dígito y un símbolo admitido por Supabase. Está en
`src/utils/contrasena.ts`. Si se cambia la longitud o composición del proyecto,
actualizar esta utilidad y la ayuda visible. La política del servidor es la autoridad.

### Configuración para la primera comprobación en web

En el proyecto personal, dentro de **Authentication > URL Configuration**:

- **Site URL:** `http://localhost:8081`
- **Redirect URLs:** añadir `http://localhost:8081/auth/callback`

Ejecutar `npx expo start --web --port 8081` desde la raíz móvil. `Linking.createURL`
construye el callback con el origen actual: si cambia el puerto o el dominio, se
debe autorizar ese callback exacto en Supabase. Abrir el correo en el mismo PC
mientras el servidor está activo; localhost siempre se refiere al equipo que abre el enlace.

La ruta `src/app/auth/callback.tsx` procesa el flujo implícito del cliente: verifica
la identidad con `getUser(access_token)` y guarda la sesión con `setSession()`.
Retira los tokens de la barra de direcciones y del hash almacenado por Expo Router,
y muestra el resultado sin registrarlos en consola. Solo admite enlaces de registro
(`type=signup`); recuperación de
contraseña y OAuth necesitan sus propios flujos. Una visita sin enlace válido
no se anuncia como confirmación correcta.

La confirmación puede iniciar una sesión real. Desde M4-A05, la pantalla `/login`
también inicia sesión con Supabase y el botón al final de Perfil cierra la sesión actual.
La sincronización al recargar/abrir la app corresponde a M4-A06. El avatar, perfil
y publicaciones visibles siguen siendo mocks independientes de Auth.

En un development build móvil, autorizar el enlace del esquema configurado
(`roomiesappmovil://auth/callback`). Expo Go genera enlaces de desarrollo variables;
no usar esos enlaces como configuración estable. La primera comprobación acordada
es web; todavía no se acredita apertura de correo y persistencia en dispositivo.

### Activar Before User Created en el proyecto personal

El archivo `supabase/migrations/20261026000000_before_user_created_edad.sql`
crea `public.validar_edad_registro(event jsonb)`. No requiere instalar la CLI:

1. Abrir el **SQL Editor** del proyecto personal y crear una consulta nueva.
2. Pegar el contenido completo del archivo y ejecutar **Run** como administrador
   del proyecto. Crea la función y sus permisos en una transacción.
3. Ir a **Authentication > Auth Hooks**, añadir **Before User Created**, elegir
   una función **Postgres**, esquema `public`, función `validar_edad_registro`,
   y guardar/habilitar. Si ya existe un hook, revisar su función antes de reemplazarlo.
4. Comprobar en el panel que quedó habilitado. Crear la función mediante SQL no
   configura por sí mismo el hook de Auth.

Supabase ejecutará esta función antes de insertar una identidad. Exige una fecha
declarada real, no futura y una edad de al menos 18 años, incluyendo llamadas
directas al proveedor que omitan el formulario. Usa el día del servidor en **UTC**;
el formulario da respuesta inmediata con la fecha local del dispositivo. Cerca
del cambio de día pueden diferir; la decisión definitiva corresponde al servidor.
Para nacimientos el 29/02, en años no bisiestos se cumple el 01/03, igual que en la app.

Devuelve `{}` para permitir y un error HTTP 400 para bloquear. Los identificadores
`ROOMIES_EDAD_MINIMA` y `ROOMIES_FECHA_NACIMIENTO_INVALIDA` se traducen a mensajes
del formulario. La función usa `security invoker`, un search_path vacío y permisos
de ejecución para `supabase_auth_admin`; se revoca ejecución a `anon`,
`authenticated` y `public`. No lee tablas de negocio.

Valida la **edad declarada**: no demuestra la identidad ni impide mentir sobre la
fecha. Tampoco revalida automáticamente cambios posteriores en user_metadata.
Las decisiones sensibles posteriores deben usar datos de negocio validados por TI2.
Un futuro registro OAuth sin fecha también quedaría bloqueado: su diseño requiere
resolver cómo recogerla antes del alta. No se integra OAuth en esta tarea.

### Correo del entorno personal

No se necesita poseer un dominio para probar con el correo autorizado del equipo
de la organización Supabase. El envío predeterminado tiene límites y solo admite
esas direcciones; no suponer que llegará a cualquier correo de prueba. SMTP propio
se configura cuando se necesite enviar a destinatarios externos y con el remitente
que autorice el proveedor elegido.

### Estado de la comprobación funcional

#### Comprobación directa del rechazo de menores

Desde la raíz móvil, con Node 20.6 o posterior y el proyecto personal en `.env.local`:

```bash
node --env-file=.env.local scripts/comprobar-edad-supabase.mjs
```

El script hace una solicitud real a `/auth/v1/signup`, omitiendo las validaciones
de React y `authService`. Genera un correo único `roomies-a04-menor-...@example.com`,
una contraseña aleatoria con la composición requerida y una fecha de una persona
de unos 10 años. No requiere borrar la cuenta personal. Con el hook habilitado,
se espera HTTP 400 y `ROOMIES_EDAD_MINIMA`, antes de llegar al envío de correo.

Solo esa combinación se anuncia como correcta. Otro error es no concluyente;
una respuesta 2xx es un fallo que requiere revisar el hook y comprobar si apareció
una cuenta con el correo de prueba. El script muestra ese correo para buscarlo
en Authentication > Users, y evita imprimir claves, contraseñas o tokens.
Es una herramienta manual para el entorno de pruebas; no se ejecuta al iniciar Expo.

#### Comprobación de la limpieza del callback

Con Expo activo y el código actualizado, abrir esta URL de prueba en el navegador:

```text
http://localhost:8081/auth/callback#access_token=prueba_invalida&refresh_token=prueba_invalida&type=signup
```

Se espera un mensaje de error de verificación y que la dirección termine en
`http://localhost:8081/auth/callback`, sin fragmento ni tokens. Este caso permite
comprobar la limpieza tras un error sin pedir un correo. No acredita una sesión válida.

Para observar también el resultado satisfactorio con la corrección, realizar un
registro adulto con un correo autorizado que aún no exista en Auth y abrir el
mensaje nuevo. Antes de pulsar Continuar, comprobar la dirección limpia en
**Correo confirmado**. Un enlace ya utilizado no sustituye un enlace nuevo.
Si se elimina y recrea una cuenta de pruebas, cambia su UUID. Eliminarla no
restablece el cupo de envío del proyecto; respetar los límites del servicio de correo.

#### Evidencia recibida y estado de revisión

El 26 de octubre de 2026, Gustavo compartió capturas del hook
`public.validar_edad_registro` creado y habilitado en el proyecto personal.
Después realizó la comprobación manual en web y aportó capturas y el JSON del usuario:

- Reportó que pasaron las validaciones de fecha, mayoría de edad, composición
  de contraseña y confirmación de contraseña del formulario.
- La app mostró **Revisa tu correo** antes de confirmar.
- Se creó una identidad real con UUID en Authentication > Users.
- `raw_user_meta_data` contiene `nombre` y `fecha_nacimiento` en formato AAAA-MM-DD.
- Llegó el mensaje de confirmación del servicio de Supabase.
- El enlace regresó a `/auth/callback`, que mostró **Correo confirmado** y sesión iniciada.
- El JSON incluye `confirmation_sent_at`, `confirmed_at` y `last_sign_in_at`,
  coherentes con el registro y la confirmación observados.

No se copian el correo personal, UUID ni tokens de sesión en esta documentación.
Las pruebas fueron realizadas por Gustavo; Codex no creó identidades ni envió correos.

La primera captura del callback mostraba el fragmento con tokens en la dirección.
Se ajustó la limpieza para actualizar también el parámetro `#` de Expo Router
al terminar la operación. Gustavo realizó después las dos comprobaciones pendientes:

- Ejecutó `scripts/comprobar-edad-supabase.mjs` contra el proyecto personal.
  La petición directa declaró `2016-01-01` y obtuvo **HTTP 400** con
  **ROOMIES_EDAD_MINIMA**. Esto acredita el rechazo de un menor desde el proveedor,
  omitiendo las validaciones del formulario y de `authService`.
- Aportó una captura de Authentication > Users sin usuarios antes del nuevo
  registro adulto, coherente con que el intento de menor no creó una identidad.
- El enlace con tokens ficticios mostró el error de verificación esperado y
  dejó la barra de direcciones en `/auth/callback`, sin fragmento.
- Recreó su cuenta de prueba como adulto, recibió un nuevo enlace y aportó
  **Correo confirmado**, con sesión iniciada y la dirección `/auth/callback`
  limpia antes de pulsar Continuar. El JSON de la nueva identidad tiene nombre,
  fecha de nacimiento y fechas de confirmación/inicio de sesión.
- La navegación mediante Continuar hacia el inicio ya había sido comprobada
  por Gustavo en el recorrido anterior.

Las dos comprobaciones pendientes de esta sesión quedan resueltas: M4-A04 está
implementada y validada manualmente en **web y el proyecto personal**, lista para
revisión y commit. La validación funcional en Android/iOS y la coordinación del
proyecto compartido con TI2 siguen sin acreditarse con esta evidencia de web.
Esta evidencia de M4-A04 no acredita el login/logout de M4-A05 ni la restauración
de M4-A06, que tienen comprobaciones independientes.

La limpieza observada corresponde a la barra de direcciones y al estado del router.
La captura del historial del navegador todavía muestra la URL original de entrada;
no se acredita que esa limpieza elimine registros del historial global del navegador.

## M4-A05: login y logout reales

`authService` utiliza `auth.signInWithPassword()` y `auth.signOut({ scope: "local" })`
directamente con Supabase Auth, según TI2 AUTH-01. No interviene FastAPI. No se
necesitan nuevas tablas, migraciones, proveedores ni configuración de correo para
esta tarea; se utiliza una cuenta creada y confirmada en el mismo proyecto de A04.

- El correo se recorta y normaliza a minúsculas. La contraseña se envía tal como
  se escribió: la política de creación de contraseñas no se aplica al login de
  cuentas existentes.
- Los resultados de login/logout están tipados en `src/types/Auth.ts`. El servicio
  traduce errores conocidos de credenciales, correo sin confirmar, límites y conexión
  a mensajes para la pantalla, sin mostrar detalles internos.
- `useAuth` conserva únicamente la sesión real. `estaAutenticado` depende de ella
  y `usuarioActual` contiene su identidad, con `perfil: null` hasta integrar TI2.
- Se elimina `src/mocks/auth.ts`: sus credenciales y perfiles ficticios ya no
  intervienen en autenticación. Los mocks de las pantallas permanecen independientes.
- Login muestra carga, bloquea envíos simultáneos y limpia la contraseña al entrar.
  Google y recuperación de contraseña siguen pendientes; sus controles lo indican
  y no simulan una sesión.
- El botón **Cerrar sesión** está al final de Perfil, ubicación acordada con Gustavo.
  Utiliza alcance `local`, conservando las demás sesiones de la cuenta.
- Si falla el cierre, se consulta si el SDK retiró la sesión local. Si todavía
  existe, se muestra el error en Perfil. Si ya no existe, se limpia el contexto y
  se vuelve al login con un aviso de que no se pudo confirmar el cierre remoto.
  No se anuncia un cierre remoto correcto ante ese error.
- `Stack.Protected` limita las pestañas y `convivencia/tareas` a una sesión del
  contexto. Al cerrar sesión se retiran esas pantallas de la navegación; volver
  atrás no debe reabrirlas. Este control de UI no sustituye la autorización de la API.

El alcance local revoca la sesión actual según el proveedor; un access token ya
emitido puede seguir siendo válido hasta su vencimiento. No equivale a cerrar
todas las sesiones ni a revocar inmediatamente todos los JWT de la cuenta.

### Comprobación manual de A05

Desde la raíz móvil, ejecutar `npx expo start --web --port 8081` y abrir `/login`.
Usar la cuenta real y confirmada del proyecto personal, sin borrarla ni volver a
registrarla. No compartir su contraseña ni los tokens.

1. Probar campos vacíos: se muestra el mensaje de campos requeridos.
2. Probar una contraseña incorrecta: permanece en login y muestra el error del
   proveedor. Las antiguas credenciales de Sofía no deben abrir una sesión, salvo
   que alguien haya creado realmente esa cuenta en el proyecto.
3. Usar las credenciales correctas: se muestra carga y luego se abren las pestañas.
   En Supabase, `last_sign_in_at` permite corroborar un nuevo inicio de sesión.
4. Ir a Perfil y pulsar **Cerrar sesión** al final: vuelve a `/login`.
5. Probar Atrás y abrir `/perfil` directamente: no debe mostrarse la pantalla
   protegida sin una nueva sesión. Después comprobar que se puede iniciar sesión otra vez.
6. Para observar el error de conexión, cerrar sesión con conexión, desconectar la
   red y probar un login. Debe mostrar error y permitir reintentar al recuperar la red.

El caso de correo sin confirmar puede comprobarse con una cuenta de pruebas ya
creada que siga pendiente de confirmación. No hace falta eliminar la cuenta confirmada.
La conservación de otra sesión puede comprobarse con un segundo navegador/perfil
independiente, cuando esté disponible la restauración de M4-A06.

**Límite entre tareas:** A02 configura la persistencia del SDK, pero A05 no carga
esa sesión en el contexto al arrancar ni suscribe cambios externos de Auth. Una
recarga completa puede devolver al login hasta M4-A06. Tampoco se obtiene todavía
el perfil Roomies: seguir viendo Sofía no significa que las credenciales sean simuladas.

El 27 de octubre de 2026, Gustavo comprobó A05 en web con su cuenta real de A04 y reportó:

- Una contraseña incorrecta muestra error y no permite entrar.
- Las credenciales correctas permiten iniciar sesión y abrir el inicio.
- **Cerrar sesión** al final de Perfil regresa al login.
- Pulsar Atrás después del cierre no reabre Perfil.

Estos resultados cubren los criterios funcionales de login/logout de A05 en web.
La devolución al login tras recargar sigue siendo un pendiente de A06. No se dan
por probados los casos adicionales de red, correo sin confirmar o dos navegadores
por estos cuatro resultados.

Gustavo también reportó que su teléfono no abre la app: la captura indica Expo Go
para SDK 58 y proyecto SDK 57. `package.json` conserva Expo `~57.0.24`; A05 no cambia
dependencias. Falta repetir el recorrido en un dispositivo/emulador compatible,
como pide el criterio general del backlog para tareas móviles. Para Android se
puede instalar la versión compatible desde
[Expo Go para SDK 57](https://expo.dev/go?sdkVersion=57&platform=android&device=true),
reiniciar el servidor y volver a escanear el QR. No se migra el SDK como parte de A05.

En la misma revisión repitió el registro con un correo ya confirmado y observó
**Revisa tu correo**. La respuesta genérica de A04 contempla que Supabase oculte
la existencia de una cuenta; no acredita una nueva alta ni un nuevo envío de correo.
El texto del cuerpo ya distingue ese caso y ofrece ir a iniciar sesión. Mejorar
el título/subtítulo para que no sugieran siempre una confirmación pendiente es un
ajuste de usabilidad de A04, no una función de login/logout pendiente de A05.

## Comprobaciones de código realizadas

El 20 de octubre de 2026, sin credenciales Supabase configuradas:

- `npx tsc --noEmit`: terminó sin errores.
- `npx expo lint`: terminó sin errores; conserva tres advertencias previas en
  `perfil.tsx` (imports duplicados) y `useAuth.tsx` (dependencias de useMemo).
- `npx expo export --platform web --output-dir dist`: exportó las rutas web.
- `npx expo export --platform android --output-dir dist/android`: generó el bundle
  Hermes. El primer intento falló por permisos en un archivo temporal del entorno
  restringido; repetir fuera de ese entorno terminó correctamente.
- `.env.local` está excluido de Git.

Posteriormente se configuraron la URL y clave publishable del proyecto personal
de pruebas en `.env.local`, sin incorporar los valores al repositorio. Una
comprobación de solo lectura obtuvo:

- Inicialización del SDK Supabase: correcta, sin sesión existente.
- Consulta a la configuración de Auth (`GET /auth/v1/settings`): HTTP 200.
- Proveedor de correo: habilitado.
- Confirmación de correo: requerida.
- Usuarios creados por la comprobación: ninguno.

Esa comprobación se ejecutó desde Node, no desde un dispositivo. Para acreditar
el criterio completo de M4-A02 queda observar la inicialización en Expo/dispositivo.
M4-A03 tiene implementado el contrato de tipos. M4-A04 empieza a utilizarlo en
el hook para las sesiones del registro; M4-A05 lo utiliza para login/logout y
M4-A06 conectará la restauración.

El 26 de octubre de 2026, durante M4-A04:

- TypeScript: sin errores.
- Lint: sin errores; permanecen dos advertencias anteriores de imports duplicados
  en `perfil.tsx`. La advertencia de dependencias de `useAuth` quedó resuelta.
- Compilación web: exportó las rutas, incluida `/auth/callback`.

Estas comprobaciones no acreditan entrega del correo ni ejecución del hook remoto.

El 27 de octubre de 2026, durante M4-A05:

- `npx tsc --noEmit`: sin errores.
- `npx expo lint`: sin errores ni advertencias; se unificaron los imports de
  `Publicacion` y `TipoPublicacion` en Perfil.
- `npx expo export --platform web --output-dir dist`: compilación y exportación
  estática correctas, incluyendo login, Perfil y callback.
- No quedan referencias a `credencialesMock`, `credencialesDemo` ni `mocks/auth`
  en el código de la aplicación.
- No se hicieron peticiones de login/logout contra el proyecto personal durante
  estas comprobaciones ni se añadieron credenciales al repositorio.

La compilación no acredita los recorridos funcionales descritos en la lista de A05.

## Referencias

- [Supabase Auth con React Native](https://supabase.com/docs/guides/auth/quickstarts/react-native)
- [Claves API de Supabase](https://supabase.com/docs/guides/getting-started/api-keys)
- [Integración GitHub y branching](https://supabase.com/docs/guides/deployment/branching/github-integration)
- [Variables de entorno en Expo](https://docs.expo.dev/guides/environment-variables/)
- [AsyncStorage para Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/async-storage/)
- [Registro mediante signUp](https://supabase.com/docs/reference/javascript/auth-signup)
- [Before User Created](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook)
- [Permisos y errores de Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks)
- [Política de contraseñas](https://supabase.com/docs/guides/auth/password-security)
- [Envío de correo y SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Login con signInWithPassword](https://supabase.com/docs/reference/javascript/auth-signinwithpassword)
- [Cierre de sesión y alcances](https://supabase.com/docs/reference/javascript/auth-signout)
- [Códigos de error de Auth](https://supabase.com/docs/guides/auth/debugging/error-codes)
- [Rutas protegidas de Expo Router](https://docs.expo.dev/router/advanced/protected/)
