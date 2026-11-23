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
- FormularioPerfilLocal.tsx: referencia previa para A09; sigue sin montarse.

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

A09 sigue pendiente: acordar campos editables y realizar PATCH seguido de GET.
El PATCH publicado permite editar edad mientras el registro conserva fecha de
nacimiento; esa discrepancia requiere acuerdo antes de habilitar edición. No se
añade verificación documental ni un indicador de identidad validada por documentos.
