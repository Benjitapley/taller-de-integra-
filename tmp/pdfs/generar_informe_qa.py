from pathlib import Path
from html import escape
import json
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tmp/pdfs/deps'))
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, PageBreak, Spacer, XPreformatted
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

OUT = ROOT / 'output/pdf/informe_pruebas_endpoints_permisos_swagger.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
def read(name):
    return json.loads((ROOT / 'output/qa' / name).read_text(encoding='utf-8'))
summary = read('resumen.json')
permissions = read('permisos.json')
contracts = read('contratos.json')
swagger = read('swagger.json')
http = read('http_swagger.json')
schema = read('openapi_auditado.json')
assert summary['adicionales'] == {'casos':123, 'pass':91, 'fail':30, 'info':2}
assert len(permissions['casos']) == 55 and len(contracts['casos']) == 29
for name, filename in [('Segoe','segoeui.ttf'),('SegoeBold','segoeuib.ttf'),('Consolas','consola.ttf')]:
    pdfmetrics.registerFont(TTFont(name, 'C:/Windows/Fonts/' + filename))
pdfmetrics.registerFontFamily('Segoe', normal='Segoe', bold='SegoeBold', italic='Segoe', boldItalic='SegoeBold')
P = colors.HexColor('#382384')
INK = colors.HexColor('#29253D')
MUTED = colors.HexColor('#656077')
PALE = colors.HexColor('#F3F0FA')
LINE = colors.HexColor('#E4DFEF')
PW,PH = A4
WIDTH = PW - 92
styles = getSampleStyleSheet()
for data in [
    dict(name='BodyReport', fontName='Segoe', fontSize=10, leading=14, textColor=INK, spaceAfter=8),
    dict(name='SmallReport', fontName='Segoe', fontSize=8.6, leading=11.8, textColor=MUTED, spaceAfter=6),
    dict(name='LabelReport', fontName='SegoeBold', fontSize=9, leading=12, textColor=P, spaceAfter=7),
    dict(name='TitleReport', fontName='SegoeBold', fontSize=32, leading=37, textColor=P, spaceAfter=16),
    dict(name='SectionReport', fontName='SegoeBold', fontSize=22, leading=27, textColor=P, spaceAfter=14),
    dict(name='SubReport', fontName='SegoeBold', fontSize=12, leading=17, textColor=P, spaceBefore=8, spaceAfter=6),
    dict(name='CellReport', fontName='Segoe', fontSize=8.3, leading=11.5, textColor=INK),
    dict(name='HeadReport', fontName='SegoeBold', fontSize=8.3, leading=11.5, textColor=colors.white),
    dict(name='CodeReport', fontName='Consolas', fontSize=7.8, leading=11, textColor=INK, backColor=PALE, borderPadding=8, spaceAfter=12),
]:
    styles.add(ParagraphStyle(**data))
story=[]
def p(text, style='BodyReport'):
    story.append(Paragraph(text, styles[style]))
def sub(text): p(text,'SubReport')
def bullet(text): p('• '+text)
def code(text):
    story.append(Spacer(1,10))
    story.append(XPreformatted(escape(text), styles['CodeReport']))
def page(n,title,intro=None):
    if story: story.append(PageBreak())
    p(f'{n:02d} / PRUEBAS Y EVIDENCIAS','LabelReport')
    p(title,'SectionReport')
    if intro: p(intro)
def table(headers,rows,widths):
    data=[[Paragraph(escape(h),styles['HeadReport']) for h in headers]]
    data.extend([[Paragraph(str(c),styles['CellReport']) for c in row] for row in rows])
    t=Table(data,colWidths=widths,repeatRows=1,hAlign='LEFT')
    t.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),P),('VALIGN',(0,0),(-1,-1),'TOP'),
        ('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),
        ('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,PALE]),
        ('LINEBELOW',(0,-1),(-1,-1),.6,LINE)]))
    story.append(t); story.append(Spacer(1,9))
def furniture(c,doc):
    c.saveState(); c.setFont('Segoe',8); c.setFillColor(MUTED)
    c.drawString(46,PH-27,'¿HAY CUPO?  /  ENDPOINTS, PERMISOS Y SWAGGER')
    c.setStrokeColor(LINE); c.line(46,PH-36,PW-46,PH-36)
    c.drawString(46,27,'01 de noviembre de 2026  ·  America/Santiago')
    c.drawRightString(PW-46,27,f'{doc.page} / 8'); c.restoreState()

