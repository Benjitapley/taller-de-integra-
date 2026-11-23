# Matriz contractual de convivencia — «Mi arriendo»

Ficha M4S3-D01 (rama SCRUM-91, desde `dev-movil`) · cierre de SCRUM-59 / M4-D11 · Responsable: Matías Araya.
Referencia TI2: Larenas F01; Benjamín Cabrera C01; Yamaguchi E00/E02.

## Estado de este documento

**Criterio adoptado: cuando los documentos de TI2 se contradicen, vale lo IMPLEMENTADO («Incorporación v1»).**
El móvil funciona con eso y tolera la forma del Contrato v2; las diferencias quedan registradas en la sección
«Diferencias entre documentos» para ajustar los documentos después, **sin pedir cambios a TI2**. Sigue siendo una
matriz *no validada* hasta que Larenas/Benjamín la confirmen.

| Documento (TI2) | Qué es | Peso |
| --- | --- | --- |
| *Contrato de microservicios Sprint 3 v2* (18/11, «vigente») | El **objetivo** de la API pública | Referencia; el móvil tolera su forma |
| *Backlog TI2 Sprint 3 v1.4, revisión 18/11* | Fichas, decisiones D y fechas (F01 → 21/11) | Las decisiones D prevalecen |
| *Incorporación v1* (`incorporacion.md`, `.openapi.json`, `.evidencia.md`, 18/11) | Lo que **ya está implementado**; «base ejecutable y propuesta de contrato, firmas pendientes» | **Vale en caso de diferencia** (es lo que se probó) |

Precedencia del móvil: lo implementado (Incorporación v1) → decisiones D del backlog TI2 → Contrato v2. Ajustar es
cambiar solo `src/services/arriendosService.ts` (y `src/types/api/ArriendoDto.ts`).

**Integración con el v2 de la app:** la consulta viaja atada a la cuenta (`identidadEsperada`, A01) y espera a que
la provisión del perfil termine, igual que Perfil. El commit de Gustavo en esta misma rama agrega
`ErrorHttp.codigoServicio` (SCRUM-91); D01 lo usa en un segundo paso (ver «Diferencias entre documentos», punto 3).

## Lo que existe hoy frente al objetivo

| Ruta | Hoy (Incorporación v1, 18/11) | Objetivo (Contrato v2, 6.1) |
| --- | --- | --- |
| `GET /api/arriendos/mio` | Implementada. Responde **5 campos**: `id_arriendo`, `id_publicacion`, `cupos_totales`, `version_capacidad`, `ocupacion` | + `estado`, `integrantes_activos`, `cupos_disponibles`, `origen`, `id_responsable`, fechas, `rol`/`es_responsable`, datos del chat |
| `GET /api/arriendos/{id}` | Implementada, mismos 5 campos | «Datos del arriendo, publicación y cupos» |
| `GET /api/arriendos/{id}/integrantes` | **No existe** (ni en el OpenAPI ni en las rutas del Gateway). La implementa F01 (21/11) | Integrantes con `fecha_ingreso`, `fecha_salida`, `es_responsable`; cursor |
| Errores | `{"detail": "...", "code": "RENTAL_NOT_FOUND"}` (códigos en MAYÚSCULAS) | `{"codigo": "no_encontrado", "mensaje": "..."}` |
| Convivencia desplegada | No hay URL de Convivencia entre los servicios publicados (Gateway, Auth, Listado, Match) | — |

## Qué hace el móvil

Todas las rutas son `GET` con `Authorization: Bearer` (cliente HTTP A07), sin cuerpo. La base de
`EXPO_PUBLIC_API_URL` **no** incluye `/api`; las rutas sí.

