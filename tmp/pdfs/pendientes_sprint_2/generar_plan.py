
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Flowable, KeepTogether, Preformatted
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader

ROOT = Path.cwd()
OUT = ROOT / 'output/pdf/pendientes_sprint_2_roomies_plan_equipo.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('Segoe', r'C:\Windows\Fonts\segoeui.ttf'))
pdfmetrics.registerFont(TTFont('SegoeBold', r'C:\Windows\Fonts\segoeuib.ttf'))
pdfmetrics.registerFont(TTFont('Mono', r'C:\Windows\Fonts\consola.ttf'))
NAVY = colors.HexColor('#152B43')
PURPLE = colors.HexColor('#563BDD')
TEXT = colors.HexColor('#25374C')
MUTED = colors.HexColor('#5B6A7C')
LINE = colors.HexColor('#DCE3EC')
PALE = colors.HexColor('#F4F6FA')
LAV = colors.HexColor('#F1EDFF')
GREEN = colors.HexColor('#167451')
AMBER = colors.HexColor('#966000')
RED = colors.HexColor('#A2343C')
W,H = A4
CW = W-84
styles = {
    'Body': ParagraphStyle('Body',fontName='Segoe',fontSize=9.4,leading=13.5,textColor=TEXT,spaceAfter=7),
    'Small': ParagraphStyle('Small',fontName='Segoe',fontSize=8.2,leading=11.6,textColor=MUTED,spaceAfter=5),
    'Tiny': ParagraphStyle('Tiny',fontName='Segoe',fontSize=7.7,leading=10.4,textColor=MUTED,spaceAfter=3),
    'Title': ParagraphStyle('Title',fontName='SegoeBold',fontSize=29,leading=33,textColor=NAVY,spaceAfter=10),
    'H1': ParagraphStyle('H1',fontName='SegoeBold',fontSize=22,leading=27,textColor=NAVY,spaceAfter=12),
    'H2': ParagraphStyle('H2',fontName='SegoeBold',fontSize=11.8,leading=16,textColor=NAVY,spaceBefore=9,spaceAfter=6),
    'Kicker': ParagraphStyle('Kicker',fontName='SegoeBold',fontSize=8,leading=12,textColor=PURPLE,spaceAfter=7),
    'Table': ParagraphStyle('Table',fontName='Segoe',fontSize=8.3,leading=11.5,textColor=TEXT),
    'TH': ParagraphStyle('TH',fontName='SegoeBold',fontSize=8.1,leading=11,textColor=colors.white),
    'Mono': ParagraphStyle('Mono',fontName='Mono',fontSize=8.0,leading=11.1,textColor=TEXT,spaceAfter=5),
}
def clean(s):
    return str(s).replace('\u2011','-').replace('\u2013','-').replace('\u2014','-').replace('\u2212','-')
def P(text,style='Body'):
    return Paragraph(escape(clean(text)).replace('\n','<br/>'), styles[style])
def SP(h=6): return Spacer(1,h)
def heading(number,title):
    return [P(f'PLAN DE TRABAJO  /  {number:02}','Kicker'),P(title,'H1')]
def tbl(rows,widths,header=True):
    cells=[[P(c,'TH' if header and r==0 else 'Table') for c in row] for r,row in enumerate(rows)]
    t=Table(cells,colWidths=widths,repeatRows=1 if header else 0,hAlign='LEFT')
    commands=[('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),
              ('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),6),
              ('BOTTOMPADDING',(0,0),(-1,-1),6),('LINEBELOW',(0,0),(-1,-1),.35,LINE)]
    if header:
        commands += [('BACKGROUND',(0,0),(-1,0),NAVY),
                     ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,PALE])]
    else: commands += [('BACKGROUND',(0,0),(-1,-1),PALE)]
    t.setStyle(TableStyle(commands))
    return t
def callout(title,text,bg=LAV):
    t=Table([[P(title,'H2')],[P(text,'Body')]],colWidths=[CW])
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),bg),('LEFTPADDING',(0,0),(-1,-1),12),
                          ('RIGHTPADDING',(0,0),(-1,-1),12),('TOPPADDING',(0,0),(-1,0),0),
                          ('BOTTOMPADDING',(0,-1),(-1,-1),7)]))
    return t
def bullets(items):
    result=[]
    for x in items:
        result += [Paragraph(escape(clean(x)),styles['Body'],bulletText='-')]
    return result
class Metrics(Flowable):
    def __init__(self,items):
        Flowable.__init__(self); self.items=items; self.width=CW; self.height=77
    def draw(self):
        c=self.canv; gap=10; width=(CW-gap*(len(self.items)-1))/len(self.items)
        for i,(value,label) in enumerate(self.items):
            x=i*(width+gap)
            c.setFillColor(PALE); c.roundRect(x,0,width,self.height,7,fill=1,stroke=0)
            c.setFillColor(PURPLE); c.setFont('SegoeBold',24); c.drawString(x+13,37,value)
            c.setFillColor(MUTED); c.setFont('Segoe',8.8); c.drawString(x+13,16,label)
class Architecture(Flowable):
    def __init__(self):
        Flowable.__init__(self); self.width=CW; self.height=106
    def draw(self):
        c=self.canv
        c.setFillColor(NAVY); c.roundRect(45,62,CW-90,37,5,fill=1,stroke=0)
        c.setFont('SegoeBold',10); c.setFillColor(colors.white)
        c.drawCentredString(CW/2,76,'FastAPI principal: backend.main.main:app')
        c.setStrokeColor(PURPLE); c.setLineWidth(1)
        y=24; gap=10; width=(CW-gap*2)/3
        for i,txt in enumerate(['Auth y perfil','Publicaciones y ubicación','Conexiones y búsqueda']):
            x=i*(width+gap)
            c.line(CW/2,62,CW/2,51); c.line(CW/2,51,x+width/2,51); c.line(x+width/2,51,x+width/2,y+22)
            c.setFillColor(LAV); c.roundRect(x,y,width,22,4,fill=1,stroke=0)
            c.setFillColor(NAVY); c.setFont('Segoe',8.5); c.drawCentredString(x+width/2,y+7,txt)
        c.setFillColor(MUTED); c.setFont('Segoe',8)
        c.drawCentredString(CW/2,4,'Módulos del mismo proceso; acceso a PostgreSQL, esquema haycupo.')
class NumberedCanvas(canvas.Canvas):
    def __init__(self,*a,**k):
        canvas.Canvas.__init__(self,*a,**k); self.states=[]
    def showPage(self):
        self.states.append(dict(self.__dict__)); self._startPage()
    def save(self):
        count=len(self.states)
        for state in self.states:
            self.__dict__.update(state)
            self.setStrokeColor(LINE); self.setLineWidth(.5); self.line(42,43,W-42,43)
            self.setFont('Segoe',7.8); self.setFillColor(MUTED)
            self.drawString(42,29,'ROOMIES  |  Plan de pendientes Sprint 2  |  03 NOV 2026')
            self.drawRightString(W-42,29,f'{self._pageNumber} / {count}')
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)
def header(c,doc):
    c.saveState(); c.setFillColor(PURPLE); c.rect(42,H-33,18,3,fill=1,stroke=0)
    c.setFont('SegoeBold',8); c.setFillColor(NAVY); c.drawString(67,H-34,'ROOMIES / SPRINT 2')
    c.setFont('Segoe',7.5); c.setFillColor(MUTED); c.drawRightString(W-42,H-34,'Pendientes y coordinación del equipo')
    c.restoreState()


