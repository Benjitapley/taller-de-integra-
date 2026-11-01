# Endpoints de arriendos

Estos endpoints pertenecen a la aplicación principal que usa la página.
Con las dependencias de `main/requirements.txt` instaladas y la base PostgreSQL
del proyecto configurada, inicia desde la raíz del repositorio:

```powershell
python -m uvicorn main.main:app --reload --port 8000
```

La base debe incluir el esquema `haycupo`, las tablas existentes y la migración
`publicaciones_service/migrations/001_mascotas_aceptadas.sql`.
Configura `DATABASE_URL` en el entorno o en tu archivo `.env` local. La API de
publicaciones, autenticación y conexiones utiliza esa misma variable; no hay una
conexión remota de respaldo. Si falta, se debe corregir la configuración antes
de iniciar. No incluyas sus credenciales en documentos ni capturas.
Puedes probar las operaciones desde `http://127.0.0.1:8000/docs`, en
**Publicaciones**. El proceso independiente `publicaciones_service.main:app`
conserva su endpoint `/health`.

| Método | Ruta | Resultado |
| --- | --- | --- |
| POST | `/api/publicaciones` | Publica un aviso; responde 201 con su ID. |
| GET | `/api/publicaciones` | Lista avisos, del más reciente al más antiguo. |
| GET | `/api/publicaciones/buscar` | Busca avisos con filtros combinables. |
| GET | `/api/mis-publicaciones` | Lista los avisos propios, incluidos los cerrados. |
| GET | `/api/publicaciones/{id}` | Consulta los datos del aviso para editarlo. |
| PUT | `/api/publicaciones/{id}` | Guarda los cambios de un aviso propio. |
| PATCH | `/api/publicaciones/{id}/cerrar` | Cierra un aviso propio y conserva sus datos. |
| GET | `/api/publicaciones/{id}/cupos` | Consulta el estado y los cupos actuales. |

## Editar, cerrar y consultar cupos

Entra a **Mis publicaciones** desde el menú lateral. Cada fila permite editar
el aviso, consultar sus cupos y cerrar la publicación con confirmación.
El formulario de edición carga los datos actuales, acepta una nueva foto y
conserva la portada si no se selecciona otra. Los cupos son una cantidad exacta,
también cuando son más de tres. El PUT valida los mismos campos que la creación;
`tipo` y `permitir_comentarios` conservan su valor si se omiten.

Cerrar guarda `estado=Cerrada`, retira el aviso del listado y de la búsqueda
pública y mantiene su información en Mis publicaciones. Repetir el cierre
devuelve el mismo estado. Editar un aviso cerrado conserva el cierre. Las
operaciones de edición y cierre comprueban el autor mediante la identidad
de demostración descrita más abajo; un aviso inexistente o ajeno responde 404.

La consulta de cupos devuelve, por ejemplo:

```json
{"id": 42, "estado": "Disponible", "cupos_totales": 4, "cupos_disponibles": 4}
```

`cupos_totales` es la cantidad anunciada por el autor. `cupos_disponibles`
devuelve esa cantidad mientras el aviso está abierto y cero al estar cerrado.
No se calculan reservas ni ocupantes. En el inicio, abrir el detalle consulta
los cupos actuales y **Actualizar cupos** permite volver a consultarlos.
Se utiliza la columna `estado` existente; este cambio no agrega columnas.
Las publicaciones antiguas con `estado=NULL` se interpretan como `Disponible`.
La última publicación del perfil también muestra su estado y cero cupos si
está cerrada. El cierre de sesión espera la respuesta de `/auth/logout` para
eliminar la cookie antes de redirigir; la identidad sigue siendo de demostración.

## Publicar

Acepta `multipart/form-data` (incluida una imagen opcional) o un formulario
`application/x-www-form-urlencoded` sin archivo.

| Campo | Validación |
| --- | --- |
| `titulo` | Obligatorio; entre 1 y 200 caracteres. |
| `descripcion` | Obligatorio; entre 1 y 5000 caracteres. |
| `ubicacion` | Obligatorio; entre 1 y 250 caracteres. |
| `precio` | Obligatorio; mayor o igual a 0, hasta 14 dígitos y 2 decimales. |
| `categoria` | Obligatorio: `busco` u `ofrezco`. |
| `tipo` | Obligatorio: `Arrendador` o `Compartida`. |
| `tipo_vivienda` | Obligatorio: `casa`, `departamento` o `habitacion`. |
| `cupos_totales` | Obligatorio; entero entre 1 y 2147483647. |
| `mascota` | `si` o `no`; por defecto `no`. |
| `tipos_mascotas_aceptadas` | Lista JSON como texto, por ejemplo `'["ave","tortuga"]'`. |
| `condiciones_mascotas` | Texto opcional, hasta 2000 caracteres. |
| `permitir_comentarios` | Booleano; por defecto `false`. |
| `imagen` | Archivo JPG, PNG o WEBP opcional; máximo 5 MB. |