# 1.
p('TALLER DE INTEGRACIÓN II','LabelReport')
story.append(Spacer(1,13))
p('Probar endpoints,<br/>permisos y<br/>documentación Swagger','TitleReport')
p('Informe de ejecución, resultados y problemas reproducidos','SubReport')
p('Proyecto Roomies - ¿Hay cupo?  |  Producto revisado: commit 63b8493')
p('Se ejecutaron las pruebas existentes y nuevas matrices de permisos, contratos y documentación. Se añadieron cuatro verificadores reproducibles y evidencias JSON. No se modificó la lógica de la aplicación ni se escribieron usuarios, imágenes o avisos reales.')
table(['Comprobación','Casos','PASS','FAIL','INFO'],[
    ['Suite Python existente','53','53','0','0'],
    ['Permisos y cierre de sesión','55','40','15','0'],
    ['Contratos y robustez','29','20','9','0'],
    ['Swagger / OpenAPI','28','20','6','2'],
    ['HTTP local y CDN de documentación','11','11','0','0'],
],[235,60,65,65,WIDTH-425])
p('La suite JavaScript también pasó. Las matrices adicionales suman <b>123 comprobaciones: 91 PASS, 30 FAIL y 2 INFO</b>. Varias filas detectan la misma causa: no equivalen a 30 vulnerabilidades distintas.')
sub('Veredicto')
p('<b>Pruebas terminadas; sistema no aprobado para producción.</b> Los flujos normales y los filtros de dueño funcionan, pero la identidad se puede suplantar y el acceso privado permanece disponible sin sesión. Hay fallos de robustez y documentación que también deben corregirse.')
p('Un FAIL compara el resultado con una política segura o robusta. Puede ser una limitación conocida de la demostración, no una regresión reciente. Se conservaron las expectativas y los resultados negativos; no se ajustaron para producir un informe completamente verde.','SmallReport')

# 2.
page(2,'Método, aislamiento y archivos entregados')
p('Las rutas reales de publicaciones y autenticación se cargaron con el router de conexiones sustituido. Las matrices usan TestClient, conexiones falsas que aplican dueño y archivos simulados. Se bloqueó psycopg.connect y se sustituyó load_dotenv para impedir el uso de PostgreSQL o credenciales reales.')
p('El smoke HTTP utilizó un servidor Uvicorn temporal en 127.0.0.1, con puerto libre y lifespan desactivado. Se consultaron documentos, páginas y recursos estáticos; el servidor quedó detenido al terminar. Los tres recursos públicos del CDN se descargaron solo para comprobar disponibilidad, sin ejecutar JavaScript.')
table(['Archivo / carpeta','Contenido'],[
    ['scripts/<br/><b>verificar_permisos_publicaciones.py</b>','55 casos de identidad, dueño, anónimo, cookie inválida/forjada y cierre de sesión.'],
    ['scripts/<br/><b>verificar_contratos_publicaciones.py</b>','29 casos de errores, archivos, datos antiguos, recursos inexistentes y proveedor geográfico simulado.'],
    ['scripts/<br/><b>verificar_swagger_publicaciones.py</b>','28 criterios de HTML, OpenAPI, esquemas, seguridad y coherencia de errores.'],
    ['scripts/<br/><b>verificar_http_swagger.py</b>','8 comprobaciones por TCP local y 3 de recursos del CDN.'],
    ['output/qa/<br/><b>permisos.json / contratos.json</b>','Cada solicitud, resultado esperado/obtenido y escrituras o bytes simulados.'],
    ['output/qa/<br/><b>swagger.json / openapi_auditado.json</b>','Criterios y copia del esquema auditado de publicaciones/auth.'],
    ['output/qa/<br/><b>http_swagger.json / resumen.json</b>','Resultados HTTP y consolidación de esta revisión.'],
    ['output/qa/<br/><b>LEEME.md / unittest_log.txt</b>','Comandos, límites y log de las 53 pruebas Python.'],
],[245,WIDTH-245])
p('Las identidades y registros son ficticios: publicaciones 42 del autor 1, 43 del autor 2 y 44 del autor 37. Cada caso aislado reinicia los datos para que un borrado no altere otra comprobación. El flujo login/logout sí conserva la cookie y los datos entre sus pasos.','SmallReport')

