# Perfil propio - M4-A08 / SCRUM-41

Responsable: Gustavo Martínez. Preparación del 02/11, adaptador conectado el 04/11/2026.
Requisitos: FR-03, FR-04, NFR-11. Dependencia: cliente HTTP de A07.

## Estado

Se implementó el adaptador del GET /usuarios/me publicado en el OpenAPI de
https://roomies-scrum77-auth-users.onrender.com/openapi.json, consultado el 04/11.
La consulta por defecto ya hace GET protegido mediante A07. No se declara terminada
la integración: en la comprobación de hoy Auth/Users/Gateway devolvían 503 de
configuración JWT y la preconsulta CORS web del Gateway devolvía 405.

La cuenta común confirmada y el login fueron comprobados por Gustavo. Esa sesión
no demuestra que el backend la acepte ni que exista una fila de perfil de negocio.

## Contrato y presentación

PerfilPropioTi2 tiene siete claves obligatorias; todas salvo nombre admiten null.
El servicio valida estructura, tipos y edad numérica entera antes de proyectar.

| Campo de API | Presentación |
| --- | --- |
| nombre | Nombre de la tarjeta principal. |
| edad | Edad devuelta, sin habilitar edición ni derivar una fecha ficticia. |
| ocupacion | Ocupación. |
| ciudad | Ubicación. |
| breve_descripcion | Descripción breve de la tarjeta principal. |
| sobre_mi | Texto extenso de Sobre mí. |
| foto_perfil | HTTP(S) absoluto o referencia raíz resuelta con la base API. |

Gustavo aprobó el 04/11 mostrar ambas descripciones por separado. Los textos
vacíos se presentan como no disponibles. Una foto nula, mal formada o con
esquema/credenciales inapropiados deja el avatar neutro; no se inventa una foto.

La respuesta no incluye email, presupuesto, preferencias, zonas, reputación,
publicaciones ni estadísticas: permanecen no disponibles. Tampoco se rellenan con
metadata de Supabase o con Sofía. Campos extra del JSON no amplían el contrato.

Solo HTTP 200 con un DTO válido se representa como perfil. Los errores conservan
código/estado; 404 no se interpreta automáticamente como perfil aún no provisionado.
204, null, JSON incorrecto y fallos del adaptador nunca se anuncian como éxito.

## Bloques

- src/types/Usuario.ts: DTO PerfilPropioTi2 separado de PerfilPropioVista.
- src/services/usuariosService.ts: adaptarPerfilTi2 y consultarPerfilPropio. El
  adaptador real está activo por defecto; sin fallback al antiguo /api/perfil.
- src/hooks/usePerfilPropio.ts: carga al enfocar, reintento y descarte de respuestas
  tardías al salir, reintentar o cambiar de identidad; conserva la sesión ante errores.
- src/components/perfil/ContenidoPerfil.tsx: carga/error, reintento, datos personales,
  descripción breve y extensa, y secciones no disponibles.
- src/app/(tabs)/perfil.tsx: conecta hook y vista; mantiene cierre de sesión local.
- FormularioEditarPerfil.tsx: edición mediante el contrato desplegado, descrita en SCRUM-86.

## Comprobación manual

1. Configurar Supabase común y Gateway en .env.local, reiniciar/recargar Expo e iniciar sesión.
2. Abrir Perfil y revisar en Network del navegador GET /usuarios/me y, cuando
   corresponda, su OPTIONS previo. Un fallo CORS puede verse en la app como red.
3. Mientras siga el 503/CORS, mostrar error y Reintentar, conservando la sesión.
   El antiguo bloqueo local por contrato_pendiente ya no es el camino por defecto.
4. Cuando TI2 habilite el entorno y un perfil de prueba, comprobar nombre, edad,
   ocupación, ciudad y ambas descripciones del JSON real. Datos no entregados
   siguen no disponibles; no se sustituyen por ceros ni mocks.
5. Probar otra cuenta y una respuesta tardía: no debe aparecer el perfil anterior.
6. Repetir en Expo Go. Cerrar sesión debe conservar el comportamiento de A05/A06.

## Verificación y límites

```bash
npm run test:perfil
npm run test:http
npx tsc --noEmit
npx expo lint
```

Las 15 pruebas de Perfil usan un transporte controlado y renderizado del componente
real con hosts mínimos de React DOM Server. Verifican DTO, nulabilidad, referencias
de foto, ambas descripciones, errores y ausencia de datos inventados. No cargan
.env.local, no usan cuentas reales ni prueban conectividad o representación nativa.
El historial anterior era de 10 pruebas, previo a conectar este adaptador.

El 04/11 pasaron las 15 pruebas de Perfil, las 21 de HTTP, TypeScript y lint sin
errores. La exportación web de Expo también terminó correctamente. Estos checks
no acreditan una respuesta 200 del perfil real ni una prueba nativa de subida.

