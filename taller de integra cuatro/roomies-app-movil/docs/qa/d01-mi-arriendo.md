# Evidencia — M4S3-D01 · «Mi arriendo» real

Responsable: Matías Araya. Rama `SCRUM-91` (desde `dev-movil`, base «roomies-app-movil v2»). Entrega prevista: 22/11. Contrato: [`arriendos-mi-arriendo.md`](../contracts/arriendos-mi-arriendo.md)
(criterio: vale lo implementado — base «Incorporación v1» —; el Contrato Sprint 3 v2 y el backlog TI2 v1.4 rev. 18/11 se toleran).

**Estado: implementado y verificado de forma automatizada. Falta el recorrido en teléfono contra el
Gateway real; la ficha NO debe pasar a Finalizado hasta completar la sección 3** (regla de Jira del
backlog: «Finalizado requiere evidencia sobre el entorno pactado»).

## 1. Qué se verificó (automatizado)

Comandos desde la raíz móvil. Los resultados corresponden al sandbox de preparación; repetirlos en
tu equipo antes de registrar el SHA.

| Comprobación | Resultado |
| --- | --- |
| `npm run test:arriendos` | 64 pruebas, 0 fallos |
| `npm run test:http`, `test:perfil`, `test:publicaciones`, `test:convivencia` (regresión sobre el v2) | 23 + 19 + 6 + 11, 0 fallos |
| TypeScript 6.0.3 `strict` (+ `noUnusedLocals`/`noUnusedParameters`) sobre los archivos nuevos | Sin errores. Se usaron stubs de React Native/Expo porque no estaban instalados: **repetir `npx tsc --noEmit`** |
| `npx expo lint` | **No ejecutado** (sin dependencias de Expo en el sandbox). Debe correrse localmente |
| Mutaciones (se rompe a propósito el código y la prueba debe fallar) | 26 de 26 detectadas: un 404 sin código dicho «sin arriendo»; un 404 con código tratado como ruta ausente; petición atada a la cuenta (`identidadEsperada`); consulta sin esperar la provisión del perfil; error de provisión ignorado; texto del 403 sin pista del correo; `activos=true`; `rol` además de `es_responsable`; responsable obligatorio; título de otra publicación; quien salió visible; lista simple; 404 sin pertenencia; BR-15; cursor repetido; respuesta tardía; retiro que conserva datos; demo activa por defecto; título inventado; 404 de `/integrantes` como «sin arriendo»; cupos libres sin calcular; `estado` obligatorio en `/mio`; `ocupacion` ignorada; contradicción `ocupacion`/`integrantes_activos`; `version_capacidad` sin validar; lista no disponible = lista vacía |

Qué cubren las pruebas: carga/sin pertenencia/403/error/datos; **cada petición atada a la cuenta y espera de la provisión del perfil (v2)**; 404 contractual; 401/403/503/red/tiempo
agotado; **la respuesta real de TI2 del 18/11 (5 campos, sin `estado`, sin `/integrantes`)**; título de la
publicación como apoyo; respuesta tardía y cambio de cuenta; retiro (datos privados descartados); fallo
transitorio con datos previos; DTO inválidos; tres páginas de integrantes sin duplicados, cursor repetido,
tope de páginas y fallo en la segunda; fotos inseguras; y que el camino de producción no importa mocks ni la
demo. **No** prueban conectividad, JWT real, ni renderizado nativo.

## 2. Ensayo previo con el mock (opcional, no acredita nada)

1. `npm run mock:arriendos` en el PC (puerto 8787).
2. En `.env.local`: `EXPO_PUBLIC_API_URL=http://<IP-del-PC>:8787` (no `localhost`) y reiniciar Expo por completo.
3. Iniciar sesión con una cuenta Supabase real y abrir Chat → Arriendo.
4. Cambiar escenario sin reiniciar: `http://<IP>:8787/__escenario/<nombre>` —
   `base-ti2` (**lo que TI2 tiene hoy**), `base-ti2-sin-arriendo`, `sin-ruta` (404 genérico del Gateway), `activo`, `es-yo`, `paginas`, `sin-arriendo`,
   `retirado`, `error-503`, `lento`, `finalizado`, `sin-publicacion`, `invalido`.

Evidencia del mock = ensayo. **No sirve como evidencia de cierre** («Registrar diferencias de contrato, sin
simular éxito»).

## 3. Recorrido de cierre contra el Gateway real (pendiente)

**Entorno informado por TI2 (18/11):** Gateway `https://roomies-main-api-gateway.onrender.com` (en
`.env.local` como `EXPO_PUBLIC_API_URL`, **sin `/api` al final**); también publicados Auth/Users, Listado y
Match. **No hay URL de Convivencia**, así que hoy `/api/arriendos/...` no debería responder datos.

Antes de empezar, comprobar en el navegador del teléfono:
- Que `/health` de cada servicio responda (si están en el plan gratuito de Render pueden tardar en despertar; el
  cliente HTTP corta a los 15 s y Mi arriendo ofrece Reintentar: «calentar» los servicios antes de la demostración).