# 3.
page(3,'Permisos: matriz ejecutada')
p('Se distingue <b>comprobar al dueño en SQL</b> de <b>autenticar a la persona</b>. Las cookies numéricas permiten probar el filtro de dueño, pero no representan sesiones verificadas. La expectativa de seguridad es 401 para una operación privada sin una sesión válida.')
table(['Actor / situación','Casos','PASS / FAIL','Resultado observado'],[
    ['Identidad declarada 1','11','11 / 0','Operaciones públicas y propias responden como se esperaba en la fixture.'],
    ['Identidad declarada 2','11','11 / 0','Puede operar sobre sus datos; editar, cerrar o borrar el aviso 42 devuelve 404 sin escrituras ajenas.'],
    ['Sin cookie','11','4 / 7','Lo público funciona. Las siete operaciones privadas devuelven 200/201 usando usuario 1 en lugar de 401.'],
    ['Cookie no numérica abc','11','11 / 0','Lo público funciona; las siete operaciones privadas responden 401 antes de consultar la base.'],
    ['Cookie forjada 37','7','0 / 7','Las siete operaciones privadas aceptan ese ID sin comprobar una sesión.'],
    ['Recurso inexistente','3','3 / 0','PUT, PATCH y DELETE del aviso 999 responden 404.'],
    ['Login y logout','1','0 / 1','Después de eliminar la cookie, vuelve a acceder como usuario 1.'],
],[130,43,72,WIDTH-245])
sub('Operaciones privadas cubiertas')
code('GET    /api/mis-publicaciones\nPOST   /api/publicaciones\nPUT    /api/publicaciones/{id}\nPATCH  /api/publicaciones/{id}/cerrar\nDELETE /api/publicaciones/{id}\nGET    /api/perfil\nPUT    /api/perfil')
p('Listado, búsqueda, detalle y consulta de cupos se consideran públicos en esta matriz y se comprobaron con y sin cookie. Su acceso anónimo es un PASS, no una omisión de seguridad.','SmallReport')

# 4.
page(4,'Fallo principal: identidad y cierre de sesión')
sub('1. Sin sesión se usa el usuario 1')
p('<b>Referencia:</b> main/main.py:89, autor_de_prueba. El parámetro Cookie tiene default="1" y los números positivos se aceptan como identidad. Sin cookie, las operaciones privadas usan al autor 1; cambiar el número suplanta otro ID. El filtro SQL de dueño no impide esta suplantación.')
table(['Comprobación','Esperado seguro','Obtenido'],[
    ['Publicar sin cookie','401; sin escritura','201; autor simulado 1.'],
    ['Editar/cerrar/borrar aviso 42 con ID declarado 2','404; sin cambio ajeno','404; sin escrituras ajenas: correcto.'],
    ['Operar con cookie forjada 37','401; identidad no validada','200/201; opera como autor 37.'],
],[220,125,WIDTH-345])
sub('2. Logout elimina la cookie, pero no elimina el acceso privado')
code('Login usuario QA 2 -> 200\nGET propias -> 200; devuelve aviso 43\nPOST /auth/logout -> 200; cookie eliminada\nGET propias sin cookie -> 200; devuelve aviso 42 del usuario 1\nEsperado seguro al terminar -> 401')
p('La llamada de logout y la eliminación de la cookie funcionan. El fallo está en el respaldo del backend al usuario 1: al salir se recupera acceso privado bajo esa identidad. La secuencia se probó con las rutas reales de login/logout y una base simulada.')
sub('Qué debe cambiar')
p('Obtener el autor de una sesión verificable, eliminar el respaldo automático y rechazar a quien no tenga sesión válida. Después debe declararse el mecanismo de seguridad en OpenAPI. Añadir un candado o un campo de cookie en Swagger por sí solo no autentica al usuario.')
p('El código conserva autenticación de demostración y comparación directa de contraseña en SQL. Esa observación de implementación debe revisarse antes de utilizar cuentas reales; no se migraron cuentas ni se cambiaron contraseñas durante estas pruebas.','SmallReport')