| Ruta | 200 | Errores y efecto en el móvil |
| --- | --- | --- |
| `/api/arriendos/mio` | Exige `id_arriendo`. Sin `estado` (forma actual) un 200 equivale a pertenencia activa. Usa `es_responsable`/`rol` si llegan | **404** → *sin pertenencia* («Todavía no tienes un arriendo activo»). **401** → error con Reintentar. **403** → *sin permiso*: en lo implementado `FORBIDDEN` significa correo sin confirmar, y la pantalla lo sugiere. **503/red/tiempo agotado** → error con Reintentar (o aviso si ya había datos). `estado = Finalizado` → *sin pertenencia* |
| `/api/arriendos/{id}` | Exige `id_arriendo`, `id_publicacion`, `cupos_totales` y `ocupacion` o `integrantes_activos` | **404** → *sin pertenencia* (el arriendo ya no es de la persona). **403** → *sin permiso*. JSON que no cumple el DTO → «respuesta no interpretable» |
| `/api/arriendos/{id}/integrantes?activos=true&limite=50` | `{items, siguiente_cursor}` (o arreglo simple) | **404 en la primera página** → *lista no disponible*: se muestran cupos y ocupación, y «La lista de integrantes todavía no está disponible»; **no** se dice «sin arriendo» porque `/mio` y el detalle ya confirmaron la pertenencia. 404 en una página posterior → *sin pertenencia*. 403/5xx/red → igual que el detalle |
| `/api/publicaciones/{id_publicacion}` | `titulo`, `ubicacion` (o `comuna`/`region`) | **Solo de apoyo**: si falla, el arriendo se muestra con el rótulo «Tu arriendo». Se omite si el detalle ya trae la publicación |

Orden: `/mio`; luego, en paralelo, el detalle (+ la publicación si no vino embebida) y los integrantes. La
pantalla relee al enfocarse y con Reintentar; una respuesta tardía se descarta al cambiar de cuenta o salir.

## DTO que el móvil acepta

### Arriendo (`/mio` y `/{id}`)

| Campo | Tipo | Móvil | Notas |
| --- | --- | --- | --- |
| `id_arriendo`, `id_publicacion` | entero ≥ 1 | obligatorios | REF a listado; sin capacidad propia (BR-13) |
| `cupos_totales` | entero ≥ 1 | obligatorio | |
| `integrantes_activos` **o** `ocupacion` | entero 0..`cupos_totales` | uno obligatorio | Contrato v2 / base actual. Si llegan ambos deben coincidir; si superan los cupos se rechaza (BR-15) |
| `estado` | `Activo` \| `Finalizado` | opcional, validado | Ausente = `Activo` (un 200 solo existe con pertenencia activa) |
| `cupos_disponibles` | entero \| null | opcional | Ausente → se calcula `cupos_totales − integrantes` (BR-14). `null` explícito → «no disponible», no se calcula |
| `version_capacidad` | entero ≥ 1 | opcional, validado | No se usa |
| `origen`, `id_responsable`, `fecha_inicio`, `fecha_fin` | — | opcionales, validados | No se muestran aún. `id_responsable = null` en una vacancia |
| `es_responsable` o `rol` (solo `/mio`) | booleano / enum | opcional | Muestra «Eres el responsable de este arriendo» |
| `publicacion` (si el detalle la embebe) | `{titulo, ubicacion?}` | opcional | Evita la consulta a listado |

### Integrante (cada elemento de la lista, cuando exista)

| Campo | Tipo | Móvil | Notas |
| --- | --- | --- | --- |
| `id_usuario` | entero ≥ 1 | obligatorio | |
| `nombre` | texto no vacío | obligatorio | Plano o dentro de `usuario` (como el resumen de conexiones, 5.1) |
| `foto` | URL \| ruta raíz \| null | opcional | Lo inseguro se descarta y se muestra la inicial |
| `es_responsable` **o** `rol` | booleano / enum | uno obligatorio | Si se contradicen, se rechaza |
| `fecha_salida` | fecha \| null | opcional | Con valor = ya salió; no se muestra como residente |
| `es_yo` | booleano | opcional | **No está en ningún documento.** Si llega, se muestra «Tú» |

Los campos adicionales no amplían el contrato y se ignoran.

## Diferencias entre documentos (se toma lo implementado como válido)

Ninguna se pide corregir a TI2 por ahora; se anotan para ajustar los documentos después.