TASK_DATA="[{\"id\":\"M4-A01\",\"title\":\"Agregar fecha de nacimiento al registro móvil\",\"priority\":\"P0\",\"hours\":2,\"deps\":\"MOB-05\",\"srs\":\"FR-01, FR-04, FR-05, BR-01, BR-02\",\"status\":\"BASE / validar\",\"observed\":\"Fecha y validaciones presentes; no hace falta reescribir el formulario.\",\"todo\":\"Conservar la implementación y probarla en el dispositivo de entrega; la autorización de edad sigue siendo del servidor.\",\"accept\":\"Fecha válida aceptada; imposible, futura y menor de edad rechazadas visualmente.\",\"evidence\":\"E1: app/registro.tsx; utils/fechaNacimiento.ts.\"},{\"id\":\"M4-A02\",\"title\":\"Preparar cliente Supabase Auth para Expo\",\"priority\":\"P0\",\"hours\":2,\"deps\":\"-\",\"srs\":\"FR-01, FR-02, NFR-01, NFR-03, NFR-12\",\"status\":\"BASE / validar\",\"observed\":\"Cliente Supabase único, variables públicas y AsyncStorage implementados.\",\"todo\":\"Confirmar el proyecto compartido TI2, la clave publicable y la política de correo; probar inicialización Expo.\",\"accept\":\"Cliente inicia sin secretos de servidor ni contraseña de base de datos.\",\"evidence\":\"E1: lib/supabase.ts:17-53; package.json.\"},{\"id\":\"M4-A03\",\"title\":\"Definir contrato local de sesión y usuario actual\",\"priority\":\"P0\",\"hours\":1,\"deps\":\"M4-A02\",\"srs\":\"FR-02, FR-03, NFR-12\",\"status\":\"BASE / coordinar\",\"observed\":\"Tipos separan UUID de Supabase, sesión y perfil Roomies.\",\"todo\":\"Acordar la relación UUID-perfil numérico con TI2 al resolver A08; no reutilizar IDs mock como identidad.\",\"accept\":\"Identidad y perfil permanecen separados al cargar una cuenta real.\",\"evidence\":\"E1: types/Auth.ts:5-17; types/Usuario.ts.\"},{\"id\":\"M4-A04\",\"title\":\"Registrar cuenta mediante Supabase Auth\",\"priority\":\"P0\",\"hours\":2,\"deps\":\"M4-A01, M4-A02\",\"srs\":\"FR-01, FR-04, FR-05, BR-01\",\"status\":\"BASE / validar\",\"observed\":\"signUp envía fecha como metadata y maneja confirmación pendiente.\",\"todo\":\"Verificar que el hook de mayoría de edad esté activo en el proyecto compartido; una migración no lo activa sola.\",\"accept\":\"Adulto obtiene respuesta real; menor falla en servidor; pendiente no anuncia sesión.\",\"evidence\":\"E1: services/authService.ts:146-168; supabase/migrations/.\"},{\"id\":\"M4-A05\",\"title\":\"Reemplazar login y logout simulados\",\"priority\":\"P0\",\"hours\":2,\"deps\":\"M4-A02, M4-A03\",\"srs\":\"FR-02, NFR-01\",\"status\":\"BASE / validar\",\"observed\":\"Login/logout usan SDK real y las rutas privadas están protegidas.\",\"todo\":\"Repetir en dispositivo credenciales inválidas, correo pendiente, caída de red, logout y botón Atrás.\",\"accept\":\"Sesión válida entra; logout vuelve al acceso y no permite regresar a Perfil.\",\"evidence\":\"E1: services/authService.ts:50,69; hooks/useAuth.tsx.\"},{\"id\":\"M4-A06\",\"title\":\"Restaurar sesión al iniciar la app\",\"priority\":\"P0\",\"hours\":1,\"deps\":\"M4-A05\",\"srs\":\"FR-02, NFR-01\",\"status\":\"BASE / validar\",\"observed\":\"Restauración y escucha de sesión presentes; existen resultados documentados.\",\"todo\":\"Corroborar el entorno del grupo y guardar evidencia de reinicio, sesión ausente y error/reintento.\",\"accept\":\"No aparece contenido privado antes de resolver la sesión persistida.\",\"evidence\":\"E1: hooks/useAuth.tsx:45-87; app/_layout.tsx:23-58.\"},{\"id\":\"M4-A07\",\"title\":\"Implementar cliente HTTP autenticado y manejo de errores\",\"priority\":\"P0\",\"hours\":2,\"deps\":\"M4-A05, M4-A06\",\"srs\":\"NFR-01, NFR-02, NFR-11, NFR-12\",\"status\":\"RAMA / integrar\",\"observed\":\"Cliente HTTP con Bearer, timeout y errores en SCRUM-40; vacío en la base móvil.\",\"todo\":\"Revisar e integrar una sola versión, incluida también en A08; coordinar URL y validación JWT TI2.\",\"accept\":\"Llamada protegida real funciona; 401/403/red/JSON inválido son manejables sin registrar tokens.\",\"evidence\":\"E2: 74e41e9, services/httpClient.ts; tests/httpClient.test.mjs.\"},{\"id\":\"M4-A08\",\"title\":\"Consumir consulta del perfil propio\",\"priority\":\"P1\",\"hours\":2,\"deps\":\"M4-A07\",\"srs\":\"FR-03, FR-04, NFR-11\",\"status\":\"PARCIAL / API\",\"observed\":\"SCRUM-41 prepara perfil, pero adaptadorPerfilTi2=null y no envía peticiones.\",\"todo\":\"Integrar el avance, acordar respuesta e identidad y completar el adaptador; probar dos cuentas y errores.\",\"accept\":\"Perfil proviene de API sin inventar presupuesto, reputación ni datos de otra cuenta.\",\"evidence\":\"E3: 837d48b, services/usuariosService.ts:15; docs/perfil-propio.md.\"},{\"id\":\"M4-A09\",\"title\":\"Enviar cambios del perfil mediante PATCH\",\"priority\":\"P1\",\"hours\":1,\"deps\":\"M4-A08\",\"srs\":\"FR-03, NFR-02\",\"status\":\"PENDIENTE / API\",\"observed\":\"No se acreditó PATCH; la edición separada sigue siendo local.\",\"todo\":\"Acordar campos editables y semántica parcial; no traducir un PATCH a PUT completo con valores vacíos.\",\"accept\":\"Guardar y consultar de nuevo confirma persistencia; rechazo nunca muestra éxito.\",\"evidence\":\"E3: components/perfil/FormularioPerfilLocal.tsx; E7: main.py:601-658.\"},{\"id\":\"M4-A10\",\"title\":\"Construir captura móvil de dos antecedentes de identidad\",\"priority\":\"P1\",\"hours\":2,\"deps\":\"M4-A08\",\"srs\":\"FR-07, FR-08, NFR-03, NFR-04\",\"status\":\"DECISIÓN / pendiente\",\"observed\":\"No se encontró captura móvil de los dos antecedentes del PDF.\",\"todo\":\"Acreditar si se aprobó sustituir documentos por correo. Si siguen vigentes, crear permisos, selección, preview y retiro de ambas fotos.\",\"accept\":\"Selección/retiro funcionan; incompleto bloqueado; documentos no se publican en el perfil.\",\"evidence\":\"PDF A10; E3: docs/perfil-propio.md; E7: docs/SCRUM-78.md.\"},{\"id\":\"M4-A11\",\"title\":\"Conectar envío de antecedentes si está publicado el contrato\",\"priority\":\"P1\",\"hours\":1,\"deps\":\"M4-A10, M4-A07\",\"srs\":\"FR-07, FR-08, FR-11, NFR-03\",\"status\":\"BLOQUEADA / alcance\",\"observed\":\"No se encontró servicio móvil ni contrato operativo de verificación documental.\",\"todo\":\"Resolver A10; TI2 debe entregar almacenamiento privado, subida y consulta de estado. Después conectar el envío.\",\"accept\":\"Solicitud real con contrato; si falta, bloqueo explícito y ningún envío exitoso simulado.\",\"evidence\":\"PDF A11; sin verificacionesService.ts en E1/E3.\"},{\"id\":\"M4-B01\",\"title\":\"Convertir Buscar en pantalla con pestañas Arriendos y Personas\",\"priority\":\"P0\",\"hours\":2,\"deps\":\"MOB-02, MOB-06\",\"srs\":\"FR-12, FR-27, NFR-09\",\"status\":\"RAMA / integrar\",\"observed\":\"Buscar sigue placeholder en la base; tabs útiles aparecen en SCRUM-19.\",\"todo\":\"Recuperar los modos Arriendos/Personas del avance existente, preservando la navegación actual.\",\"accept\":\"Alternar muestra el tipo correcto de resultado sin mezclarlos.\",\"evidence\":\"E1: app/(tabs)/buscar.tsx:3-8; E4a: 36cd7cc.\"},{\"id\":\"M4-B02\",\"title\":\"Crear tarjeta de candidato y muestra de perfiles públicos\",\"priority\":\"P0\",\"hours\":2,\"deps\":\"M4-B01\",\"srs\":\"FR-12, FR-13, FR-14, BR-37-BR-39\",\"status\":\"RAMA / integrar\",\"observed\":\"Tarjeta de usuario y mocks están en SCRUM-19, fuera de la base.\",\"todo\":\"Integrar tarjeta y acción de perfil; comprobar candidato con datos y sin valoración.\",\"accept\":\"Tarjetas navegables, sin inventar calificación ni evaluaciones.\",\"evidence\":\"E4a: components/Usuario_Card.tsx:30-81.\"},{\"id\":\"M4-B03\",\"title\":\"Definir navegación hacia perfil público de candidato\",\"priority\":\"P1\",\"hours\":1,\"deps\":\"M4-B02\",\"srs\":\"FR-12, FR-13, NFR-03\",\"status\":\"RAMA / recuperar\",\"observed\":\"SCRUM-20 tiene perfil público por ID; no está en las ramas B05/B06 posteriores revisadas.\",\"todo\":\"Recuperar esta ruta por separado; no asumir que la candidata más nueva la contiene.\",\"accept\":\"Abre el candidato correcto, maneja ID inválido y no permite editarlo.\",\"evidence\":\"E4b: 5413b9d, app/usuario/[id].tsx:97-117.\"},{\"id\":\"M4-B04\",\"title\":\"Reutilizar tarjetas y búsqueda de arriendos entre Inicio y Buscar\",\"priority\":\"P0\",\"hours\":2,\"deps\":\"M4-B01\",\"srs\":\"FR-21, FR-27, NFR-09, NFR-12\",\"status\":\"PARCIAL / integrar\",\"observed\":\"Inicio reutiliza buscador; SCRUM-30 lo comparte también con Buscar.\",\"todo\":\"Integrar el uso compartido y distinguir destacados de Inicio del catálogo de Buscar.\",\"accept\":\"Mismo componente y tipo de publicación; tarjetas consistentes sin duplicarlas.\",\"evidence\":\"E1: app/(tabs)/index.tsx; E4c: 135c8cd.\"},{\"id\":\"M4-B05\",\"title\":\"Implementar filtros visuales de personas\",\"priority\":\"P0\",\"hours\":2,\"deps\":\"M4-B02\",\"srs\":\"FR-13, FR-14, NFR-09\",\"status\":\"PARCIAL / completar\",\"observed\":\"Candidata filtra zona, presupuesto y verificación; faltan edad y ocupación.\",\"todo\":\"Completar edad, ocupación y limpieza de criterios; no aplicar filtros de arriendo a personas.\",\"accept\":\"Seleccionar y limpiar modifica coherentemente los resultados de demostración.\",\"evidence\":\"E4d: 0dc3885, components/FiltrosPersonasModal.tsx:25-50.\"},{\"id\":\"M4-B06\",\"title\":\"Preparar estados vacíos y mensajes de búsqueda\",\"priority\":\"P1\",\"hours\":1,\"deps\":\"M4-B04, M4-B05\",\"srs\":\"NFR-09, NFR-11\",\"status\":\"PARCIAL / completar\",\"observed\":\"EstadoVacio compartido existe en candidata; no cubre error ni reintento.\",\"todo\":\"Agregar Error/Reintentar para ambos modos, demostrables también sin API.\",\"accept\":\"Vacío, error y reintento son visibles sin alterar las tarjetas.\",\"evidence\":\"E4e: 05e7d69, components/EstadoVacio.tsx:5-23.\"},{\"id\":\"M4-B07\",\"title\":\"Crear adaptador tipado de publicaciones para la API común\",\"priority\":\"P0\",\"hours\":2,\"deps\":\"M4-A07, M4-B04\",\"srs\":\"FR-21, FR-27-FR-30, NFR-11, NFR-12\",\"status\":\"PENDIENTE / contrato\",\"observed\":\"SCRUM-43 apunta al mismo commit de B06; no hay DTO ni servicio GET acreditados.\",\"todo\":\"Crear un único DTO/adaptador y servicio con Abdiel; resolver campos idUsuario/tipo y nulabilidad sin inventar datos.\",\"accept\":\"Ejemplo OpenAPI real se transforma al modelo de UI correctamente.\",\"evidence\":\"E4e: SCRUM-43=05e7d69; E7: PublicacionResumen.\"},{\"id\":\"M4-B08\",\"title\":\"Cargar listado real de publicaciones desde Buscar\",\"priority\":\"P0\",\"hours\":2,\"deps\":\"M4-B07\",\"srs\":\"FR-27, FR-29, NFR-11\",\"status\":\"PENDIENTE / conectar\",\"observed\":\"Los buscadores revisados siguen usando publicacionesMock.\",\"todo\":\"Conectar el servicio de B07 con carga, error y reintento; mocks solo como demo identificada.\",\"accept\":\"La lista consume API real y un fallo de red no produce éxito aparente.\",\"evidence\":\"E1/E4e: components/BuscadorPublicaciones.tsx.\"},{\"id\":\"M4-B09\",\"title\":\"Enviar filtros de arriendos como query parameters\",\"priority\":\"P1\",\"hours\":1,\"deps\":\"M4-B08\",\"srs\":\"FR-28, NFR-11\",\"status\":\"PENDIENTE / contrato\",\"observed\":\"El móvil filtra arrays locales; backend no tiene cupos_min genérico.\",\"todo\":\"Acordar zona, precio y cupos mínimos/disponibles; enviar query antes de paginar y quitar filtrado local engañoso.\",\"accept\":\"Cambiar filtro modifica la petición y el servidor devuelve el resultado global.\",\"evidence\":\"E7: main.py:237-296; E1: types/Publicacion.ts:22-26.\"},{\"id\":\"M4-B10\",\"title\":\"Consumir detalle de publicación por ID\",\"priority\":\"P0\",\"hours\":2,\"deps\":\"M4-B07, M4-B08\",\"srs\":\"FR-19-FR-21, FR-29, FR-30\",\"status\":\"BLOQUEADA / detalle\",\"observed\":\"Pantalla por ID usa mock; endpoint actual de detalle solo admite propietario.\",\"todo\":\"TI2 debe acordar lectura segura de publicaciones ajenas, separada del editor; después conectar la pantalla.\",\"accept\":\"Desde una tarjeta abre su ID real; carga/404 correctos, sin sustituir por otro mock.\",\"evidence\":\"E1: app/publicacion/[id]/index.tsx:42-59; E7: main.py:341-354.\"},{\"id\":\"M4-B11\",\"title\":\"Conectar búsqueda de personas si Match está disponible\",\"priority\":\"P1\",\"hours\":1,\"deps\":\"M4-B02, M4-B05, M4-A07\",\"srs\":\"FR-12-FR-14, NFR-11\",\"status\":\"CONDICIONAL / API\",\"observed\":\"No se encontró servicio HTTP de búsqueda de personas; hay mocks.\",\"todo\":\"Acordar ruta Match, campos públicos y filtros, incluida edad; crear adaptador cuando exista contrato verificable.\",\"accept\":\"Con API muestra perfiles reales; sin ella se declara bloqueo y demo.\",\"evidence\":\"E7: match routes.py:71-87; E4d: components/BuscadorPersonas.tsx.\"},{\"id\":\"M4-C01\",\"title\":\"Crear selector móvil de origen de publicación\",\"priority\":\"P0\",\"hours\":2,\"deps\":\"MOB-02\",\"srs\":\"FR-19, FR-20, BR-03, BR-04\",\"status\":\"RAMA / integrar\",\"observed\":\"Publicar es placeholder en base; candidata SCRUM-48 tiene selector de origen.\",\"todo\":\"Integrar pantalla y TipoPublicacionCard, resolviendo la navegación actual.\",\"accept\":\"Cada origen abre su formulario y conserva el tipo elegido.\",\"evidence\":\"E1: app/(tabs)/publicar.tsx:1-13; E5: de0b0be.\"},{\"id\":\"M4-C02\",\"title\":\"Construir formulario de publicación compartida\",\"priority\":\"P0\",\"hours\":2,\"deps\":\"M4-C01\",\"srs\":\"FR-20, FR-23, BR-03, BR-04\",\"status\":\"RAMA / integrar\",\"observed\":\"Formulario Compartida usa hook y componente común en candidata.\",\"todo\":\"Recuperar el avance y contrastar campos finales con TI2; probar ida y vuelta.\",\"accept\":\"Valores y origen Compartida se conservan al navegar hacia atrás.\",\"evidence\":\"E5: app/publicacion/crear/compartida.tsx:9-49; components/publicaciones/FormularioPublicacion.tsx.\"},{\"id\":\"M4-C03\",\"title\":\"Crear variante del formulario para arrendador\",\"priority\":\"P0\",\"hours\":1,\"deps\":\"M4-C02\",\"srs\":\"FR-19, FR-21, BR-04\",\"status\":\"RAMA / integrar\",\"observed\":\"Variante Arrendador reutiliza formulario y textos por origen.\",\"todo\":\"Integrar la reutilización; revisar diferencias permitidas sin clonar formularios.\",\"accept\":\"Ambos orígenes comparten componentes y muestran textos correctos.\",\"evidence\":\"E5: app/publicacion/crear/arrendador.tsx:9-52; constants/origenPublicacion.ts.\"},{\"id\":\"M4-C04\",\"title\":\"Separar validación y estado del formulario de publicación\",\"priority\":\"P0\",\"hours\":2,\"deps\":\"M4-C02, M4-C03\",\"srs\":\"FR-19, FR-20, FR-23, NFR-09\",\"status\":\"RAMA / validar\",\"observed\":\"Hook de formulario contiene valores, errores y validaciones.\",\"todo\":\"Integrar y contrastar formatos con el contrato; no calcular cupos activos en el cliente.\",\"accept\":\"Entradas inválidas bloquean Continuar; corregir limpia error sin perder el origen.\",\"evidence\":\"E5: hooks/useFormularioPublicacion.ts:15-78.\"},{\"id\":\"M4-C05\",\"title\":\"Implementar vista previa antes de publicar\",\"priority\":\"P0\",\"hours\":2,\"deps\":\"M4-C04\",\"srs\":\"FR-19-FR-21, NFR-09\",\"status\":\"RAMA / validar\",\"observed\":\"Previa interpreta borrador y permite volver a editar.\",\"todo\":\"Integrar y comprobar conservación de valores y caso sin borrador en dispositivo.\",\"accept\":\"Preview reproduce lo ingresado; Volver no reinicia el formulario.\",\"evidence\":\"E5: app/publicacion/crear/previa.tsx:42-78,98-115,131-135.\"},{\"id\":\"M4-C06\",\"title\":\"Ajustar CTA del detalle según el origen\",\"priority\":\"P1\",\"hours\":1,\"deps\":\"M4-C05\",\"srs\":\"FR-19-FR-21, FR-31, BR-21, BR-22\",\"status\":\"RAMA / validar\",\"observed\":\"CTA visual diferencia Postular/Contactar; cerrado deshabilita la acción.\",\"todo\":\"Integrar la parte visual y mantener pendientes las acciones reales hasta disponer de API.\",\"accept\":\"Arrendador muestra Postular, Compartida Contactar; no se abre chat por una conexión simple.\",\"evidence\":\"E5: constants/origenPublicacion.ts:68-81; app/publicacion/[id]/index.tsx:62-69.\"},{\"id\":\"M4-C07\",\"title\":\"Definir payload y adaptador de creación de publicaciones\",\"priority\":\"P0\",\"hours\":2,\"deps\":\"M4-C04, M4-A07\",\"srs\":\"FR-19, FR-20, NFR-11, NFR-12\",\"status\":\"PENDIENTE / contrato\",\"observed\":\"SCRUM-46 coincide con C06: no acredita DTO ni servicio de creación.\",\"todo\":\"Definir payload por origen con Javier; resolver categoria, tipo_vivienda, fotos múltiples y enlace antes de llamar API.\",\"accept\":\"Dos ejemplos coinciden con OpenAPI; un único servicio usa A07 y origen explícito.\",\"evidence\":\"E5: SCRUM-46=8303708; E7: main.py:405-421.\"},{\"id\":\"M4-C08\",\"title\":\"Conectar confirmación de nueva publicación\",\"priority\":\"P0\",\"hours\":2,\"deps\":\"M4-C05, M4-C07\",\"srs\":\"FR-19, FR-20, NFR-01, NFR-11\",\"status\":\"PENDIENTE / conectar\",\"observed\":\"Publicar ahora sigue deshabilitado y sin envío en la candidata.\",\"todo\":\"Conectar después de C07/Auth; bloquear doble toque y manejar 401/422/red manteniendo el borrador si falla.\",\"accept\":\"Una pulsación crea una vez; éxito abre el ID devuelto; error no anuncia creación.\",\"evidence\":\"E5: app/publicacion/crear/previa.tsx:122-129.\"},{\"id\":\"M4-C09\",\"title\":\"Preparar vista de estado de postulación con mocks tipados\",\"priority\":\"P1\",\"hours\":1,\"deps\":\"M4-C06\",\"srs\":\"FR-31-FR-36, NFR-09\",\"status\":\"RAMA / validar\",\"observed\":\"Hay pantalla y mocks de los cuatro estados con etiqueta de demostración.\",\"todo\":\"Integrar y probar cuatro estados y caso vacío; el postulante no debe poder aceptarse.\",\"accept\":\"Pendiente, Preseleccionada, Aceptada y Rechazada vienen de datos, sin controles para forzarlos.\",\"evidence\":\"E5: types/Postulacion.ts; app/postulaciones/index.tsx.\"},{\"id\":\"M4-C10\",\"title\":\"Implementar acción de postular desde el detalle\",\"priority\":\"P0\",\"hours\":2,\"deps\":\"M4-C06, M4-A07\",\"srs\":\"FR-31, FR-32, BR-09\",\"status\":\"BLOQUEADA / API\",\"observed\":\"El detalle solo muestra un aviso pendiente; no hay servicio de postulaciones.\",\"todo\":\"TI2 debe entregar POST por publicación; conectar con identidad autorizada y control de repetición solo para Arrendador.\",\"accept\":\"Usuario autenticado postula y ve resultado; Compartida no ofrece esa operación.\",\"evidence\":\"E5: app/publicacion/[id]/index.tsx:68-69; E8: ramas SCRUM-62/68.\"},{\"id\":\"M4-C11\",\"title\":\"Mostrar estado de postulaciones desde la API\",\"priority\":\"P1\",\"hours\":1,\"deps\":\"M4-C09, M4-C10\",\"srs\":\"FR-32, FR-36, NFR-11\",\"status\":\"BLOQUEADA / API\",\"observed\":\"La pantalla lee mocks; no se acreditó GET de postulaciones propias.\",\"todo\":\"Entregar el contrato, mapear estados y añadir carga, vacío, error y reconsulta.\",\"accept\":\"Estado proviene de API; no hay aceptación forzada; sin datos se informa vacío.\",\"evidence\":\"E5: postulaciones/index.tsx:14-17,42-86; E8.\"},{\"id\":\"M4-D01\",\"title\":\"Crear selector visual Chats / Arriendo\",\"priority\":\"P0\",\"hours\":2,\"deps\":\"MOB-09, MOB-10\",\"srs\":\"FR-37-FR-42, FR-59-FR-63, NFR-09\",\"status\":\"RAMA / integrar\",\"observed\":\"Base abre chat de convivencia directo; candidata tiene selector Chats/Arriendo.\",\"todo\":\"Integrar selector y rutas, identificando datos demo y acciones no disponibles.\",\"accept\":\"Desde Mensajes se elige ambos destinos sin enlaces rotos ni promesas de API.\",\"evidence\":\"E1: app/(tabs)/mensajes.tsx; E6a/E6e: selector.\"},{\"id\":\"M4-D02\",\"title\":\"Extraer componentes existentes de chat de convivencia\",\"priority\":\"P0\",\"hours\":2,\"deps\":\"M4-D01\",\"srs\":\"FR-59-FR-63, NFR-12\",\"status\":\"RAMA / integrar\",\"observed\":\"Base conserva subcomponentes inline; candidata ya extrajo lista, burbuja y compositor.\",\"todo\":\"Recuperar los componentes existentes y el chat grupal; evitar un segundo chat duplicado.\",\"accept\":\"La demo conserva apariencia y envío local usando componentes extraídos.\",\"evidence\":\"E6b/E6e: components/chat/; app/arriendo/chat.tsx.\"},{\"id\":\"M4-D03\",\"title\":\"Verificar arranque y corregir exports vacíos\",\"priority\":\"P0\",\"hours\":1,\"deps\":\"-\",\"srs\":\"NFR-12, NFR-15\",\"status\":\"BASE parcial / validar\",\"observed\":\"Los tres exports que el PDF veía vacíos ya tienen contenido en la base.\",\"todo\":\"No rehacerlos a ciegas: ejecutar TypeScript y Expo en la base integrada; resolver solo fallos reproducibles.\",\"accept\":\"Imports resuelven y app inicia; cualquier bloqueo queda documentado con reproducción.\",\"evidence\":\"E1: mocks/index.ts, theme/colors.ts, types/Evaluacion.ts.\"},{\"id\":\"M4-D04\",\"title\":\"Crear vista visual de conversación contextual\",\"priority\":\"P1\",\"hours\":2,\"deps\":\"M4-D03\",\"srs\":\"FR-37-FR-42, NFR-09\",\"status\":\"RAMA / validar\",\"observed\":\"Candidata tiene cabecera contextual y guard de estado preseleccionada.\",\"todo\":\"Integrar y probar estados e ID inválido. Revisar el mock preseleccionado rotulado Compartida y alinearlo con C06/C10; rotular demo no persistente.\",\"accept\":\"Solo preseleccionada muestra conversación; no se confunde con chat del arriendo.\",\"evidence\":\"E6c/E6e: app/chats/[id].tsx; data/chatsMock.ts.\"},{\"id\":\"M4-D05\",\"title\":\"Implementar dashboard visual Mi arriendo\",\"priority\":\"P0\",\"hours\":2,\"deps\":\"M4-D01\",\"srs\":\"FR-43, FR-48-FR-50, FR-71-FR-77, NFR-09\",\"status\":\"RAMA / integrar\",\"observed\":\"Dashboard candidato reutiliza integrantes, tareas y recordatorios centralizados.\",\"todo\":\"Recuperar dashboard, resumen y navegación; conservar un único arriendo simulado coherente.\",\"accept\":\"Datos de demo consistentes y accesos a chat, tareas y recordatorios correctos.\",\"evidence\":\"E6d/E6e: app/arriendo/index.tsx; data/convivenciaMock.ts.\"},{\"id\":\"M4-D06\",\"title\":\"Manejar el caso de usuario sin arriendo activo\",\"priority\":\"P1\",\"hours\":1,\"deps\":\"M4-D05\",\"srs\":\"FR-18, FR-43, BR-11, BR-21\",\"status\":\"RAMA / validar\",\"observed\":\"Candidata incluye Sin arriendo con retorno a Buscar y sin renderizar el dashboard.\",\"todo\":\"Integrar y probar el flag simulado en ambos valores; no atribuir residencia real a todos.\",\"accept\":\"Sin arriendo oculta el chat de convivencia y ofrece regresar a Buscar.\",\"evidence\":\"E6e: app/arriendo/index.tsx; USUARIO_TIENE_ARRIENDO_MOCK.\"},{\"id\":\"M4-D07\",\"title\":\"Crear formulario visual Nueva tarea de convivencia\",\"priority\":\"P1\",\"hours\":2,\"deps\":\"M4-D05\",\"srs\":\"FR-71-FR-74, NFR-09\",\"status\":\"POR DESARROLLAR\",\"observed\":\"No se encontró formulario equivalente en base ni candidata revisada.\",\"todo\":\"Crear bottom sheet local con nombre, descripción, responsable y fecha; reutilizar integrantes del dashboard.\",\"accept\":\"Crear/cancelar valida y cambia solo la demostración, sin llamadas SQL ni backend.\",\"evidence\":\"E1/E6e: tareas.tsx es listado; no NuevaTareaSheet.\"},{\"id\":\"M4-D08\",\"title\":\"Crear formulario visual Nuevo recordatorio\",\"priority\":\"P1\",\"hours\":2,\"deps\":\"M4-D05\",\"srs\":\"FR-75-FR-77, NFR-09\",\"status\":\"POR DESARROLLAR\",\"observed\":\"La candidata muestra recordatorios; el botón Agregar está deshabilitado.\",\"todo\":\"Crear formulario local de título, fecha, hora y descripción opcional.\",\"accept\":\"Crear/cancelar funciona y el resultado aparece coherente en la demo.\",\"evidence\":\"E6e: ProximosRecordatorios.tsx; no NuevoRecordatorioSheet.\"},{\"id\":\"M4-D09\",\"title\":\"Centralizar estado demostrativo de tareas y recordatorios\",\"priority\":\"P1\",\"hours\":1,\"deps\":\"M4-D07, M4-D08\",\"srs\":\"FR-71-FR-77, NFR-12\",\"status\":\"POR DESARROLLAR\",\"observed\":\"Hay arrays mock compartidos, pero no estado reactivo común para formularios.\",\"todo\":\"Agregar un hook simple que comparta tareas/recordatorios y un único origen de integrantes.\",\"accept\":\"Agregar desde un formulario actualiza la sección hasta reiniciar; no anuncia persistencia.\",\"evidence\":\"E6e: data/convivenciaMock.ts; sin useConvivenciaDemo.\"},{\"id\":\"M4-D10\",\"title\":\"Verificar navegación y estados de chat/arriendo en dispositivo\",\"priority\":\"P1\",\"hours\":2,\"deps\":\"M4-D04, M4-D09\",\"srs\":\"NFR-09, NFR-10, NFR-12\",\"status\":\"POR VALIDAR\",\"observed\":\"No se acreditaron pruebas de navegación/teclado/scroll en dispositivo para estas pantallas.\",\"todo\":\"Después de integrar y completar D09, recorrer selector, chat, arriendo, tareas y recordatorios.\",\"accept\":\"No hay rutas rotas y el teclado no tapa el compositor; conservar evidencia reproducible.\",\"evidence\":\"PDF D10; E1/E6e sin prueba ejecutada en esta revisión.\"},{\"id\":\"M4-D11\",\"title\":\"Documentar contrato móvil pendiente para Convivencia Sprint 3\",\"priority\":\"P1\",\"hours\":1,\"deps\":\"M4-D05, M4-D09\",\"srs\":\"FR-37-FR-42, FR-43-FR-63, FR-71-FR-77, NFR-11\",\"status\":\"POR DOCUMENTAR\",\"observed\":\"No se encontró el contrato pendiente de Convivencia entre las fuentes revisadas.\",\"todo\":\"Preparar tabla de recursos, campos, permisos y ejemplos mock para TI2; no inventar rutas definitivas.\",\"accept\":\"TI2 recibe necesidades de arriendo/integrantes/chat/tareas/recordatorios, sin declarar integración.\",\"evidence\":\"PDF D11; E1/E6e sin docs/contratos-pendientes-convivencia.md.\"}]"

