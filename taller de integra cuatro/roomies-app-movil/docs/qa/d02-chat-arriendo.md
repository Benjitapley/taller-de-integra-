# Evidencia — M4S3-D02 · Chat persistente del arriendo

Responsable: Matías Araya. Entrega prevista: 24/11. Dependencias: D01 (Mi arriendo) y TI2 F02 (API de chat, prevista 23/11).
Contrato: Contrato de microservicios Sprint 3 v2, cap. 6.4. **No hay nada de chat implementado en TI2 todavía**
(`incorporacion.md` solo cubre arriendos), así que esta ficha se apoya en el contrato v2 y en la ficha S3R-F02.

**Estado: implementado y verificado de forma automatizada y con un mock. Falta el recorrido en teléfono contra la API
real (F02); la ficha NO debe pasar a Finalizado hasta completar la sección 4.**

## 1. Qué espera la app de la API (contrato v2, 6.4)

| Ruta | Uso en la app |
| --- | --- |
| `GET /api/conversaciones` | Busca la conversación de convivencia del arriendo (solo se usa `id_conversacion`) |
| `GET /api/conversaciones/{id}` | Comprueba el acceso; `403 sin_permiso` = ya no participa |
| `GET /api/conversaciones/{id}/mensajes?limite=&antes=` | Historial hacia atrás; respuesta `{items, siguiente_cursor}`; el cursor se envía como `antes` |
| `POST /api/conversaciones/{id}/mensajes` | `{contenido (1-2000), id_cliente (uuid)}`; sin `Idempotency-Key`; 201 al crear, 200 si es un reintento ya guardado |
| `GET` del perfil propio | Solo para conocer `id_usuario` y marcar los mensajes propios |

Decisiones de la app:
- **Mensajes propios:** se comparan `id_emisor` con el `id_usuario` del perfil. Si el perfil **no** trae `id_usuario` (el
  perfil desplegado puede no incluirlo), es propio el mensaje que trae `id_cliente`, porque el contrato lo devuelve solo al
  emisor. Un `id_usuario` presente pero mal formado se rechaza como respuesta inválida.
- **Reintentos:** el mismo `id_cliente` en todos los reintentos de un mensaje; timeout o corte no duplican.
- **Pérdida de acceso:** un 403 (o 404 con el chat abierto) borra de la memoria los mensajes y el usuario; no se conserva nada privado.
- **Sin tiempo real:** el chat se consulta al abrir y con «Actualizar» (alcance TI2 v2).
- **Nombres:** la API no entrega nombre ni foto del emisor; los demás integrantes se muestran como «Integrante».

## 2. Qué se verificó (automatizado)

| Comprobación | Resultado |
| --- | --- |
| `npm run test:chat` | 44 pruebas, 0 fallos |
| `test:http`, `test:perfil`, `test:publicaciones`, `test:convivencia`, `test:arriendos` (regresión) | 23 + 19 + 6 + 11 + 64, 0 fallos |
| TypeScript 6.0.3 `strict` sobre el código de chat y D01 | Sin errores (con stubs de React Native/Expo: **repetir `npx tsc --noEmit`**) |
| `npx expo lint` | **No ejecutado** por quien preparó este parche; correrlo localmente |
| Mutaciones sobre el respaldo por `id_cliente` y el estado del usuario | 5 de 5 detectadas |

## 3. Ensayo con el mock (no acredita nada)

1. `npm run mock:arriendos`; en `.env.local`, `EXPO_PUBLIC_API_URL` apuntando al mock (`http://localhost:8787` en navegador, o la IP del PC en teléfono) y `EXPO_PUBLIC_CONTRATO_PERFIL` vacío. Reiniciar con `npx expo start -c`.
2. Entrar con una cuenta real, abrir Chat → Arriendo → tarjeta «Chat del arriendo» (el mock responde a `/usuarios/me` con `id_usuario` 7).
3. Cambiar de escenario (reinicia los mensajes): `http://<host>:8787/__chat/<nombre>`.

| Escenario | Qué debes ver |
| --- | --- |
| `chat` | 6 mensajes; los de «Tú» a la derecha, los demás como «Integrante»; al enviar, pasa de pendiente a confirmado |
| `chat-vacio` | «Aún no hay mensajes. Escribe el primero.» |
| `chat-historial` | 75 mensajes con separadores de día; «Cargar mensajes anteriores» en 4 páginas (20/40/60/75), sin repetidos y sin saltos del scroll |
| `chat-ingreso-tardio` | Solo 13 mensajes (desde el 8): lo anterior a tu ingreso no aparece |
| `chat-envio-falla-una-vez` | Al enviar queda «No se envió» con Reintentar; al reintentar aparece **una sola vez** (también tras «Actualizar») |
| `chat-llegan-mensajes` | Cada «Actualizar» trae un mensaje nuevo de otro integrante (hasta 5), sin duplicar |
| `chat-sin-conversacion` | «Todavía no hay un chat de arriendo» |
| `chat-retirado` | Con el chat abierto, al actualizar o enviar: «Los mensajes de esta conversación ya no están disponibles…» y no queda nada en pantalla |
| `chat-perfil-sin-id` | Se ven bien tus mensajes aunque el perfil no traiga `id_usuario` (tras enviar y tras actualizar) |

## 4. Recorrido de cierre contra la API real (pendiente de F02)

Registrar: SHA móvil `____` · SHA backend `____` · fecha `____` · dispositivo `____` · URL del Gateway `____`.

| # | Caso (evidencia exigida) | Pasos | Esperado | Resultado | Evidencia |
| --- | --- | --- | --- | --- | --- |
| 1 | Dos integrantes conversan web/móvil | Enviar desde un cliente y «Actualizar» en el otro | El mensaje aparece una vez en ambos | ☐ | |
| 2 | Historial persistido | Cerrar la app y reabrir | Mismos mensajes, sin duplicados | ☐ | |
| 3 | Fallo después del envío | Cortar la red justo tras enviar y reintentar | Un solo mensaje en la API | ☐ | |
| 4 | Duplicado | Pulsar enviar dos veces rápido | Un solo mensaje | ☐ | |
| 5 | Tres páginas | Chat con más de 40 mensajes | Tres páginas hacia atrás, sin repetidos | ☐ | |
| 6 | Mensajes simultáneos | Dos cuentas escriben a la vez | Todos aparecen, en orden, una vez | ☐ | |
| 7 | Ingreso tardío | Cuenta que ingresó después | No ve mensajes anteriores a su ingreso | ☐ | |
| 8 | Retiro durante la lectura | Retirar a la cuenta con el chat abierto | 403 → pantalla sin acceso y sin datos | ☐ | |
| 9 | Marca de mensajes propios | Con el perfil real | Burbujas correctas (por `id_usuario` o por `id_cliente`) | ☐ | |
| 10 | Sin secretos | Revisar logs y capturas | Sin JWT ni cabeceras | ☐ | |

Adjuntar JSON sanitizados de `GET /api/conversaciones`, `/{id}/mensajes` y de la respuesta del `POST`.

## 5. Limitaciones conocidas
- Los demás integrantes se muestran como «Integrante» hasta que haya un endpoint de integrantes con nombres (D01).
- La pantalla del chat demostrativo (`/chats/[id]`) no cambia.
- Si el perfil falla (red, 5xx) el chat muestra error con Reintentar; no pierde el acceso por ello.
