# Endpoints de arriendos

Estos endpoints pertenecen a la aplicación principal que usa la página.
Con las dependencias de `main/requirements.txt` instaladas y la base PostgreSQL
del proyecto configurada, inicia desde la raíz del repositorio:

```powershell
python -m uvicorn main.main:app --reload --port 8000
```

La base debe incluir el esquema `haycupo`, las tablas existentes y la migración
`publicaciones_service/migrations/001_mascotas_aceptadas.sql`.
Puedes probar las operaciones desde `http://127.0.0.1:8000/docs`, en
**Publicaciones**. El proceso independiente `publicaciones_service.main:app`
conserva su endpoint `/health`.

| Método | Ruta | Resultado |
| --- | --- | --- |
| POST | `/api/publicaciones` | Publica un aviso; responde 201 con su ID. |
| GET | `/api/publicaciones` | Lista avisos, del más reciente al más antiguo. |
| GET | `/api/publicaciones/buscar` | Busca avisos con filtros combinables. |

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
incluidos avisos `busco` y `ofrezco`, sin filtrar por estado.

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

Las pruebas automatizadas validan el contrato HTTP, los filtros y la
parametrización SQL con conexiones simuladas. No escriben en PostgreSQL;
la comprobación contra la base configurada se realiza al levantar la aplicación.