import json
TASKS=json.loads(TASK_DATA)
styles['Task']=ParagraphStyle('Task',fontName='Segoe',fontSize=8.0,leading=10.7,textColor=TEXT)
styles['TaskSmall']=ParagraphStyle('TaskSmall',fontName='Segoe',fontSize=7.1,leading=9.5,textColor=MUTED)
def R(s,style='Task'):
    return Paragraph(s,styles[style])
def esc(s): return escape(clean(s))
def task_table(entries):
    rows=[[P('Tarea del PDF','TH'),P('Estado observado / evidencia','TH'),P('Trabajo pendiente y criterio de cierre','TH')]]
    for t in entries:
        left=R(f"<b>{esc(t['id'])}</b><br/>{esc(t['title'])}<br/><font size='7.2' color='#5B6A7C'>{esc(t['priority'])} | {t['hours']} h originales<br/>Dep.: {esc(t['deps'])}</font>")
        color='#167451' if t['status'].startswith('BASE') else '#563BDD' if t['status'].startswith('RAMA') else '#A2343C' if 'BLOQUEADA' in t['status'] else '#966000'
        observed=R(f"<font color='{color}'><b>{esc(t['status'])}</b></font><br/>{esc(t['observed'])}<br/><font size='7.1' color='#5B6A7C'>{esc(t['evidence'])}</font>")
        action=R(f"<b>Pendiente:</b> {esc(t['todo'])}<br/><b>Cierre:</b> {esc(t['accept'])}<br/><font size='7.1' color='#5B6A7C'>SRS: {esc(t['srs'])}</font>")
        rows.append([left,observed,action])
    table=Table(rows,colWidths=[116,151,CW-267],repeatRows=1,hAlign='LEFT')
    table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),NAVY),('VALIGN',(0,0),(-1,-1),'TOP'),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,PALE]),
        ('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),
        ('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),
        ('LINEBELOW',(0,0),(-1,-1),.35,LINE)]))
    print('TASK_TABLE',entries[0]['id'],entries[-1]['id'],'HEIGHT',round(table.wrap(CW,10000)[1],1))
    return table