| # | Tema | Implementado (válido) | Contrato v2 | Qué hace el móvil |
| --- | --- | --- | --- | --- |
| 1 | Arriendo ajeno o ya retirado | **404** `RENTAL_NOT_FOUND` | **403** `sin_permiso` (cap. 1.4) | 404 → sin pertenencia; 403 también se maneja (no se rompe si TI2 cambia) |
| 2 | Campos de `/mio` y `/{id}` | 5 campos (`ocupacion`, `version_capacidad`, sin `estado`) | `estado`, `integrantes_activos`, `cupos_disponibles`, `origen`, `id_responsable`, fechas, `rol`/`es_responsable` (cap. 6.3) | Acepta ambas; sin `estado` un 200 = pertenencia activa; calcula cupos libres (BR-14) |
| 3 | Formato de error | `{"detail", "code"}` (`code` en MAYÚSCULAS) | `{"codigo", "mensaje"}` (slug) | Hoy el cliente HTTP no lee el cuerpo. Gustavo expone `ErrorHttp.codigoServicio` (lee `code` o `codigo`); un 404 **con** código es del servicio («sin arriendo») y **sin** código es del Gateway («Ruta no disponible»). D01 lo aplica en un segundo paso |
| 4 | `/integrantes` | **No existe** (llega con F01, 21/11) | Lista con `es_responsable`, fechas y cursor (cap. 6.1) | 404 en la primera página → «La lista de integrantes todavía no está disponible» |
| 5 | Quién es «yo» | Ningún documento lo define | Tampoco | «Tú» solo si llega `es_yo`; alternativa: comparar con `id_usuario` de `GET /api/usuarios/me` (A02) |
| 6 | Convivencia desplegada | Sin URL entre las publicadas (Gateway, Auth, Listado, Match) | — | Hoy `/api/arriendos/...` probablemente no responda datos; ver `docs/qa/d01-mi-arriendo.md` |

## Qué confirman los documentos

- **Paginación** de listas que pueden crecer con `{items, siguiente_cursor}` y `limite` 1-100 (contrato 1.3; backlog
  §5/D06); «Mi arriendo» único no se pagina.
- **503 nunca** se transforma en lista vacía ni en cupos inventados (contrato 1.4; E02). El móvil muestra error con
  Reintentar.
- **Retiro (F03/D05):** quien es retirado pierde «Mi arriendo»; el responsable retirado deja `id_responsable` en
  null y no bloquea nada. El móvil descarta los datos al recibir 404/403/401 en la relectura.
- **Dueño del aviso y admin** no se incorporan ni leen el arriendo como residentes (contrato 1.2, 6.1): su `/mio`
  es 404 y ven «sin arriendo».
- **Alcance v2:** solo origen Arrendador, un chat de texto por arriendo sin tiempo real, sin documentos ni
  recordatorios.
- **Fotos:** URLs públicas de Supabase Storage; el móvil acepta HTTP(S) y descarta `blob:`, `file:`, `data:`.
- **Acceso:** el móvil nunca toca PostgreSQL ni Storage; solo el Gateway (backlog TI4 §5).

## Hallazgos que afectan a otras fichas

- **B04 (Javier):** `GET /api/publicaciones/mias` y el detalle del dueño traen `id_arriendo` (null si no hay arriendo)
  para abrir los integrantes (contrato 4.1). La lectura de `/integrantes` por el dueño es del contrato v2 y aún no
  está implementada. Retiro: `POST /api/arriendos/{id}/expulsiones` con `{id_usuario, motivo, confirmo: true}`.
- **C03/C04 (Abdiel):** `Postulacion.id_arriendo` llega solo si está `Aceptada`; la aceptación se confirma cuando la
  incorporación se concretó (8.3). Hoy Listado conserva `incorporacion_pendiente: true`: aceptar **todavía no llama a Convivencia** ni crea el arriendo (se conecta con F01).
- **A02 (Gustavo):** conservar `id_usuario` del perfil propio si se usa la alternativa del punto 5 de «Diferencias entre documentos».
- **D02 (Matías):** un chat de texto por arriendo, creado al incorporar o al consultar (6.4). Ya no se habla de
  nombres «Roomie»/«Arriendo»; viene un «nombre visible» en `GET /api/conversaciones`.
- **D03 (Matías):** solo el asignado activo completa; sin borrado, fecha límite ni reapertura; `PATCH /api/tareas/{id}`
  solo acepta `id_asignado` (6.3).

## Verificación

- Pruebas automatizadas: `npm run test:arriendos` (61 pruebas con transporte controlado).
- Ensayo manual sin backend: `npm run mock:arriendos` (solo desarrollo; **no acredita integración**); los escenarios
  `base-ti2` reproducen lo que TI2 tiene hoy.
- Evidencia exigida para cerrar la ficha: [`docs/qa/d01-mi-arriendo.md`](../qa/d01-mi-arriendo.md).
