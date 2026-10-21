# taller-de-integra-
Trabajo semestral - Sistema Roomies ("¿Hay cupo?")

## Tailwind CSS

Las pantallas cargan `PaginaPrincipal/tailwind.css`, servido por FastAPI como
`/static_principal/tailwind.css`. El CSS compilado se incluye en el proyecto:
para abrir la aplicación no hace falta descargar Tailwind ni ejecutar otro servidor.

La configuración está en `styles/tailwind.input.css`. Tailwind utiliza el prefijo
`tw:` para convivir con las clases actuales y omite Preflight para conservar
los estilos base de formularios, títulos y botones.

```html
<div class="tw:flex tw:flex-col tw:gap-4 tw:sm:flex-row">
    <!-- Contenido adaptable al ancho de la pantalla -->
</div>
```

Después de agregar o cambiar clases Tailwind en HTML o JavaScript, recompila desde
la raíz del proyecto:

```powershell
.\.venv\Scripts\python.exe scripts/build_tailwind.py
```

Para recompilar automáticamente mientras editas:

```powershell
.\.venv\Scripts\python.exe scripts/build_tailwind.py --watch
```

El CSS se genera con saltos de línea para poder leerlo. Para obtener una versión
comprimida al preparar una publicación del sitio, agrega `--minify`:

```powershell
.\.venv\Scripts\python.exe scripts/build_tailwind.py --minify
```

El script para Windows x64 descarga una sola vez el compilador oficial independiente
de Tailwind **4.3.3** en `.tools/`, comprueba su SHA256 y genera el CSS. No requiere
Node.js. `.tools/` no se sube al repositorio; `PaginaPrincipal/tailwind.css` sí.
Los comandos usan el entorno virtual `.venv` del proyecto; si usas otro entorno,
puedes ejecutar el mismo script con su intérprete de Python.
Cuando una utilidad sustituye una regla del CSS existente, se usa `!` al final,
por ejemplo `tw:gap-4!`. Las clases que se insertan desde JavaScript deben escribirse
completas para que el compilador las detecte.

Referencias: [CLI oficial](https://tailwindcss.com/docs/installation/tailwind-cli),
[integración sin Preflight](https://tailwindcss.com/docs/preflight#disabling-preflight).

## Publicaciones — semana 1, versión 1.0.0

La base independiente está en [publicaciones_service](./publicaciones_service/README.md).
La API actual permite indicar varias mascotas aceptadas y sus condiciones al crear o editar.

Antes de iniciar la aplicación actualizada, ejecuta en PostgreSQL el script
[001_mascotas_aceptadas.sql](./publicaciones_service/migrations/001_mascotas_aceptadas.sql).
Agrega dos columnas; conserva las publicaciones existentes y puede ejecutarse de nuevo.
Las publicaciones antiguas que aceptaban mascotas sin indicar especies se muestran como
«Tipos sin especificar». Cambiar sus preferencias exige seleccionar un tipo.

En formularios `multipart/form-data`, `mascota` sigue siendo `si` o `no`;
`tipos_mascotas_aceptadas` es una cadena JSON, por ejemplo `["ave", "tortuga"]`,
y `condiciones_mascotas` es texto opcional (máximo 2000 caracteres).
Si se selecciona `otro`, las condiciones deben indicar qué animal se acepta.

Para instalar las dependencias de la aplicación principal:

```powershell
python -m pip install -r main/requirements.txt
```

Pruebas locales de validación, API y estado del microservicio, sin conexión a la base:

```powershell
python -B -m unittest discover -s tests -v
```

## API de arriendos

La aplicación principal expone `POST /api/publicaciones` para publicar,
`GET /api/publicaciones` para listar y `GET /api/publicaciones/buscar` para
buscar con filtros. El botón **Consultar** del inicio usa la búsqueda del backend.

Consulta los campos, ejemplos de PowerShell y respuestas en
[la guía de endpoints de arriendos](./main/README.md).

## Pruebas Manuales (QA)
Para consultar y registrar las pruebas manuales de los flujos de **Autenticacion** y **Publicaciones**, revisa el documento en:
- [Guia de Pruebas Manuales: Auth y Publicaciones](./taller%20de%20integra%20dos/endpoint/manual-testing-auth-publicaciones.md)
