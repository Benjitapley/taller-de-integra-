# S3R-E01 · Contrato web y coordinación TI4

Referencia: Contrato Microservicios Sprint 3 v2, §§1.4, 4.1 y 9; backlog v1.4,
pp. 27–28 y §13. Revisión: 26/11/2026, America/Santiago.

## Estado y límites de la evidencia

La implementación web usa el DTO y multipart del release. Este documento es el
guion compartido para TI4 y la ficha de aceptación pendiente. Los ejemplos de
abajo son reproducibles con los dobles HTTP de las pruebas locales; **no son
capturas de un Gateway desplegado ni acreditan Supabase Storage real**.
Las solicitudes y respuestas reales sanitizadas se incorporan al ejecutar el acta.

Actualización posterior: dependencias Next/ESLint Next parcheadas a 16.4.6.
La [auditoría del entorno](../qa/S3R-E01-aceptacion-real.md) documenta las variables
ausentes, las restricciones de topología y los requisitos de base dedicada para
pruebas SQL en 5432. Todavía no hay respuestas reales del Gateway/Storage para
adjuntar; no se reutilizan los fixtures siguientes como evidencia real.

Los archivos se seleccionan en el cliente y se envían al BFF Next, que usa la
sesión HttpOnly para llamar al Gateway. El servicio Listado valida autorización,
bytes, decodificación y referencias antes de confirmar el DTO. Solo Listado escribe
Storage. Web y Expo no reciben claves privilegiadas ni eligen bucket/object_path.

## Solicitudes y respuestas acordadas

### Catálogo, detalle y cursor

```http
GET /api/regiones
GET /api/regiones/9/comunas
GET /api/publicaciones?limite=20&id_region=9&id_comuna=9101&cupos_disponibles=2
GET /api/publicaciones?limite=20&id_region=9&id_comuna=9101&cupos_disponibles=2&cursor=<cursor_recibido_codificado>
GET /api/publicaciones/42
GET /api/publicaciones/mias?limite=20&estado=Disponible
```

Los IDs geográficos se obtienen del catálogo del entorno; los números de estos
ejemplos corresponden al fixture local. El cursor se retransmite opaco con
URLSearchParams, asociado a los mismos filtros. No se calcula ni se pagina en memoria.
Buscar con 2 cupos debe excluir avisos con 1 y 3. La fecha original y el ID ordenan
en el servidor; el cliente conserva ese orden y evita duplicar IDs entre páginas.

```json
{
  "items": [{
    "id_publicacion": 42,
    "tipo": "Arrendador",
    "tipo_vivienda": "Habitacion",
    "titulo": "Aviso E01 con fotografías",
    "descripcion": "Descripción de prueba",
    "precio": 999999999999,
    "region": { "id": 9, "nombre": "La Araucanía" },
    "comuna": { "id": 9101, "nombre": "Temuco" },
    "estado": "Disponible",
    "cupos_totales": 3,
    "cupos_disponibles": 2,
    "imagenes": [{ "id_imagen": 12, "url": "https://images.example.test/12.png" }],
    "mascota": "no",
    "fecha_publicacion": "2026-11-26T12:00:00Z",
    "autor": { "id_usuario": 1, "nombre": "Equipo E01", "foto": null }
  }],
  "siguiente_cursor": "cursor_p2"
}
```

`cursor_p2` es un cursor sintético de prueba, no uno generado por producción.
La última página devuelve `siguiente_cursor: null`. El detalle añade
`reglas_arrendador`, `mi_postulacion` cuando corresponde y `id_arriendo` solamente
para el dueño. Las imágenes finales deben tener URL de la API; una URL blob de
vista previa no demuestra persistencia. Cerrar conserva sus referencias.

### Crear y editar con imágenes

Cliente web: POST `/web-api/publicaciones`; PUT `/web-api/publicaciones/42`.
Gateway para Expo y BFF: POST `/api/publicaciones`; PUT `/api/publicaciones/42`.

```javascript
const body = new FormData();
body.set("tipo", "Arrendador");
body.set("titulo", "Habitación en Temuco");
body.set("descripcion", "Descripción de prueba");
body.set("precio", "999999999999");
body.set("id_region", String(region.id_region));
body.set("id_comuna", String(comuna.id_comuna));
body.set("tipo_vivienda", "Habitacion");
body.set("cupos_totales", "3");
body.set("mascota", "no");
body.set("reglas_arrendador", JSON.stringify(["Sin humo"]));
// Edición: conservar 12, quitar 15 y añadir un archivo nuevo.
body.set("imagenes_conservar", JSON.stringify([12]));
body.append("imagenes", archivoSeleccionado);
await fetch("/web-api/publicaciones/42", {
  method: "PUT", body,
  headers: { "X-Haycupo-CSRF": "1", "Idempotency-Key": idOperacion }
});
```