- Qué responde `GET /api/arriendos/mio` sin sesión: **401** indica que la ruta existe en el Gateway; **404** indica que
  falta.

**Aceptar una postulación todavía no crea el arriendo** (backlog TI2 / `incorporacion.md`: Listado mantiene
`incorporacion_pendiente: true` hasta F01, 21/11). Los casos 8 y 9 solo pueden hacerse después de esa integración.

Registrar al terminar: SHA móvil `________` · SHA backend `________` · versión de contrato `________` · fecha
`________` · dispositivo/SO `________` · URL Gateway (sin secretos) `________`.

| # | Caso (evidencia exigida) | Pasos | Resultado esperado | Resultado | Captura/video |
| --- | --- | --- | --- | --- | --- |
| 1 | Dos cuentas distintas — con arriendo | Cuenta A con arriendo activo → Chat → Arriendo | Título, ubicación, cupos e integrantes de A; «Responsable» donde corresponda; «Tú» solo si TI2 lo informa (pregunta 5 del contrato) | ☐ | |
| 2 | Dos cuentas distintas — sin arriendo | Cerrar sesión, entrar con cuenta B sin arriendo | «Todavía no tienes un arriendo activo». Nada de A visible | ☐ | |
| 3 | Cambio de cuenta sin cerrar la pantalla | Con la pantalla abierta, cambiar de cuenta | No aparece el arriendo de A mientras carga B | ☐ | |
| 4 | Respuesta tardía | Abrir Mi arriendo y salir/cambiar de cuenta antes de que responda (red lenta) | La respuesta atrasada no actualiza la pantalla ni pisa a otra | ☐ | |
| 5 | 404 según contrato | Cuenta sin arriendo | «Sin arriendo» con «Ir a Buscar». Confirmar que el 404 viene del servicio (`RENTAL_NOT_FOUND`/`no_encontrado`) y no de una ruta ausente en el Gateway | ☐ | |
| 6 | 503 | Provocar 503 del servicio | Error con Reintentar; con datos previos, aviso y última información | ☐ | |
| 7 | Recarga | Cerrar la app por completo y reabrir | Misma información, tomada del servidor | ☐ | |
| 8 | Aceptación → Mi arriendo | Aceptar a la cuenta desde la web (arrendador) y volver a la app | Al enfocar aparece el arriendo sin reiniciar. **Requiere F01** | ☐ | |
| 9 | Retiro | Retirar a la cuenta desde la web y volver a la app | Pierde el arriendo (sin pertenencia o sin permiso); no queda ningún dato en pantalla. **Requiere F01/F03** | ☐ | |
| 10 | 403 | Cuenta sin acceso (p. ej. correo sin confirmar) | «No tienes acceso a este arriendo» con Reintentar | ☐ | |
| 11 | Paginación | Arriendo con más integrantes que una página | Lista completa, sin duplicados. **Requiere `/integrantes`** | ☐ | |
| 12 | Título de la publicación | Comparar con la publicación en la web | Mismo título/ubicación; si listado falla, «Tu arriendo» sin error | ☐ | |
| 13 | Lista de integrantes no disponible | Con la base actual de TI2 (sin `/integrantes`) | Cupos y ocupación visibles; «La lista de integrantes todavía no está disponible»; ninguna persona inventada | ☐ | |
| 14 | Sin datos de demostración | Recorrer Chat → Arriendo | No aparecen Benja/Vale/Pato/Meli, «Providencia» ni «Pagar internet» | ☐ | |
| 15 | Sin secretos | Revisar logs y capturas | Sin JWT ni cabeceras | ☐ | |

Adjuntar además la matriz contractual **confirmada** por Larenas/Benjamín y los JSON sanitizados de `/mio`, `/{id}`
e `/{id}/integrantes`.

## 4. Limitaciones conocidas de esta entrega

- «Chat del arriendo» y «Organización de la casa» aparecen deshabilitados («Disponible próximamente»). D02 y D03
  cambian `CHAT_ARRIENDO_REAL` / `TAREAS_ARRIENDO_REAL` en `src/constants/funcionesArriendo.ts` al integrar sus
  pantallas reales. Las rutas `/arriendo/chat` y `/convivencia/tareas` siguen con su contenido demostrativo hasta
  D02/D03; el bloqueo por ruta directa corresponde a D04.
- La pestaña Chat conserva la tarjeta «Chats» con un contador de muestra (`CHATS_SIN_LEER_MOCK`): es un flujo
  excluido del alcance (B05).
- El dashboard con datos de muestra sigue disponible solo con `EXPO_PUBLIC_CONVIVENCIA_DEMO=1`. Los candidatos y
  demostraciones con API real no deben definir esa variable.
- Mientras `/integrantes` no exista, el chat (avatares) y la lista no muestran personas: es el comportamiento
  esperado, no un error de la app.