# 5.
page(5,'Contratos y robustez: 29 casos adicionales')
table(['Grupo de casos','Esperado / obtenido','Evaluación'],[
    ['ID no entero en detalle, cupos, edición, cierre y eliminación','422 en los cinco casos.','PASS'],
    ['Detalle/cupos inexistentes y ruta buscar','404 / 404 / 200. /buscar no se interpreta como un ID.','PASS'],
    ['POST JSON y archivos inválidos','JSON no cumple el formulario: 422. No imagen y GIF: 422. Más de 5 MB: 413. PNG válido: 201.','PASS'],
    ['Rango de precio inválido','422 antes de consultar.','PASS'],
    ['Autocompletado','503 sin clave; 422 texto corto; 502 proveedor simulado fallido; blanco devuelve 200 y [].','PASS'],
    ['Campos antiguos NULL en ambos listados','Precio, título y cupos: 6 casos devuelven 500 en vez de tolerar o tratar explícitamente la fila.','6 FAIL'],
    ['Perfil inexistente','Se esperaba 404; devuelve 500.','1 FAIL'],
    ['Foto de perfil no imagen','Se esperaba rechazo 422; acepta 16 bytes de texto y responde 200.','1 FAIL'],
    ['Foto de perfil mayor a 5 MB','Se esperaba rechazo 413; responde 200 y truncaría el archivo a 5242880 bytes.','1 FAIL'],
],[150,WIDTH-215,65])
sub('Causas de los resultados negativos')
p('<b>Datos antiguos:</b> main/main.py:267 convierte precio a float y el contrato de respuesta exige varios campos no nulos. No se comprobó que existan esas filas en datos reales: se reprodujo el comportamiento con registros simulados.')
p('<b>Perfil inexistente:</b> obtener_perfil genera una HTTPException 404, pero su except Exception la transforma en 500. <b>Foto de perfil:</b> actualizar_perfil lee solo 5 MB y no reutiliza la comprobación de contenido de preparar_imagen.')
p('El requisito de rechazar una foto de perfil inválida o grande es una expectativa recomendada de integridad, coherente con publicaciones; no es una respuesta de perfil que Swagger prometa actualmente. Todos los archivos se simularon, sin escribir imágenes reales.','SmallReport')

# 6.
page(6,'Swagger: lo correcto y las seis brechas')
p('Se auditaron <b>15 operaciones de /api y /auth</b>. El router de conexiones se aisló, por lo que su documentación y permisos no se consideran certificados por este informe. OpenAPI entrega versión 3.1.0; la API principal conserva metadatos genéricos FastAPI / 0.1.0.')
sub('Comprobaciones correctas')
bullet('/docs, /redoc, /openapi.json y /docs/oauth2-redirect responden 200.')
bullet('Publicar, listar y buscar tienen tags y respuesta de éxito tipada; publicar declara 201.')
bullet('Los campos obligatorios, límites de texto/cupos, enums principales y nueve filtros aparecen. Los operationId son únicos.')
table(['Criterio FAIL','Resultado observado / corrección requerida'],[
    ['Enum de mascota','Aparece como string libre. Documentar si/no y las reglas condicionales de mascotas.'],
    ['Seguridad','No hay securitySchemes ni requisitos security. Primero verificar sesión en el backend y después reflejarla en el contrato.'],
    ['Respuestas de éxito','12 de 15 operaciones muestran schema {}. Definir modelos para detalle, cupos, propias, edición/cierre, perfil y auth.'],
    ['Estados de error','Faltan respuestas reales como 401, 404, 413 y 500; registro también usa 400/409. Añadirlas según cada operación.'],
    ['Contenido del formulario','Solo declara multipart/form-data. También acepta URL encoded sin imagen y el README lo utiliza.'],
    ['Forma de error 422','El esquema declara detail como array, pero ciertas reglas devuelven un string. Estandarizarlo o documentar ambas variantes.'],
],[145,WIDTH-145])
sub('Ejemplo de la diferencia en 422')
code('Filtro tipo=oficina -> 422; detail es un array\nPrecio mínimo mayor al máximo -> 422; detail es un string\nMascota inválida -> 422; detail es un string')
p('La auditoría de documentación tiene 20 PASS, 6 FAIL y 2 INFO. Los errores 422 se ejecutaron para comprobar la diferencia; no se dedujo solo por leer decoradores.','SmallReport')