No fijar Content-Type: fetch genera un boundary consistente con FormData. El BFF
reconstruye FormData después de validarlo y deja que su transporte genere el
boundary nuevo. No serializa a JSON ni reutiliza un boundary del cuerpo anterior.
Expo adapta los archivos con su API nativa y envía el JWT al Gateway, usando los
mismos nombres de campo. El header CSRF pertenece al BFF web.

La misma operación conserva Idempotency-Key al reintentar con el mismo contenido.
Cambiar textos, reglas, fotos o IDs conservados inicia otra operación. Hasta cinco
imágenes entre conservadas y nuevas, JPEG/PNG/WebP, 5000000 bytes por archivo.
`cupos_disponibles` es calculado: solo se envía en filtros, nunca en un formulario.
No enviar `cupos_min`, `categoria`, `ubicacion`, `permitir_comentarios`,
`ids_atributos_evaluables` ni tipo Compartida.

### Errores y cierre

```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{"codigo":"configuracion_bloqueada","mensaje":"Las reglas solo se pueden editar mientras el aviso esté Disponible."}
```

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json

{"codigo":"validacion","mensaje":"Revisa los campos.","detalles":[{"campo":"id_comuna","mensaje":"La comuna no pertenece a la región."}]}
```

Web muestra código, mensaje y detalles por campo. También distingue 401,
403 (correo sin verificar/permisos), 409 (estado/capacidad/reglas), 413, 415 y 503.
No presenta éxito ante error ni descarta los archivos, IDs o textos del formulario.
Los servicios heredados con `detail` tienen un adaptador transitorio; la salida
del BFF de publicaciones usa el envelope canónico.

Cerrar requiere confirmación en la UI y PATCH `/api/publicaciones/42/cerrar`.
Solo la respuesta con ID correcto y estado Cerrada confirma el cierre. Cancelar la
confirmación no envía una mutación. Integrantes e imágenes se conservan.

## Acta de aceptación compartida (pendiente)

| Dato | Resultado real a registrar |
| --- | --- |
| Responsable web | Pendiente de confirmar |
| Responsable nominal TI4 / disponibilidad | Pendiente de confirmar con B01 |
| Gateway compartido y fecha/hora | Pendiente |
| SHA web / SHA o build Expo / digest de servicios | Pendiente |
| Contrato, migraciones y configuración de buckets sin secretos | Pendiente |
| Dispositivo físico / navegador A y B | Pendiente |
| Fotos de prueba aportadas por el equipo | Pendiente |
| PR / Jira | PR pendiente; [SCRUM-118](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-118) |

- [ ] Crear → encontrar → editar → cerrar Arrendador con Gateway y servicios reales.
- [ ] Más de dos páginas, fechas empatadas, cursor inválido/de otro filtro, vacío y fin.
- [ ] Cambiar filtros/cuenta, impedir cargas duplicadas y reintentar una página fallida conservando filas.
- [ ] Cupos exactos 2 excluyen 1 y 3; cambio de capacidad rechazado con 409 sin falso éxito.
- [ ] Solo comunas de La Araucanía en selectores; error 422 visible y otros avisos nacionales conservados.
- [ ] Precio 0 y 999999999999 exactos al editar/recargar; 100.5, -1 y 1000000000000 rechazados.
- [ ] Crear con fotos reales; editar conservando/agregando/quitando; comprobar otra sesión y reinicio.
- [ ] Selección desde celular físico; mismas imágenes visibles en web y Expo.
- [ ] Error/red/Storage caído conserva datos y selección; reintento no duplica operación.
- [ ] Actor ajeno, MIME falso, archivo corrupto, exceso de cantidad/bytes y limpieza recuperable (§13).
- [ ] Confirmar cierre y conservación de imágenes; adjuntar requests/responses sanitizadas.

Una prueba con HTTP simulado o PostgreSQL temporal no marca estas casillas como
aceptadas. Registrar defectos y responsables; los bloqueantes mantienen abierto E01.
