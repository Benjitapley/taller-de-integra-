# Perfil propio — preparación M4-A08 / SCRUM-41

Responsable: Gustavo Martínez. 2 de noviembre de 2026.
Requisitos: FR-03, FR-04, NFR-11. Dependencia técnica: cliente HTTP de A07.

## Estado y alcance

Preparación parcial. No acredita consumo de un perfil real ni termina A08.
TI2 aún debe confirmar URL, DTO de GET `/usuarios/me` y comportamiento sin perfil.
La referencia del backlog define la ruta; no define por sí sola nombres, tipos,
nulabilidad ni envoltorio del JSON. Los instructivos de arquitectura y Auth son
propuestas de integración, no una respuesta real del endpoint.

Perfil deja de mostrar a Sofía, su avatar, publicación, estadísticas y evaluaciones.
No se rellenan campos del perfil con metadata de Supabase ni con datos de ejemplo.
Tampoco se confunde la identidad autenticada con un perfil Roomies ya inicializado.

## Bloques preparados

- `src/types/Usuario.ts`: `PerfilPropioVista` es un modelo local para presentar
  datos, **no el contrato HTTP**. Cada campo ausente se representa con `null`.
  Cero, una lista vacía y un dato no disponible conservan significados distintos.
- `src/services/usuariosService.ts`: `consultarPerfilPropio()` utiliza la ruta
  protegida de referencia y A07. El adaptador por defecto permanece en `null`:
  devuelve `contrato_pendiente` **sin hacer peticiones**, aunque se configure URL.
  Cuando exista contrato, su adaptador validará `unknown` antes de proyectar.
  Los errores HTTP conservan su código; un 404 no se interpreta aún como perfil
  sin inicializar. null/204 o un fallo de adaptación no se muestran como éxito.
- `src/hooks/usePerfilPropio.ts`: carga al enfocar Perfil, permite reintentar y
  descarta resultados al desenfocar, reintentar o cambiar de identidad. No cachea
  perfiles entre cuentas ni cambia la sesión Supabase por un fallo del backend.
- `src/components/perfil/ContenidoPerfil.tsx`: carga, error/pendiente, reintento,
  presentación de datos personales y secciones no disponibles. No inventa
  reputación, contadores, publicaciones ni estado de publicación del usuario.
- `src/app/(tabs)/perfil.tsx`: conecta el hook con la pantalla. Conserva el cierre
  local de sesión de A05 y usa un avatar neutro si no hay foto respaldada.
- `src/components/perfil/FormularioPerfilLocal.tsx`: formulario previo trasladado
  como referencia para A09; no está montado. Su lógica local y campos deberán
  revisarse con el contrato de edición antes de conectarlo a PATCH. No significa
  que edad, ubicación o preferencias estén aprobadas como campos editables.

No se añade un modo demo en la app ni se cambia el estado de autenticación A06.
Otras pantallas que usan datos simulados conservan su alcance pendiente.

## Qué comprobar ahora

1. Iniciar sesión con la cuenta de pruebas existente y abrir Perfil.
2. Debe aparecer “Perfil no disponible”, con descripción y botón “Reintentar”.
   La carga puede ser muy breve porque el bloqueo local responde inmediatamente;
   no se agrega una demora artificial para que se vea el indicador.
3. Reintentar mantiene un resultado pendiente mientras no se configure el
   adaptador real. La sesión sigue abierta y no hay petición a `/usuarios/me`.
4. No deben aparecer Sofía, su foto, su publicación ni sus evaluaciones en Perfil.
   Estadísticas y reputación se indican como no disponibles, sin contadores cero.
5. “Cerrar sesión” debe seguir llevando al login y proteger el acceso posterior.

## Pruebas controladas

```bash
npm run test:perfil
npm run test:http
npx tsc --noEmit
npx expo lint
```

Las pruebas del servicio sustituyen únicamente el cliente HTTP y pasan un adaptador
ficticio explícito. No cargan `.env.local`, no usan Supabase ni hacen red.
Comprueban el bloqueo por contrato, ruta protegida, errores, null/204 y adaptación.
Las pruebas de contenido renderizan el componente real con hosts mínimos y React
DOM Server: verifican textos, datos ausentes, cero, listas y ausencia de mocks.
No acreditan comportamiento nativo ni integración real del backend.

Resultado del 2 de noviembre: pasaron las 10 pruebas de Perfil y las 15 de HTTP,
TypeScript y lint sin errores ni advertencias. Se revisó la app web con Edge en
un contexto aislado y sesión/entorno ficticios (sin usar cuentas reales): estado
pendiente, reintento, ausencia de datos demo, cero peticiones externas al consultar,
sin errores JavaScript, sin desbordamiento horizontal a 390 px y cierre al login.
Esta revisión no prueba credenciales reales, el endpoint de TI2 ni Expo Go.

## Qué falta para completar A08

1. Recibir URL del Gateway/API y proyecto Supabase del mismo entorno.
2. Obtener OpenAPI y ejemplos reales del GET: campos, tipos, nombres, null y
   envoltorio; acordar respuesta cuando existe identidad pero todavía no perfil.
3. Implementar el adaptador real y sustituir `adaptadorPerfilTi2 = null`.
   Validar JSON, campos soportados y URL de foto; derivar edad de fecha solo si
   corresponde al contrato. No convertir un objeto arbitrario con `as UsuarioPerfil`.
4. Probar GET con JWT válido del mismo proyecto, datos de dos cuentas, campos
   ausentes y 401/403/404/red/respuesta inválida. Verificar que no aparecen datos
   anteriores durante cambio de cuenta o respuesta tardía.
5. Registrar evidencia del endpoint real y SHA desplegado antes de cerrar A08.

No se realiza PATCH, inicialización de perfil ni consulta a publicaciones/reputación
en esta preparación. La confirmación de correo aprobada reemplaza la verificación
documental; cualquier indicador de ese estado requiere una fuente autorizada y
no debe presentarse como comprobación de identidad documental.