story=[]
# 1
story += [P('GUÍA PARA EL GRUPO  /  3 DE NOVIEMBRE DE 2026','Kicker'),
    P('Qué falta del\nSprint 2','Title'),
    P('Brechas, dependencias y plan de trabajo de Roomies','H2'),
    P('Este documento responde qué falta cerrar del backlog TI4 para trabajar en grupo. No es un inventario del backend ni una lista de funciones para rehacer. Distingue avances integrados, trabajo en ramas separadas, desarrollo pendiente y bloqueos con TI2.'),
    SP(7),Metrics([('44','tareas del PDF contrastadas'),('4','frentes de trabajo'),('8','brechas de coordinación')]),SP(13),
    P('Lo primero que el equipo necesita resolver','H2')]
story+=bullets([
    'Preservar Auth móvil ya integrado e incorporar los avances separados sin devolver la app a credenciales mock.',
    'Acordar con TI2 identidad/JWT, perfil, publicaciones y postulaciones antes de conectar operaciones protegidas.',
    'Completar DTOs y servicios únicos; la presencia de una rama con el nombre de una tarea no demuestra que esté implementada.',
    'Desarrollar formularios y estado local de convivencia que todavía no aparecen, sin crear su backend en este Sprint.',
    'Reunir pruebas de dispositivo y request/response real; una pantalla mock o 125 tests Python aislados no cierran la integración móvil.',
])
story += [callout('Qué se revisó y qué no',
    'Fuente: el PDF Sprint 2 enviado, el backend en 97c91c0 y referencias Git locales de la app móvil. Base móvil observada: origin/dev-movil de03044. No se hizo fetch, no se consultó el estado actual de GitHub ni se ejecutaron Expo, Supabase o PostgreSQL. Confirmar avances posteriores con cada integrante.'),SP(9),
    P('Cómo interpretar el estado','H2'),
    tbl([['Etiqueta','Significado para el equipo'],
      ['BASE','Hay código en la base móvil examinada. Conservar y validar; no rehacer por defecto.'],
      ['RAMA / PARCIAL','Existe un avance separado o incompleto. Revisar, integrar y completar.'],
      ['PENDIENTE / POR DESARROLLAR','No se acreditó la entrega en las fuentes consultadas. Confirmar con su responsable antes de empezar de cero.'],
      ['BLOQUEADA / DECISIÓN','La integración depende de contrato, entorno o una decisión de alcance aún no acreditada.']],
      [138,CW-138]),SP(6),
    P('Las horas y prioridades por tarea son las originales del PDF: 72 h técnicas + 8 h de reserva = 80 h. No equivalen al esfuerzo que todavía falta ni a una nueva estimación. No se modificó código al preparar este plan.','Small'),PageBreak()]