Título, ubicación y descripción no pueden contener solamente espacios.
Si `mascota=si`, se exige al menos una especie: `perro`, `gato`, `ave`,
`tortuga`, `conejo`, `pez` u `otro`. Elegir `otro` requiere aclararlo en las
condiciones. Con `mascota=no` se limpian las especies y condiciones.

El autor se obtiene mediante la dependencia de identidad existente
`autor_de_prueba`: lee la cookie `roomies_id` y usa el usuario 1 si no se envía.
Ese usuario debe existir en la base. Esta identidad de demostración sigue
pendiente de sustituirse por una sesión verificada.

Ejemplo desde PowerShell:

```powershell
$arriendo = @{
    titulo = 'Habitacion cerca del centro'
    descripcion = 'Habitacion amoblada con gastos incluidos.'
    ubicacion = 'Temuco'
    precio = '180000'
    categoria = 'ofrezco'
    tipo = 'Compartida'
    tipo_vivienda = 'casa'
    cupos_totales = '1'
    mascota = 'no'
    permitir_comentarios = 'true'
}
Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/publicaciones' -Method Post -ContentType 'application/x-www-form-urlencoded' -Body $arriendo
```

Respuesta `201`:

```json
{"id": 42, "mensaje": "Publicación creada"}
```

## Listar y buscar

Ambas rutas GET aceptan los mismos parámetros opcionales:

| Parámetro | Efecto |
| --- | --- |
| `consulta` | Coincidencia parcial de ubicación, sin distinguir mayúsculas; máximo 250 caracteres. |
| `personas` | `1` y `2` buscan esa cantidad exacta; `3` busca tres o más cupos. |
| `tipo` | `casa`, `departamento` o `habitacion`; corresponde a `tipo_vivienda`. |
| `mascotas` | `si` o `no`; corresponde a `mascota`. |
| `precio_min` | Precio mínimo inclusivo; mayor o igual a 0. |
| `precio_max` | Precio máximo inclusivo; mayor o igual a 0. |
| `categoria` | `busco` u `ofrezco`. |
| `limite` | Entre 1 y 100 resultados; al omitirlo se devuelven todos. |
| `offset` | Cantidad de resultados a omitir; entero entre 0 y 9223372036854775807, por defecto 0. |

Los precios admiten hasta 14 dígitos y 2 decimales. El mínimo no puede superar
al máximo. Todos los filtros se combinan con AND. La ubicación se recorta y
una consulta vacía se ignora; `%` y `_` se buscan literalmente. Omite los
filtros que no uses. Sin filtros, ambas rutas devuelven el mismo listado,
incluidos avisos `busco` y `ofrezco`, excluyendo los de estado `Cerrada`.

```powershell
Invoke-RestMethod 'http://127.0.0.1:8000/api/publicaciones'
Invoke-RestMethod 'http://127.0.0.1:8000/api/publicaciones/buscar?consulta=Temuco&personas=3&tipo=casa&mascotas=si&precio_max=250000&categoria=ofrezco'
Invoke-RestMethod 'http://127.0.0.1:8000/api/publicaciones?limite=20&offset=20'
```

Las respuestas `200` son un array plano, compatible con las tarjetas y el
detalle del inicio. Cada aviso aparece una sola vez, con la primera imagen
ordenada por `orden` e `id_imagen` como portada (`null` si no tiene imágenes).

```json
[
  {
    "id": 42,
    "titulo": "Habitación cerca del centro",
    "precio": 180000.0,
    "ubicacion": "Temuco",
    "cupos_totales": 1,
    "cupos_disponibles": 1,
    "estado": "Disponible",
    "tipo_vivienda": "casa",
    "imagen": null,
    "categoria": "ofrezco",
    "descripcion": "Habitación amoblada con gastos incluidos.",
    "mascota": "no",
    "tipos_mascotas_aceptadas": [],
    "condiciones_mascotas": null
  }
]
```

Sin coincidencias se devuelve `[]`. Los valores inválidos responden `422`;
una imagen demasiado grande responde `413`. Un fallo de persistencia o
consulta responde `500` con un mensaje genérico.

La página utiliza `/api/publicaciones/buscar`; la ruta histórica
`/conexiones/publicaciones/buscar` pertenece al módulo de conexiones y no
comparte este contrato.

## Pruebas

```powershell
python -B -m unittest discover -s tests -v
```

Con Node.js disponible, las comprobaciones de la interfaz se ejecutan con:

```powershell
node tests/test_publicaciones_ui.cjs
```

Las pruebas automatizadas validan el contrato HTTP, los filtros, la configuración
y la parametrización SQL con conexiones simuladas. Las pruebas JavaScript usan
DOM y red simulados para edición, cierre, consultas, sesión, perfil y navegación.
No escriben en PostgreSQL ni sustituyen el recorrido en un navegador real.