# 7.
page(7,'HTTP real local y guía manual')
p('Se levantó Uvicorn en un puerto temporal de 127.0.0.1. Esta vez hubo conexiones TCP reales para los documentos y estáticos; PostgreSQL permaneció bloqueado y el ciclo de arranque de la aplicación se desactivó de forma explícita. El servidor temporal se detuvo al terminar.')
table(['Comprobación HTTP','Resultado'],[
    ['/docs','200 y marcador SwaggerUIBundle.'],
    ['/redoc','200 y componente redoc.'],
    ['/openapi.json','200 y contenido OpenAPI.'],
    ['/docs/oauth2-redirect','200 y contenido del redirect.'],
    ['/inicio y /crear','Ambas 200; contienen sus formularios reales.'],
    ['/static_principal/HayCupo.js','200 y contenido JavaScript esperado.'],
    ['/static_principal/tailwind.css','200 y contenido CSS esperado.'],
    ['Bundle Swagger, CSS Swagger y bundle ReDoc','Los tres recursos públicos del CDN responden 200 y entregan datos.'],
],[255,WIDTH-255])
p('<b>11 de 11 PASS.</b> Esto demuestra entrega HTTP y disponibilidad de los assets en el momento de la prueba; no certifica renderizado ni interacción en un navegador. No había un navegador conectado para revisar Try it out.')
sub('La guía manual está desactualizada')
bullet('La ruta de autenticación indicada en la guía no coincide con los archivos actuales.')
bullet('Indica cd main; la guía actual del backend requiere ejecutar main.main:app desde la raíz.')
bullet('MODO_PRUEBA_LOCAL y PUBLICACION_AUTOR_ID no son leídas por la dependencia de identidad actual.')
bullet('CP-PUB-06 espera un rechazo 503 al publicar sin autenticación. El código actual publica como usuario 1, por lo que ese control no debe marcarse como superado.')
p('Referencia: taller de integra dos/endpoint/manual-testing-auth-publicaciones.md. Deben alinearse los pasos y resultados con el contrato corregido; una casilla de una guía no demuestra que una prueba se haya ejecutado.','SmallReport')

# 8.
page(8,'Cómo repetirlo y qué corregir primero')
sub('Ejecutar desde la raíz del repositorio')
code('.\\.venv\\Scripts\\python.exe -B -m unittest discover -s tests -v\nnode tests/test_publicaciones_ui.cjs\n.\\.venv\\Scripts\\python.exe -B scripts/verificar_permisos_publicaciones.py\n.\\.venv\\Scripts\\python.exe -B scripts/verificar_contratos_publicaciones.py\n.\\.venv\\Scripts\\python.exe -B scripts/verificar_swagger_publicaciones.py\n.\\.venv\\Scripts\\python.exe -B scripts/verificar_http_swagger.py')
p('Se necesitan las dependencias de main/requirements.txt y Node.js para la suite JavaScript. Los tres primeros verificadores nuevos devuelven código 1 mientras existan FAIL. Es un resultado intencional de los criterios incumplidos, no un error del PDF ni una razón para ocultar los fallos.')
table(['Prioridad','Acción / verificación de cierre'],[
    ['1. Identidad','Sesión verificable, sin respaldo al usuario 1. Anónimo y cookie forjada deben rechazarse; repetir el flujo después de logout.'],
    ['2. Datos y perfil','Política de datos antiguos y contrato coherente; conservar HTTPException 404; validar contenido/tamaño de fotos sin truncarlas.'],
    ['3. Swagger','Modelos de respuesta, estados de error, seguridad, enum/condiciones de mascotas, tipos de formulario y error 422 consistente.'],
    ['4. Documentación y recorrido','Actualizar la guía manual; después ejecutar un recorrido de navegador y persistencia en una base de pruebas autorizada.'],
],[110,WIDTH-110])
sub('Límites de la entrega')
p('No se usó PostgreSQL real ni se escribieron cuentas o publicaciones reales. No se probaron migraciones, arranque completo con la base, carga, despliegue ni interacción visual de Swagger. Las operaciones de conexiones quedaron fuera del alcance. Los JSON registran resultados esperados y obtenidos, y se actualizarán al repetir cada script.')
p('El PDF es una fotografía de esta revisión y no se regenera automáticamente al volver a ejecutar los verificadores. Se conservaron los informes anteriores. Se añadieron scripts QA, evidencias y este informe; no se aplicaron correcciones a la lógica de producto.')
p('<b>Conclusión:</b> la ejecución pedida está terminada y es reproducible. Hay evidencia positiva del funcionamiento normal y evidencia negativa de controles que todavía no cumplen la política de seguridad o robustez. El siguiente paso es corregir esos controles y volver a ejecutar las mismas expectativas.','SmallReport')

doc=SimpleDocTemplate(str(OUT),pagesize=A4,leftMargin=46,rightMargin=46,topMargin=53,bottomMargin=47,
                      title='Pruebas de endpoints, permisos y Swagger',author='Proyecto Roomies',subject='QA ejecutada, permisos, contratos y documentación')
doc.build(story,onFirstPage=furniture,onLaterPages=furniture)
print(OUT)