# 2
story += heading(2,'Brechas que deben coordinar TI4 y TI2')
story += [P('Son decisiones y entregables concretos que desbloquean tareas del backlog. No implican reescribir todo el backend ni asignar automáticamente tareas de TI2 a los cuatro integrantes de TI4.')]
story += [tbl([['Brecha / tareas afectadas','Qué falta acordar o entregar'],
    ['G1. Identidad y JWT\nA07-A09; C08/C10/C11','El móvil usa Supabase con UUID. El backend actual valida JWT propio, ID numérico y sesión local. Entregar validación compatible y relación identidad-perfil, o acreditar un cambio formal del contrato. Probar un token real del proyecto compartido. No enviar contraseñas al backend para inventar un segundo login móvil.'],
    ['G2. Perfil propio\nA08-A09','Definir ruta, JSON, nulabilidad, campos editables y perfil ausente. El plan propone GET/PATCH /usuarios/me; existe GET/PUT /api/perfil con formulario y reemplazo completo. Un alias no resuelve esas diferencias; no vaciar campos al traducir una edición parcial.'],
    ['G3. Lectura de publicaciones\nB07/B08/B10','Entregar DTO de lista y detalle de descubrimiento seguro para publicaciones ajenas, manteniendo protegido el editor. Resolver tipo/origen e idUsuario requeridos por el modelo móvil pero ausentes del catálogo; no inventar IDs ni datos públicos.'],
    ['G4. Filtros y cupos\nB09/B11','Acordar cupos mínimos frente a personas exactas, capacidad publicada frente a ocupación real y búsqueda global antes de paginar. En Match faltan edad y contrato público acordado. Documentar nombre y semántica de cada parámetro.'],
    ['G5. Creación y archivos\nC07-C08','El móvil no entrega aún todos los campos exigidos por la API: categoria y tipo_vivienda. Admite 3/5 fotos por origen, frente a una imagen por petición del backend, y enlaceReferencia sin persistencia actual. Resolver campos, formato, límites y respuesta con ejemplos OpenAPI.'],
    ['G6. Postulaciones\nC10-C11; coordinación con D04','Entregar POST por publicación y GET propias con identidad del token y estados acordados. Postular solo a Arrendador; Compartida usa contacto/conexión. Las ramas llamadas SCRUM-62/68 revisadas contienen Match, no acreditan esos endpoints.'],
    ['G7. Verificación de identidad\nA10-A11','El PDF pide dos antecedentes, pero otra documentación afirma sustitución por correo. Obtener decisión formal y actualizar backlog/SRS. Si se mantiene, definir Storage privado, subida y consulta de estado. No publicar documentos en Perfil.'],
    ['G8. Entorno y contrato verificable\nTodos los consumos API','Entregar URL accesible, OpenAPI, ejemplos de éxito/error, mecanismo de autorización y datos de prueba. PostgreSQL local fue bloqueado por Device Guard; usar un entorno autorizado/CI, sin desactivar políticas del equipo.']],
    [146,CW-146]),SP(8),
    P('Regla del PDF: sin endpoint operativo + ejemplo OpenAPI + autorización + respuesta verificable, el consumo queda bloqueado. Se puede seguir con UI, tipos y demo etiquetada; no simular éxito de red. [PDF, sección 11]','Small'),PageBreak()]
