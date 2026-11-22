# Integración local de D10 — Sprint 2

Rama de revisión: `codex/integrar-d10-supabase`.
Origen: D10 (`b97f208`), combinado con `integracion-movil-sprint-2` (`6e948dc`).
El PR #30 permanece como borrador; esta preparación no publica cambios.

## Avances incorporados

Se acumulan D01, D02 y D04–D10: selector Chat/Arriendo, conversaciones,
dashboard de arriendo, estado sin arriendo, formularios de tareas y
recordatorios, y estado demostrativo compartido. No se da por acreditada D03
como tarea independiente ni se declara completado el contrato pendiente D11.

## Resolución de los cruces

- Se conservan desde la base `useAuth`, Supabase, login, registro, callback,
  fecha de nacimiento, Perfil, `CustomInput`, imagen de acceso y dependencias.
- Las cuatro rutas nuevas (`arriendo/index`, `arriendo/chat`, `chats/index`,
  `chats/[id]`) se añaden dentro del mismo `Stack.Protected` que exige una sesión.
- Se mantienen la espera y el reintento de restauración, el ciclo de renovación
  de Supabase y las rutas públicas existentes. No se remonta el navegador al
  cambiar de identidad ni se introduce una autenticación simulada.
- Búsqueda, perfil público, creación multipart, Perfil propio y postulaciones
  permanecen como en la base que ya incorporó el PR #29.
- Las tareas y recordatorios comparten un almacén en memoria dentro de la
  identidad actual. Una renovación del token de la misma cuenta conserva la
  demo; cambiar de identidad crea otra instancia. No se usa almacenamiento ni
  se llama a un backend para estos datos.
- Cambiar de conversación monta el estado correspondiente a su ID; no reutiliza
  el texto ni los mensajes de otra conversación.
- Se corrigen las comillas JSX del dashboard y se actualizan los tipos locales
  de rutas mediante Expo, sin ocultar errores de TypeScript con casts.

## Comprobaciones

- **42 archivos clave idénticos a `6e948dc`**, incluidos Supabase, registro,
  Perfil, cliente HTTP, búsqueda, publicación, postulaciones y dependencias.
- Pruebas HTTP, Perfil, publicaciones y convivencia: **53 aprobadas**.
- `npx tsc --noEmit`: aprobado.
- `npm run lint -- --no-cache`: aprobado, sin advertencias.
- Compilación web aprobada: exporta **27 rutas**, incluidas las nuevas de chats
  y arriendo, además del callback y los flujos ya integrados.
- Las pruebas de rutas usan los componentes reales del layout y de la demo,
  con componentes host para Expo/React Native; no son una prueba de navegación
  nativa ni una conexión real con Supabase o los servicios desplegados.

## Alcance demostrativo y prueba manual

Chats, integrantes, arriendo activo, tareas y recordatorios siguen usando los
datos de demostración de Matías. Esa identidad de demostración solo representa
mensajes de muestra: nunca sustituye la identidad Supabase de autenticación.
Los mensajes escritos se conservan mientras la conversación está montada; las
tareas y recordatorios sobreviven a la navegación dentro de la sesión, pero se
pierden al reiniciar o cambiar de identidad. No hay persistencia real añadida.

Antes de actualizar el PR:

1. Iniciar sesión, recargar, abrir Perfil y cerrar sesión, como en B10.
2. Con sesión, abrir Chat → Chats: comprobar conversación preseleccionada,
   conversación pendiente y volver. Revisar también una URL de chat inexistente.
3. Abrir Chat → Arriendo → chat del grupo, escribir y volver; en móvil comprobar
   el teclado, desplazamiento y botón de regreso.
4. Crear una tarea y verla también en “Ver todo”; crear un recordatorio y
   comprobar que ambos sobreviven al salir y volver al dashboard.
5. Cerrar sesión y comprobar que las rutas privadas dejan de estar disponibles.
   Volver a entrar: las altas de la demo anterior no deben reaparecer.
6. Para el estado D06, cambiar temporalmente `USUARIO_TIENE_ARRIENDO_MOCK` a
   `false`, comprobar “Sin arriendo” y “Ir a Buscar”, y restaurarlo a `true`.

La disponibilidad de los servicios comunes y su persistencia real siguen
siendo pendientes independientes de esta combinación móvil.