Para cerrar A08 faltan GET real satisfactorio con JWT común, evidencia de cuenta y
perfil asociados, y comprobación visual con datos reales en web/Expo Go. La ausencia
de perfil requiere que TI2 defina y pruebe su provisión; el móvil no crea una fila
automáticamente ni deduce ese estado solo por un 404.

El avance de A09 se incorpora a SCRUM-86. El PATCH publicado incluye `edad` en
su esquema, pero el móvil conserva la edad derivada de la fecha de nacimiento.

## Alta de perfil y restauración de sesión (SCRUM-85)

El SDK restaura la sesión. Tras recuperar una identidad o iniciar sesión, la app
consulta su perfil con el token de esa cuenta. Con el alta habilitada por entorno,
un perfil ausente se solicita mediante el POST configurado, con el nombre y la
fecha de nacimiento del registro y solo si el correo se confirmó. El servidor
controla la pertenencia y la idempotencia. Si faltan datos del registro o falla
la solicitud, Mi perfil muestra el problema y permite reintentar sin cerrar sesión.

Para una prueba en Expo Go contra el despliegue de transición, configurar `.env.local`:

```dotenv
EXPO_PUBLIC_API_URL=https://roomies-main-api-gateway.onrender.com
EXPO_PUBLIC_CONTRATO_PERFIL=render
```

`render` selecciona el GET `/usuarios/me` y el POST `/local/v1/perfil/inicializacion`.
El OpenAPI desplegado y el backlog TI2 Sprint 2 v1.5 coinciden en GET y PATCH
`/usuarios/me`. El alta está en el OpenAPI desplegado; el backlog describe la
persistencia por UUID (AUTH-04) sin fijar una ruta HTTP de alta. Sin modo se
conserva el GET anterior. La URL base se configura sin `/api`; los prefijos
forman parte de la ruta publicada para cada operación.

1. Con la cuenta existente, abrir Mi perfil y comprobar sus datos.
2. Cerrar sesión, registrar una cuenta nueva de prueba y confirmar el correo.
   Abrir Mi perfil y comprobar que muestra el nombre y la edad de esa cuenta.
3. Cerrar completamente Expo Go y reabrir el proyecto. Comprobar que la sesión y
   el perfil se recuperan. Cambiar de cuenta y comprobar que nunca aparece el perfil
   de la sesión anterior. Para verificar la ausencia de duplicados, pedir a TI2
   que confirme un único ID de perfil para la identidad de prueba.

La prueba del Gateway el 16/11 mostró 200 en `/health`, 401 sin sesión en el
POST de inicialización y 404 en `POST /api/usuarios/me`. La provisión autenticada y la restauración en
teléfono requieren la prueba anterior. Las pruebas locales de HTTP y perfil usan
transporte simulado y no crean cuentas ni filas reales.

## Edición y confirmación de guardado (SCRUM-86 / SCRUM-42)

Mi perfil habilita la edición tras cargar el perfil propio. El formulario usa
el `PATCH /usuarios/me` del contrato desplegado, con ocupación, ciudad,
descripción breve y Sobre mí. Manda los campos modificados; borrar un valor
envía `null`. Nombre, edad, fecha de nacimiento y correo quedan fuera del PATCH.
Género y región/comuna de interés requieren la ruta y el esquema acordados con
TI2. La foto tiene su propia tarea.

Tras un PATCH 200 se consulta `GET /usuarios/me` con la misma identidad. La
vista solo se actualiza con ese resultado. Si se rechaza el PATCH, se conserva
el borrador. Si el PATCH responde 200 y falla el GET, se puede volver a consultar
sin repetir el guardado.

Prueba física: editar la ciudad y una descripción en una cuenta de prueba,
guardar, comprobar ambos valores en Mi perfil y cerrar y reabrir Expo Go. Borrar
la descripción y repetir. Si se interrumpe la conexión antes de guardar, el
borrador debe seguir visible y debe ser posible reintentar. La evidencia del
contrato final debe incluir los campos adicionales que TI2 confirme.

Validación física del 17/11/2026 en Expo Go contra Render: se guardaron ciudad,
ocupación y ambas descripciones. Tras cerrar y reabrir, persistieron los datos.
Luego se borraron ambas descripciones y volvió a comprobarse el resultado tras
reabrir. Las capturas muestran el perfil cargado antes y después de ambos guardados.

En Expo Web desde `http://localhost:8081`, el Gateway respondió `200` en
`/health` y `405` sin cabeceras CORS a las preconsultas `OPTIONS` para GET y
PATCH de `/usuarios/me` y POST de `/local/v1/perfil/inicializacion`. El navegador
bloquea las solicitudes de perfil. Para verificar la corrección, TI2 debe
permitir el origen de Expo Web y los métodos y cabeceras correspondientes en el
Gateway. Después se repite la lectura y el guardado en el navegador.