# 3
story += heading(3,'Orden de trabajo y avances que recuperar')
story += [P('Propuesta de ejecución para acordar en la reunión del grupo. Los nombres de responsables de las fichas mantienen la distribución del PDF; este orden no modifica por sí solo su tablero.')]
story += [tbl([['Lote','Trabajo coordinado','Salida comprobable'],
    ['0. Preparar base','Matías y grupo: TypeScript/Expo (D03). Gustavo: preservar A01-A06. Todos: revisar diferencias antes de integrar.','Una base arranca y mantiene sesión real, con bloqueos reproducibles anotados.'],
    ['1. Recuperar avances','Javier: B01-B06 y ruta B03 separada. Abdiel: C01-C06/C09. Matías: D01-D06. Gustavo: A07 y preparación A08.','Pantallas existentes integradas y navegables, sin duplicar ni perder Auth.'],
    ['2. Cerrar contratos','Responsables TI2 + Gustavo/Javier/Abdiel: G1-G6 y entorno G8. Resolver G7 con equipo/profesor.','Ejemplos OpenAPI y pruebas de identidad, datos, errores y permisos.'],
    ['3. Completar en paralelo','Matías: D07-D09 y D11. Javier: B05/B06 y DTO/listado/filtros. Abdiel: C07/C08. Gustavo: A08/A09.','Flujos independientes y contratos disponibles avanzan sin esperar servicios diferidos.'],
    ['4. Integrar y demostrar','Con Postulaciones listo: C10/C11. Match disponible: B11. Verificación solo si se mantiene alcance. Todos: matriz de cierre.','Evidencia por tarea en dispositivo y, donde aplica, request/response real.']],
    [94,230,CW-324]),SP(9),
    P('Ramas con trabajo útil: revisar antes de desarrollar de nuevo','H2'),
    tbl([['Área','Avance observado','Precaución'],
      ['Auth','A01-A06 en de03044. A07 en 74e41e9; A08 en 837d48b.','A08 ya incluye A07. Su adaptador de perfil sigue null; no confundir preparación con consumo real.'],
      ['Búsqueda','Tabs/tarjetas, perfil candidato, reutilización, filtros y vacío en ramas SCRUM-19/20/30/31/32.','SCRUM-43 coincide con B06, no acredita B07. B03 no está en las candidatas posteriores revisadas.'],
      ['Publicación','C01-C06 y C09 acumulados en candidata SCRUM-48, de0b0be.','SCRUM-46 coincide con C06. Publicar sigue deshabilitado y las postulaciones son mock.'],
      ['Convivencia','D01-D06 acumulados en candidata SCRUM-38, 66c692c.','D07-D09 no aparecen. Hay datos locales y navegación para recuperar.']],
      [78,224,CW-302]),SP(7),
    callout('No hacer merges ciegos',
      'Las candidatas de búsqueda, publicación y convivencia provienen de historias anteriores a Auth real: sus diferencias pueden eliminar módulos Supabase y recuperar credencialesMock. Revisar/reconciliar los cambios de dominio preservando Auth; probar después. No se integró ninguna rama durante esta revisión.',
      colors.HexColor('#FFF6E8')),
    PageBreak()]
