# Microservicio de publicaciones — 1.0.0

Preparación de la semana 1: una aplicación FastAPI independiente, modelos de
publicaciones e imágenes con SQLAlchemy y validación de las mascotas aceptadas.

## Ejecutar la base del servicio

Desde la raíz del proyecto, con el entorno virtual activado:

```powershell
python -m pip install -r publicaciones_service/requirements.txt
python -m uvicorn publicaciones_service.main:app --reload --port 8001
```

El estado se consulta en `http://127.0.0.1:8001/health`:

```json
{"servicio": "publicaciones", "estado": "ok"}
```

La documentación está en `http://127.0.0.1:8001/docs` y muestra la versión
`1.0.0`. El endpoint comprueba que el proceso responde; no comprueba PostgreSQL.
La aplicación independiente expone únicamente `/health`. Las operaciones de
crear, consultar, editar y eliminar publicaciones siguen en `main/main.py`.

## Modelos

- `Publicacion` representa el aviso, su autor, precio, ubicación, cupos y las
  condiciones de mascotas.
- `ImagenPublicacion` representa las imágenes asociadas mediante
  `id_publicacion`.
- Las dos tablas pertenecen al esquema PostgreSQL `haycupo`.

Los nombres de tablas y columnas existentes provienen de las consultas actuales
del proyecto. Los tipos, tamaños y restricciones del ORM son la propuesta de
esta preparación; deben contrastarse con la definición real de PostgreSQL antes
de utilizar el ORM para persistencia. Importar estos modelos o arrancar el
servicio no crea tablas ni ejecuta migraciones.

## Mascotas aceptadas

`mascota` conserva la respuesta `si`/`no`. Cuando se aceptan mascotas,
`tipos_mascotas_aceptadas` guarda una lista, por ejemplo `["ave", "tortuga"]`, y
`condiciones_mascotas` permite aclarar cantidad, tamaño u otros detalles.
`schemas.py` contiene la validación compartida con la API actual.

Las publicaciones nuevas que aceptan mascotas deben especificar al menos un
tipo. Si no se aceptan, se guarda una lista vacía. Las publicaciones antiguas
que aceptaban mascotas sin indicar tipos conservan esa información y se muestran
como “Tipos sin especificar” hasta que su autor las complete.

Para que la API existente pueda guardar estos datos, primero se debe aplicar
manualmente `migrations/001_mascotas_aceptadas.sql` sobre la base PostgreSQL usada
por el proyecto. Se puede abrir y ejecutar desde el editor SQL habitual. Este
script agrega las dos columnas; no configura ni cambia las credenciales de
conexión. El archivo no se ejecuta automáticamente al iniciar ninguna aplicación.

## Alcance de esta semana

Esta carpeta prepara la aplicación y los modelos para continuar separando el
servicio. La conexión propia a PostgreSQL y el traslado del CRUD a este proceso
quedan para una siguiente etapa. Mientras tanto, el formulario sigue trabajando
con la aplicación principal.
