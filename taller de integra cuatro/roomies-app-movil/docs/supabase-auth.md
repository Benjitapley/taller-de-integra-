# Supabase Auth: preparación móvil

Responsable: Gustavo Martínez. Tareas: M4-A02 y M4-A03.

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
- `getSupabaseClient()` entrega esa instancia a los futuros servicios de Auth.
- En Android/iOS, AsyncStorage guarda la sesión; en web se usa el almacenamiento
  del SDK. AsyncStorage no es una bóveda cifrada: esta elección sigue la guía de
  React Native de Supabase y deberá revisarse si cambia el requisito de almacenamiento.
- Se habilita persistencia y renovación de tokens; el layout controla la renovación
  al entrar y salir del primer plano y retira la suscripción al desmontarse.
- Si faltan variables, el layout sigue funcionando con el flujo actual. Pedir el
  cliente desde un servicio sin configuración genera un error explícito.
- La detección automática de sesiones desde URL está desactivada. La confirmación
  de correo y sus enlaces requieren definir el flujo en las tareas de registro.

Esta preparación no sustituye todavía la autenticación simulada de `useAuth`.
Registro real, login/logout y recuperación del estado visual corresponden a
M4-A04, M4-A05 y M4-A06. No declarar estos flujos integrados por instalar el SDK.

## Qué define M4-A03

`src/types/Auth.ts` reutiliza `User` y `Session` del SDK mediante los nombres
`IdentidadSupabase` y `SesionSupabase`. `UsuarioActual` reúne la identidad y un
perfil Roomies opcional. El UUID de Auth no sustituye `UsuarioPerfil.idUsuario`.
El perfil se obtendrá desde la API de TI2 y no se inventará al crear una sesión.

## Antes de conectar registro real

- Confirmar con TI2 qué proyecto compartido se usará y su política de confirmación
  de correo. En el proyecto de pruebas, mantener la confirmación habilitada para
  preparar el caso de cuenta creada pero sesión aún no iniciada.
- Confirmar el nombre y formato de `fecha_nacimiento` en metadata.
- TI2 AUTH-02 debe rechazar menores mediante el hook de Supabase. La validación
  móvil de M4-A01 no protege por sí sola el registro directo al proveedor.
- Definir la creación/sincronización del perfil Roomies tras el alta de Auth.
- La URL del Gateway y el OpenAPI son necesarios para M4-A07 y posteriores,
  pero no para preparar este cliente.

## Comprobar desde Expo

Con URL y clave reales, abrir Expo y confirmar que la instancia inicializa sin
errores. Después, al conectar M4-A04-M4-A06, comprobar registro con confirmación,
login, logout y sesión tras reiniciar en dispositivo. Una comprobación de tipos
o un bundle web no acreditan una sesión real ni persistencia nativa.

Después de configurar `.env.local`, ejecutar `npx expo start` desde la raíz móvil
y abrir la app en Expo Go/dispositivo o web. El layout inicializa el cliente
cuando existen ambas variables. No hay una pantalla nueva ni un aviso visual de
conexión: registro y login siguen utilizando el mock hasta M4-A04-M4-A05.

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
M4-A03 tiene implementado el contrato de tipos; su uso desde el hook de
autenticación se incorporará al conectar M4-A04-M4-A06.

## Referencias

- [Supabase Auth con React Native](https://supabase.com/docs/guides/auth/quickstarts/react-native)
- [Claves API de Supabase](https://supabase.com/docs/guides/getting-started/api-keys)
- [Integración GitHub y branching](https://supabase.com/docs/guides/deployment/branching/github-integration)
- [Variables de entorno en Expo](https://docs.expo.dev/guides/environment-variables/)
- [AsyncStorage para Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/async-storage/)