# 4-11
groups=[
 ('A','Gustavo Martínez','Autenticación, perfil y verificación',
  'A01-A06 ya tienen implementación en la base revisada. El trabajo faltante se concentra en validar el entorno compartido, integrar HTTP/perfil y resolver sus contratos y alcance.'),
 ('B','Javier Poblete','Búsqueda de personas y arriendos',
  'Hay avances visuales en ramas separadas; la base examinada todavía tiene Buscar provisional. Recuperar componentes y completar filtros/estados antes del consumo real.'),
 ('C','Abdiel Molina','Publicación y postulaciones',
  'La candidata tiene formulario, previa y estados demo. Faltan el adaptador real, publicar y las operaciones de postulación; no rehacer las pantallas ya desarrolladas.'),
 ('D','Matías Araya','Chat y convivencia visual',
  'Sprint 2 exige interfaz simulada coherente y navegación. No exige implementar mensajería ni arriendos persistentes. Recuperar D01-D06 y completar los formularios/estado local.')]
page_no=4
for code,owner,area,intro in groups:
    entries=[t for t in TASKS if t['id'].startswith('M4-'+code)]
    for part,chunk in enumerate([entries[:6],entries[6:]],1):
        story+=heading(page_no,f'{owner}: pendientes ({part}/2)')
        story += [P(area,'H2'),P(intro,'Small'),task_table(chunk),SP(7),
            P('Fuente: tarea, prioridad, estimación, dependencias y SRS del PDF original. Estados contrastados por código; el cierre debe acreditarse en el entorno del grupo. E1-E8 se identifican en las fuentes del plan.','Tiny'),
            PageBreak()]
        page_no+=1
# 12
story += heading(12,'Qué evidencia falta para cerrar el Sprint')
story += [P('La revisión fue estática. No certifica que una tarea esté terminada en dispositivo. Las pruebas backend ya reportadas no sustituyen la demostración móvil pedida por el PDF, sección 12.')]
story += [tbl([['Flujo / responsables','Prueba mínima a reunir'],
    ['Base y navegación\nTodos; D03/D10','TypeScript y Expo en la base integrada; imports correctos; rutas válidas; regreso y sesión inicial; teclado/scroll en chat y formularios. Guardar comando, entorno y resultado.'],
    ['Auth\nGustavo + TI2 Auth','Adulto/menor y rechazo del servidor; correo pendiente/confirmado; login inválido/válido; red; logout + Atrás; reinicio con/sin sesión. Mismo proyecto Supabase de integración.'],
    ['Perfil\nGustavo + TI2 Users','Dos cuentas aisladas; perfil real y perfil ausente; loading/error/reintento; guardar/reconsultar; rechazo visible; campos protegidos no mutables; sin reputación inventada.'],
    ['Buscar\nJavier + TI2 Listado/Match','Arriendos/Personas, seleccionar y limpiar filtros, cero resultados, fallo de red, reintento, query global antes de paginar, ID real y 404. Caso sin calificación.'],
    ['Publicar\nAbdiel + TI2 Listado','Ambos orígenes, obligatorios/formato, previa y vuelta sin perder datos, archivos según contrato, una creación ante doble toque, 201/200 e ID real, 401/422/red conservando borrador.'],
    ['Postular\nAbdiel + TI2 Applications','Solo Arrendador, token autorizado, bloqueo durante envío, resultado real, cuatro estados desde API, vacío/error y ausencia de controles para autoaceptarse.'],
    ['Convivencia demo\nMatías','Preseleccionada vs pendiente, origen coherente, Sin arriendo, agregar/cancelar tarea y recordatorio, actualización común hasta reinicio y aviso de no persistencia.'],
    ['Antecedentes\nGustavo + responsable TI2','Solo si se mantiene A10/A11: permisos, dos imágenes, retiro, incompleto, carga privada y consulta de estado; sin contrato, bloqueo explícito y nunca falso éxito.']],
    [144,CW-144]),SP(9),
    P('Paquete de evidencia por tarea','H2')]
