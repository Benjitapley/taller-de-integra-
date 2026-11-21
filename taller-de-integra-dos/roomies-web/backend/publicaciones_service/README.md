# Publicaciones de Benja: integración con dev-web

Port selectivo de `pruebasbenja` (`c9a6b3f`) sobre `dev-web` (`47cd6bd`).
Se conserva la estructura `backend/`, el JWT y los permisos actuales. No se
copian los mecanismos antiguos de cookie/usuario de prueba ni los archivos
HTML, artefactos QA, imágenes de ejemplo o dependencias generadas de esa rama.

El CRUD continúa en `backend/main/main.py`, dentro de la aplicación existente.
Los modelos y esquemas de este paquete preparan la separación del servicio;
importarlos no crea tablas ni ejecuta migraciones.

## Funciones integradas

| Método y ruta | Acceso / comportamiento |
| --- | --- |
| `GET /api/publicaciones` | Catálogo público; conserva los campos anteriores y agrega estado/cupos. |
| `GET /api/publicaciones/buscar` | Mismo contrato y filtros que el catálogo. |
| `GET /api/publicaciones/{id}/cupos` | Capacidad pública: una publicación cerrada devuelve cero disponibles. |
| `GET /api/publicaciones/{id}` | Detalle del editor: JWT y propietario, como en dev-web. |
| `POST /api/publicaciones` | JWT; autor obtenido del token; valida formulario e imagen. |
| `PUT /api/publicaciones/{id}` | JWT y propietario; valida campos y permite reemplazar portada. |
| `PATCH /api/publicaciones/{id}/cerrar` | JWT y propietario; cierre repetible sin borrar ni cambiar capacidad original. |
| `GET /api/mis-publicaciones` | JWT; incluye publicaciones propias cerradas. |
| `DELETE /api/publicaciones/{id}` | Conserva los permisos y transacción existentes. |

Filtros combinables: `consulta`, `personas` (`1`, `2`, `3` para tres o más),
`tipo` (vivienda), `mascotas`, `precio_min`, `precio_max`, `categoria`,
`limite` (1 a 100) y `offset`. Sin `limite` se mantiene el listado completo.
Los caracteres `%`, `_` y `\` de la ubicación se buscan literalmente.

El catálogo excluye las cerradas y selecciona una portada por publicación,
ordenada por `orden`, luego por `id_imagen`. La búsqueda de conexiones admite
los estados existentes `Activa` y `Disponible`; conserva la exclusión de estados
nulos heredados y deja fuera las cerradas. `cupos_disponibles` representa la capacidad publicada,
o cero al cerrar: no descuenta reservas ni conexiones.

En edición, omitir `tipo` o `permitir_comentarios` conserva esos valores.
Sin imagen nueva se conserva la portada; con ella se actualiza la primera
imagen y se conservan las demás. Se comprueban JPG/PNG/WEBP completos, hasta
5 MiB y 20 megapíxeles por cuadro, antes de escribir. Un fallo de guardado
retira el archivo nuevo. Los archivos antiguos conservan la política de
almacenamiento existente: su limpieza queda pendiente.

## Mascotas: compatible con el esquema actual

Por defecto `PUBLICACIONES_MASCOTAS_DETALLE_ENABLED` está desactivado.
En ese modo se mantiene `mascota=si/no` y ninguna consulta utiliza las columnas
nuevas. Enviar detalles nuevos devuelve 503 y no modifica la publicación.

Para habilitar especies y condiciones en un entorno autorizado:

1. Revisar el esquema real y la propuesta
   [`001_mascotas_aceptadas.sql`](../../migration-proposals/publicaciones/001_mascotas_aceptadas.sql).
2. Aplicar esa propuesta únicamente tras autorizar la migración del entorno.
3. Configurar `PUBLICACIONES_MASCOTAS_DETALLE_ENABLED=true` y reiniciar FastAPI.

No se ejecuta SQL automáticamente. Al activar la opción, el arranque comprueba
que existan ambas columnas. Los campos de formulario adicionales son:

- `tipos_mascotas_aceptadas`: lista JSON de `perro`, `gato`, `ave`, `tortuga`,
  `conejo`, `pez` u `otro`.
- `condiciones_mascotas`: texto opcional, obligatorio para `otro`.

Si un cliente envía detalles y acepta mascotas, debe indicar alguna especie.
Los clientes anteriores que omiten ambos campos conservan su contrato `si/no`;
al editar se preservan las preferencias existentes. Seleccionar `no` las limpia.

## Ejecutar y verificar

La aplicación existente sigue arrancando con
`python -m uvicorn backend.main.main:app`. Mantiene sus requisitos de esquema,
variables y habilitación de autenticación; no se modifican sus `.env`.

La base independiente de publicaciones expone solo `/health`, sin consultar BD:

```powershell
python -m uvicorn backend.publicaciones_service.main:app --port 8001
```

Instalar dependencias de prueba en un entorno separado y ejecutar desde la raíz:

```powershell
python -m pip install -r backend/tests/requirements.txt
python -I -B backend/tests/run_isolated.py
```

El runner bloquea red, PostgreSQL y SMTP reales. No usa Supabase, `.env`, correo
externo, Node ni el frontend. Las preferencias de mascotas se prueban con
configuración y datos simulados, sin habilitarlas en el proyecto.

Validación de esta integración: **125 pruebas aisladas aprobadas**, incluidas
las 80 pruebas anteriores de auth/perfil. El intento con PostgreSQL desechable
no pudo arrancar: Device Guard de Windows bloqueó `postgres.exe` antes de crear
el clúster. No se presenta esa prueba como aprobada; queda pendiente ejecutarla
en un equipo que permita ese binario. No se probó el frontend ni una base real
del proyecto.