story += bullets([
    'ID M4 + FR/NFR/BR del PDF; responsable; commit/PR; archivos y contrato/versión usados.',
    'Captura o video del caso observable, pasos reproducibles y resultado esperado/obtenido.',
    'En integración: método/ruta, request/response anonimizado y ejemplos de error, sin tokens ni datos privados.',
    'Si está bloqueada: dependencia, responsable de desbloqueo y trabajo independiente que sí quedó listo.',
])
story += [P('Estado de las pruebas conocidas: 125 casos Python aislados aprobados; no se ejecutaron pruebas móviles nuevas para elaborar este plan. PostgreSQL real quedó sin verificar por el bloqueo de Windows.','Small'),PageBreak()]
# 13
story += heading(13,'Reunión del grupo: decisiones y reparto')
story += [P('Usen esta página como agenda. Los responsables de TI2 se acuerdan con ese equipo; no se reasignan automáticamente al autor del backend de publicaciones.')]
story += [tbl([['Decisión que debe salir de la reunión','Quién coordina / entregable'],
    ['¿Cuál será la base de integración móvil y qué avances están ya fusionados después de de03044?','Todos. Actualizar referencias y contrastar cada PR; confirmar estado con el autor antes de reescribir.'],
    ['¿Qué contrato de identidad se acepta para recursos protegidos?','Gustavo + TI2 Auth/Gateway. Proyecto Supabase, validación del token y relación UUID-perfil. Resolver también cualquier riesgo del Auth legado antes de exponerlo.'],
    ['¿Cuál es el JSON de perfil, lista/detalle y creación?','Gustavo/Javier/Abdiel + TI2. Ejemplos públicos/privados, campos nulos, origen, IDs, filtros, fotos y enlace.'],
    ['¿Quién entrega postulaciones y en qué entorno se probarán?','Abdiel + TI2 Applications. Modelo, estados, POST por publicación, GET propias y evidencia de permisos.'],
    ['¿Se mantiene la verificación con dos antecedentes?','Equipo/profesor + Gustavo/TI2. Acta o actualización de Jira/SRS; correo y documento no se consideran equivalentes sin esa decisión.'],
    ['¿Qué hace cada integrante mientras una API no llega?','Javier completa B05/B06; Abdiel integra y valida C01-C06/C09; Matías D07-D09/D11; Gustavo integra A07 y prepara A08 sin simular éxito.']],
    [271,CW-271]),SP(9),
    P('Lo que NO deben añadir para cumplir este Sprint 2','H2'),
    P('El PDF deja para Sprint 3 la integración real de arriendos activos, invitaciones y responsable, mensajería persistente/Realtime, tareas/recordatorios persistentes, calificaciones, reportes e historial. La UI demo y la definición de contratos de convivencia sí pertenecen al Sprint 2.'),
    P('Videollamadas y documentos compartidos son referencias gráficas hasta una decisión respaldada por el SRS. No crear servicios, tablas o endpoints nuevos únicamente porque aparezcan en un mockup.'),
    P('Capacidad original: no confundir con esfuerzo pendiente','H2'),
    tbl([['Responsable del PDF','Técnicas','Reserva','Capacidad'],
      ['Gustavo Martínez','18 h','2 h','20 h'],['Javier Poblete','18 h','2 h','20 h'],
      ['Abdiel Molina','18 h','2 h','20 h'],['Matías Araya','18 h','2 h','20 h'],
      ['Total original','72 h','8 h','80 h']], [CW-210,70,70,70]),
    P('Reestimar lo restante después de revisar e integrar avances. Este informe no reparte horas nuevas, no certifica avances posteriores y no reemplaza el tablero del equipo.','Small'),PageBreak()]
# 14
story += heading(14,'Fuentes y límites de este plan')
story += [P('Corte documental: 3 de noviembre de 2026. Referencias Git almacenadas localmente, sin fetch ni consulta del GitHub actual. La presencia de código y la integración en una base son hechos distintos; ninguna certifica ejecución o despliegue.'),
    P('Rutas abreviadas y referencias utilizadas','H2'),
    P('M/ = taller de integra cuatro/roomies-app-movil/. Las fichas citan archivos bajo M/src/; docs/, tests/ y supabase/ se ubican en M/. Backend se refiere a la rama E7. Los nombres abreviados se localizan dentro de su referencia. Se usó git show, sin checkout ni cambios de rama.','Small'),
    tbl([['Ref.','Fuente exacta o referencia local'],
      ['PDF','tareas_ti4_sprint_2 (1).pdf, 22 páginas. Secciones 3.4 (contratos), 6 (44 tareas), 7-10 (fichas), 11-13 (bloqueos/calidad/Git) y 14 (diferido).'],
      ['E1','origin/dev-movil, de03044. Base móvil: Auth real, Buscar/Publicar provisionales, detalle y convivencia demo.'],
      ['E2-E3','SCRUM-40 / 74e41e9: cliente HTTP y tests. SCRUM-41 / 837d48b: preparación de perfil; usuariosService.ts mantiene adaptador null y docs/perfil-propio.md lo declara pendiente.'],
      ['E4a-E4c','SCRUM-19 / 36cd7cc: tabs y tarjeta. SCRUM-20 / 5413b9d: perfil público candidato. SCRUM-30 / 135c8cd: buscador compartido.'],
      ['E4d-E4e','SCRUM-31 / 0dc3885: filtros de personas. SCRUM-32 y SCRUM-43 / 05e7d69: estado vacío; no acreditan DTO/servicio B07.'],
      ['E5','SCRUM-48 / de0b0be: candidata con C01-C06 y C09. SCRUM-35 y SCRUM-46 comparten 8303708: CTA visual, no acredita C07.'],
      ['E6a-E6e','SCRUM-24 / ad51c7b; SCRUM-25 / 84a8f61; SCRUM-36 / 5d80dfb; SCRUM-37 / 45ec0de; SCRUM-38 / 66c692c. Avances D01-D06.'],
      ['E7','Backend actual de codex/integrar-trabajo-benja, 97c91c0. backend/main/main.py; auth_service/security.py; match_conexion_service; publicaciones_service; docs/SCRUM-78.md.'],
      ['E8','Ramas backend SCRUM-62 y SCRUM-68: ambas 204dc07 en las referencias revisadas. Contienen Match/conexiones; no se acreditaron modelos/endpoints de postulaciones.']],
      [72,CW-72]),SP(8),
    P('Qué significa “falta” en este documento','H2')]
story += bullets([
    'Confirmado en el código revisado: placeholders, adaptador null, cliente vacío, botones sin envío y contratos incompatibles descritos.',
    'No acreditado: no se encontró evidencia suficiente en la base y candidatas consultadas; el responsable puede tener cambios posteriores o privados.',
    'Sin verificar: dispositivo, compilación actual, servicios externos, despliegue, proyecto Supabase compartido, permisos reales y estado remoto posterior.',
])
story += [P('El PDF original define el requisito; las recomendaciones de orden, integración y coordinación de este plan son propuestas para acordar con el grupo. No se ejecutaron acciones pedidas dentro de los documentos ni se implementaron nuevas funcionalidades.','Tiny')]

doc=SimpleDocTemplate(str(OUT),pagesize=A4,rightMargin=42,leftMargin=42,topMargin=58,bottomMargin=57,
    title='Roomies - Qué falta del Sprint 2 - Plan para el equipo',
    author='Plan de coordinación Roomies',
    subject='44 tareas TI4, brechas TI2, avances por integrar, trabajo pendiente y criterios de cierre',
    pageCompression=1)
doc.build(story,onFirstPage=header,onLaterPages=header,canvasmaker=NumberedCanvas)
reader=PdfReader(str(OUT))
text='\n'.join(p.extract_text() or '' for p in reader.pages)
assert all(t['id'] in text for t in TASKS)
print('OUTPUT',OUT)
print('PAGES',len(reader.pages))
for i,page in enumerate(reader.pages,1):
    value=page.extract_text() or ''
    print('PAGE',i,'CHARS',len(value),'START',repr(value[70:170]))

