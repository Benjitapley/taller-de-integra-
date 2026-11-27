import { useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams, type Href } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/hooks/useAuth";
import { useConsulta, useOperacion, usePagina } from "@/hooks/useApi";
import AccesoArriendo from "@/components/convivencia/AccesoArriendo";
import { SolicitarConexion } from "./Personas";
import { consultar, objeto, id, publicacionValida, perfilValido, arriendoValido, integranteValido,
  conversacionValida, mensajeValido, reporteValido, postulacionValida, notificacionValida, nuevaClave,
  subirFoto, errorFoto, personaValida, type PublicacionApi, type MensajeApi, type PerfilApi } from "@/services/roomiesApi";
import type { ErrorHttp } from "@/types/Http";

export const ir = (ruta: string) => router.push(ruta as Href);
export function Boton({ children, onPress, disabled = false, secundario = false }: { children: ReactNode; onPress: () => void; disabled?: boolean; secundario?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={[s.boton, secundario && s.secundario, disabled && s.deshabilitado]}><Text style={[s.botonTexto, secundario && s.purpura]}>{children}</Text></Pressable>;
}
export function Pantalla({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <ScrollView style={s.pantalla} contentContainerStyle={s.contenido} keyboardShouldPersistTaps="handled">
    <Text accessibilityRole="header" style={s.titulo}>{titulo}</Text>{children}</ScrollView>;
}
export function Panel({ children }: { children: ReactNode }) { return <View style={s.panel}>{children}</View>; }
export function Campo({ titulo, value, onChangeText, multiline = false, numeric = false, maxLength = 1000, editable = true }: { titulo: string; value: string; onChangeText: (v: string) => void; multiline?: boolean; numeric?: boolean; maxLength?: number; editable?: boolean }) {
  return <View style={s.campo}><Text style={s.etiqueta}>{titulo}</Text><TextInput accessibilityLabel={titulo} value={value} onChangeText={onChangeText} editable={editable}
    multiline={multiline} keyboardType={numeric ? "numeric" : "default"} maxLength={maxLength} style={[s.input, multiline && s.textarea]} /></View>;
}
export function Aviso({ children }: { children?: ReactNode }) { return children ? <Text accessibilityRole="alert" style={s.error}>{children}</Text> : null; }
export function Foto({ uri }: { uri: unknown }) {
  let source: string | undefined;
  try { const url = new URL(String(uri), process.env.EXPO_PUBLIC_API_URL); if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password && uri) source = url.href; } catch { /* Foto no disponible. */ }
  return source ? <Image source={{ uri: source }} style={s.foto} accessibilityLabel="Fotografía de la publicación" /> : null;
}
export function Pie({ estado }: { estado: { cargando: boolean; iniciada: boolean; cursor: string | null; error: ErrorHttp | null; cargar: () => Promise<void> } }) {
  return <View style={s.campo}>{estado.cargando && <ActivityIndicator accessibilityLabel="Cargando lista" color="#563bdd" />}<Aviso>{estado.error?.error}</Aviso>
    {estado.error || estado.cursor ? <Boton disabled={estado.cargando} onPress={() => void estado.cargar()} secundario>{estado.error ? "Reintentar" : "Cargar más"}</Boton> : estado.iniciada && <Text style={s.muted}>Fin de la lista.</Text>}</View>;
}
function TarjetaAviso({ aviso }: { aviso: PublicacionApi }) {
  return <Pressable accessibilityRole="button" onPress={() => ir(`/publicacion/${aviso.id_publicacion}`)} style={s.panel}>
    <Foto uri={aviso.imagen} /><Text style={s.subtitulo}>{aviso.titulo}</Text><Text style={s.precio}>${aviso.precio.toLocaleString("es-CL")} CLP</Text>
    <Text style={s.muted}>{aviso.ubicacion} · {aviso.cupos_disponibles === null ? "Disponibilidad por confirmar" : `${aviso.cupos_disponibles} cupos`}</Text><Text style={s.purpura}>{aviso.estado}</Text>
  </Pressable>;
}

export function Catalogo({ inicio = false }: { inicio?: boolean }) {
  const [texto, setTexto] = useState(""), [precio, setPrecio] = useState(""), [cupos, setCupos] = useState("");
  const [query, setQuery] = useState("");
  const estado = usePagina(`/api/publicaciones?${query}`, publicacionValida, "id_publicacion", true);
  return <Pantalla titulo={inicio ? "Roomies" : "Buscar arriendos"}>
    <Boton secundario onPress={() => ir("/personas")}>Buscar personas</Boton>
    <Text style={s.muted}>Encuentra un lugar para vivir.</Text>
    <Campo titulo="Comuna, sector o palabra clave" value={texto} onChangeText={setTexto} maxLength={200} />
    <View style={s.fila}><View style={s.flex}><Campo titulo="Precio máximo CLP" value={precio} onChangeText={setPrecio} numeric maxLength={12} /></View>
      <View style={s.flex}><Campo titulo="Cupos exactos" value={cupos} onChangeText={setCupos} numeric maxLength={3} /></View></View>
    <Boton onPress={() => setQuery(new URLSearchParams({ ...(texto.trim() ? { consulta: texto.trim() } : {}), ...(precio ? { precio_max: precio } : {}), ...(cupos ? { cupos_disponibles: cupos } : {}) }).toString())}>Buscar</Boton>
    {estado.items.map(aviso => <TarjetaAviso key={aviso.id_publicacion} aviso={aviso} />)}
    {estado.iniciada && !estado.items.length && <Text>No hay publicaciones para estos filtros.</Text>}<Pie estado={estado} />
    <Boton secundario onPress={() => ir("/postulaciones")}>Mis postulaciones</Boton><Boton secundario onPress={() => ir("/mis-publicaciones")}>Mis publicaciones</Boton>
  </Pantalla>;
}

export function DetallePublicacion() {
  const { id: identificador } = useLocalSearchParams<{ id: string }>();
  const { sesion } = useAuth();
  const { resultado, actualizar } = useConsulta(`/api/publicaciones/${Number(identificador)}/detalle`, publicacionValida, !sesion);
  const perfil = useConsulta(sesion ? "/api/usuarios/me" : "", perfilValido);
  const operacion = useOperacion();
  const [notice, setNotice] = useState("");
  if (!resultado) return <Pantalla titulo="Publicación"><ActivityIndicator /></Pantalla>;
  if (!resultado.exito) return <Pantalla titulo="Publicación"><Aviso>{resultado.error}</Aviso><Boton onPress={actualizar}>Reintentar</Boton></Pantalla>;
  const aviso = resultado.datos, autor = objeto(aviso.autor) ? aviso.autor : null;
  return <Pantalla titulo={aviso.titulo}><Foto uri={aviso.imagen} />
    {Array.isArray(aviso.imagenes) && aviso.imagenes.filter(objeto).map((foto, i) => <Foto key={String(foto.id_imagen ?? i)} uri={foto.url} />)}
    <Text style={s.precio}>${aviso.precio.toLocaleString("es-CL")} CLP</Text><Text>{aviso.ubicacion}</Text><Text>{aviso.descripcion}</Text>
    <Panel><Text>{aviso.estado} · {aviso.cupos_disponibles ?? "Sin confirmar"} cupos disponibles</Text>
      {Array.isArray(aviso.reglas) && aviso.reglas.map((regla, i) => <Text key={i}>{String(regla)}</Text>)}</Panel>
    {autor && <Boton secundario onPress={() => ir(`/usuario/${Number(autor.id_usuario ?? autor.id_usuario_PK)}`)}>{typeof autor.nombre === "string" ? autor.nombre : "Ver arrendador"}</Boton>}
    <Aviso>{operacion.mensaje}</Aviso>{notice ? <Text accessibilityRole="summary">{notice}</Text> : null}
    {sesion && perfil.resultado?.exito && id(aviso.id_propietario) && aviso.id_propietario !== perfil.resultado.datos.id_usuario && aviso.estado !== "Cerrada" && Number(aviso.cupos_disponibles) > 0 && <Boton disabled={operacion.ocupado} onPress={() => void operacion.ejecutar(
      () => consultar(`/api/publicaciones/${aviso.id_publicacion}/postulaciones`, postulacionValida, { metodo: "POST" }),
      () => { setNotice("Postulación enviada y guardada."); actualizar(); })}>Postular al arriendo</Boton>}
    {sesion ? <><Boton secundario onPress={() => ir(`/postulaciones?idPublicacion=${aviso.id_publicacion}`)}>Ver mi postulación</Boton>
      <Boton secundario onPress={() => ir(`/reportes?tipo=Publicacion&objetivo=${aviso.id_publicacion}`)}>Reportar publicación</Boton></> : <Boton onPress={() => ir("/login")}>Iniciar sesión para postular</Boton>}
  </Pantalla>;
}

export function SelectorConvivencia() {
  return <Pantalla titulo="Chat"><Text style={s.muted}>Tu espacio de convivencia</Text>
    <Boton secundario onPress={() => ir("/chats")}>Conversaciones del arriendo</Boton><Boton secundario onPress={() => ir("/arriendo")}>Mi arriendo</Boton>
    <Boton secundario onPress={() => ir("/reportes")}>Mis reportes</Boton><Boton secundario onPress={() => ir("/notificaciones")}>Notificaciones</Boton>
  </Pantalla>;
}
export function ListaConversaciones() {
  const estado = usePagina("/api/conversaciones", conversacionValida, "id_conversacion");
  return <Pantalla titulo="Conversaciones">{estado.items.map(chat => <Boton key={chat.id_conversacion} secundario onPress={() => ir(`/chats/${chat.id_conversacion}`)}>Chat del arriendo</Boton>)}
    {estado.iniciada && !estado.items.length && <Text>No tienes conversaciones de convivencia activas.</Text>}<Pie estado={estado} /></Pantalla>;
}

export function Arriendo({ propietario = false }: { propietario?: boolean }) {
  const { id: identificador } = useLocalSearchParams<{ id?: string }>();
  const { resultado, actualizar } = useConsulta(propietario ? `/api/arriendos/${Number(identificador)}` : "/api/arriendos/mio", arriendoValido);
  if (!resultado) return <Pantalla titulo="Mi arriendo"><ActivityIndicator /></Pantalla>;
  if (!resultado.exito) return <Pantalla titulo="Mi arriendo"><Aviso>{resultado.estadoHttp === 404 ? "No tienes un arriendo activo." : resultado.error}</Aviso><Boton onPress={actualizar}>Actualizar</Boton></Pantalla>;
  return <ArriendoDetalle key={resultado.datos.id_arriendo} arriendo={resultado.datos} actualizar={actualizar} />;
}
function ArriendoDetalle({ arriendo, actualizar }: { actualizar: () => void; arriendo: { id_arriendo: number; id_publicacion: number; estado: string; ocupacion: number; cupos_totales: number } }) {
  const estado = usePagina(`/api/arriendos/${arriendo.id_arriendo}/integrantes`, integranteValido, "id_usuario");
  const { resultado } = useConsulta(`/api/publicaciones/${arriendo.id_publicacion}/detalle`, publicacionValida);
  const permisos = useConsulta(`/api/arriendos/${arriendo.id_arriendo}/integrantes?limite=1`, objeto);
  const propietario = permisos.resultado?.exito && permisos.resultado.datos.puede_retirar === true;
  const [retiro, setRetiro] = useState<number | null>(null), [motivo, setMotivo] = useState(""), [confirmo, setConfirmo] = useState(false), [notice, setNotice] = useState("");
  const op = useOperacion();
  return <Pantalla titulo="Arriendo"><Panel><Text style={s.subtitulo}>{resultado?.exito ? resultado.datos.titulo : "Nuestro lugar"}</Text>
    <Text>{resultado?.exito ? resultado.datos.ubicacion : ""}</Text><Text>{arriendo.estado} · {arriendo.ocupacion} de {arriendo.cupos_totales} integrantes</Text>
    <Boton secundario onPress={() => ir(`/publicacion/${arriendo.id_publicacion}`)}>Ver publicación</Boton></Panel>
    {arriendo.estado === "Activo" && !propietario && <><Boton onPress={() => ir("/arriendo/chat")}>Chat del arriendo</Boton><Boton secundario onPress={() => ir("/convivencia/tareas")}>Organización de la casa</Boton></>}
    <Text style={s.subtitulo}>Integrantes activos</Text>{estado.items.map(persona => <Panel key={persona.id_usuario}>
      <Text>{persona.nombre ?? `Integrante #${persona.id_usuario}`}</Text><Boton secundario onPress={() => ir(`/reportes?tipo=Usuario&objetivo=${persona.id_usuario}`)}>Reportar integrante</Boton>
      {propietario && <Boton secundario onPress={() => { setRetiro(persona.id_usuario); setMotivo(""); setConfirmo(false); }}>Retirar integrante como dueño</Boton>}</Panel>)}<Pie estado={estado} />
    {retiro !== null && <Panel><Text style={s.subtitulo}>Confirmar retiro</Text><Campo titulo="Motivo del retiro" value={motivo} onChangeText={setMotivo} maxLength={500} editable={!op.ocupado} />
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmo }} onPress={() => setConfirmo(!confirmo)}><Text>{confirmo ? "☑" : "☐"} Confirmo el retiro y la pérdida de acceso al chat y tareas.</Text></Pressable>
      <Boton disabled={!confirmo || !motivo.trim() || op.ocupado} onPress={() => void op.ejecutar(() => consultar(`/api/arriendos/${arriendo.id_arriendo}/expulsiones`, objeto, { metodo: "POST", cuerpo: { id_usuario: retiro, motivo: motivo.trim(), confirmo } }),
        () => { setRetiro(null); setNotice("Integrante retirado. Actualiza para comprobar el estado del arriendo."); estado.actualizar(); actualizar(); })}>Retirar y guardar</Boton><Boton secundario onPress={() => setRetiro(null)} disabled={op.ocupado}>Cancelar</Boton></Panel>}
    <Aviso>{op.mensaje}</Aviso>{notice ? <Text>{notice}</Text> : null}
  </Pantalla>;
}

export function ChatPorId() { const { id: identificador } = useLocalSearchParams<{ id: string }>(); const { sesion } = useAuth(); return <AccesoArriendo><Chat key={`${sesion?.access_token}:${identificador}`} conversacion={Number(identificador)} /></AccesoArriendo>; }
export function ChatDelArriendo() {
  const { sesion } = useAuth();
  const estado = usePagina("/api/conversaciones", conversacionValida, "id_conversacion");
  return <AccesoArriendo>{estado.items[0] ? <Chat key={`${sesion?.access_token}:${estado.items[0].id_conversacion}`} conversacion={estado.items[0].id_conversacion} /> : <Pantalla titulo="Chat del arriendo"><Pie estado={estado} /></Pantalla>}</AccesoArriendo>;
}
function Chat({ conversacion }: { conversacion: number }) {
  const estado = usePagina(`/api/conversaciones/${conversacion}/mensajes`, mensajeValido, "id_mensaje", false, true);
  const [texto, setTexto] = useState(""), [enviados, setEnviados] = useState<MensajeApi[]>([]);
  const clave = useRef({ texto: "", valor: nuevaClave() });
  const op = useOperacion();
  const mensajes = [...new Map([...estado.items, ...enviados].map(m => [m.id_mensaje, m])).values()].sort((a, b) => a.fecha_envio.localeCompare(b.fecha_envio) || a.id_mensaje - b.id_mensaje);
  return <Pantalla titulo="Chat del arriendo"><Boton secundario onPress={estado.actualizar}>Actualizar conversación</Boton><Pie estado={estado} />
    {mensajes.map(m => <Panel key={m.id_mensaje}><Text style={s.purpura}>{m.nombre_remitente}</Text><Text>{m.contenido}</Text><Text style={s.muted}>{new Date(m.fecha_envio).toLocaleString("es-CL")}</Text></Panel>)}
    <Campo titulo="Mensaje" value={texto} onChangeText={setTexto} multiline maxLength={2000} editable={!op.ocupado} /><Aviso>{op.mensaje}</Aviso>
    <Boton disabled={!texto.trim() || op.ocupado || !!estado.error || !estado.iniciada} onPress={() => {
      if (clave.current.texto !== texto) clave.current = { texto, valor: nuevaClave() };
      void op.ejecutar(() => consultar(`/api/conversaciones/${conversacion}/mensajes`, mensajeValido, { metodo: "POST", cuerpo: { contenido: texto.trim(), id_cliente: clave.current.valor } }),
        mensaje => { setEnviados(rows => [...rows, mensaje]); setTexto(""); clave.current = { texto: "", valor: nuevaClave() }; });
    }}>{op.ocupado ? "Enviando…" : "Enviar mensaje"}</Boton>
  </Pantalla>;
}

export function Reportes() {
  const { tipo, objetivo } = useLocalSearchParams<{ tipo?: string; objetivo?: string }>();
  const estado = usePagina("/api/reportes/mios", reporteValido, "id_reporte");
  const [categoria, setCategoria] = useState(""), [descripcion, setDescripcion] = useState(""), [notice, setNotice] = useState("");
  const clave = useRef({ cuerpo: "", valor: nuevaClave() }), op = useOperacion();
  const destino = id(Number(objetivo)) && ["Usuario", "Publicacion"].includes(tipo ?? "");
  return <Pantalla titulo="Mis reportes">{destino ? <Panel><Text style={s.subtitulo}>Reportar {tipo === "Usuario" ? "persona" : "publicación"}</Text>
    <Campo titulo="Categoría" value={categoria} onChangeText={setCategoria} maxLength={80} editable={!op.ocupado} />
    <Campo titulo="Describe lo ocurrido" value={descripcion} onChangeText={setDescripcion} multiline maxLength={1000} editable={!op.ocupado} />
    <Boton disabled={!categoria.trim() || !descripcion.trim() || op.ocupado} onPress={() => {
      const cuerpo = { categoria: categoria.trim(), descripcion: descripcion.trim(), [tipo === "Usuario" ? "id_usuario_reportado" : "id_publicacion_reportada"]: Number(objetivo) };
      const serializado = JSON.stringify(cuerpo); if (clave.current.cuerpo !== serializado) clave.current = { cuerpo: serializado, valor: nuevaClave() };
      void op.ejecutar(() => consultar("/api/reportes", reporteValido, { metodo: "POST", cuerpo, claveIdempotencia: clave.current.valor }), () => {
        setNotice("Reporte enviado y guardado."); setDescripcion(""); setCategoria(""); clave.current = { cuerpo: "", valor: nuevaClave() }; estado.actualizar(); });
    }}>{op.ocupado ? "Enviando…" : "Enviar reporte"}</Boton></Panel> : <Text style={s.muted}>Puedes reportar desde una publicación o desde los integrantes de tu arriendo.</Text>}
    <Aviso>{op.mensaje}</Aviso>{notice ? <Text>{notice}</Text> : null}<Boton secundario onPress={estado.actualizar}>Actualizar seguimiento</Boton>
    {estado.items.map(r => <Panel key={r.id_reporte}><Text style={s.subtitulo}>{r.categoria}</Text><Text>{r.descripcion}</Text><Text style={s.purpura}>{r.estado}</Text><Text style={s.muted}>{new Date(r.fecha).toLocaleDateString("es-CL")}</Text></Panel>)}
    <Pie estado={estado} /></Pantalla>;
}

export function Notificaciones() {
  const estado = usePagina("/api/notificaciones", notificacionValida, "id_notificacion");
  return <Pantalla titulo="Notificaciones">{estado.items.map(n => <Panel key={n.id_notificacion}><Text>{n.tipo === "expulsion" ? "Tu pertenencia al arriendo cambió." : n.tipo === "reporte_actualizado" ? "Hay una actualización de tu reporte." : "Se actualizó el estado de tu postulación."}</Text>
    <Boton secundario onPress={() => ir(n.tipo === "reporte_actualizado" ? "/reportes" : n.tipo === "expulsion" ? "/arriendo" : "/postulaciones")}>Consultar estado</Boton></Panel>)}<Pie estado={estado} /></Pantalla>;
}

export function Perfil() {
  const { resultado, actualizar } = useConsulta("/api/usuarios/me", perfilValido);
  const { cerrarSesion } = useAuth(), op = useOperacion();
  const [notice, setNotice] = useState("");
  async function elegirFoto() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 1 });
      if (result.canceled) return;
      const foto = result.assets[0], error = errorFoto(foto);
      if (error) { op.setMensaje(error); return; }
      await op.ejecutar(() => subirFoto(foto), () => { setNotice("Foto guardada."); actualizar(); });
    } catch { op.setMensaje("No pudimos abrir la galería. Revisa sus permisos e inténtalo nuevamente."); }
  }
  return <Pantalla titulo="Mi perfil">{!resultado ? <ActivityIndicator /> : resultado.exito ? <Panel><Foto uri={resultado.datos.foto_perfil} /><Text style={s.subtitulo}>{resultado.datos.nombre}</Text>
    {typeof resultado.datos.sobre_mi === "string" && <Text>{resultado.datos.sobre_mi}</Text>}<Boton disabled={op.ocupado} onPress={() => void elegirFoto()}>Subir o reemplazar foto</Boton>
    <EditarPerfil key={resultado.datos.id_usuario} perfil={resultado.datos} actualizar={actualizar} /></Panel> : <><Aviso>{resultado.error}</Aviso><Boton onPress={actualizar}>Reintentar</Boton></>}
    <Aviso>{op.mensaje}</Aviso>{notice ? <Text>{notice}</Text> : null}
    <Boton secundario onPress={() => ir("/mis-publicaciones")}>Mis publicaciones</Boton><Boton secundario onPress={() => ir("/postulaciones")}>Mis postulaciones</Boton><Boton secundario onPress={() => ir("/reportes")}>Mis reportes</Boton>
    <Boton secundario onPress={() => void cerrarSesion().then(r => { if (r.exito || r.sesionLocalCerrada) router.replace("/login"); else op.setMensaje(r.error); })}>Cerrar sesión</Boton>
  </Pantalla>;
}

function EditarPerfil({ perfil, actualizar }: { perfil: PerfilApi; actualizar: () => void }) {
  const [editando, setEditando] = useState(false);
  const [ciudad, setCiudad] = useState(String(perfil.ciudad ?? "")), [breve, setBreve] = useState(String(perfil.breve_descripcion ?? ""));
  const [bio, setBio] = useState(String(perfil.sobre_mi ?? "")), [ocupacion, setOcupacion] = useState(String(perfil.ocupacion ?? ""));
  const op = useOperacion();
  if (!editando) return <Boton secundario onPress={() => setEditando(true)}>Editar perfil</Boton>;
  return <><Campo titulo="Ciudad" value={ciudad} onChangeText={setCiudad} maxLength={100} editable={!op.ocupado} />
    <Campo titulo="Descripción breve" value={breve} onChangeText={setBreve} maxLength={160} editable={!op.ocupado} />
    <Campo titulo="Sobre mí" value={bio} onChangeText={setBio} maxLength={2000} multiline editable={!op.ocupado} />
    <Text>Ocupación</Text><View style={s.fila}>{["", "Estudiante", "Trabajador", "Ambos"].map(o => <Boton key={o} secundario={ocupacion !== o} disabled={op.ocupado} onPress={() => setOcupacion(o)}>{o || "Sin indicar"}</Boton>)}</View>
    <Aviso>{op.mensaje}</Aviso><Boton disabled={op.ocupado} onPress={() => void op.ejecutar(() => consultar("/api/usuarios/me", perfilValido,
      { metodo: "PATCH", cuerpo: { ciudad: ciudad.trim() || null, breve_descripcion: breve.trim() || null, sobre_mi: bio.trim() || null, ocupacion: ocupacion || null } }), () => { setEditando(false); actualizar(); })}>Guardar perfil</Boton>
    <Boton secundario disabled={op.ocupado} onPress={() => setEditando(false)}>Cancelar edición</Boton></>;
}

export function MisPublicaciones() {
  const estado = usePagina("/api/publicaciones/mias", publicacionValida, "id_publicacion");
  const op = useOperacion();
  return <Pantalla titulo="Mis publicaciones"><Boton onPress={() => ir("/publicacion/crear/arrendador")}>Publicar arriendo</Boton><Aviso>{op.mensaje}</Aviso>
    {estado.items.map(p => <Panel key={p.id_publicacion}><TarjetaAviso aviso={p} /><Boton secundario onPress={() => ir(`/postulantes/${p.id_publicacion}`)}>Gestionar postulantes</Boton>
      {id(p.id_arriendo) && <Boton secundario onPress={() => ir(`/arriendos/${p.id_arriendo}`)}>Integrantes del arriendo</Boton>}
      <Boton secundario onPress={() => ir(`/publicacion/crear/arrendador?editar=${p.id_publicacion}`)}>Editar publicación</Boton>
      <Boton secundario disabled={op.ocupado || p.estado === "Cerrada"} onPress={() => void op.ejecutar(() => consultar(`/api/publicaciones/${p.id_publicacion}/cerrar`, publicacionValida, { metodo: "PATCH" }), estado.actualizar)}>Cerrar publicación</Boton>
    </Panel>)}<Pie estado={estado} /></Pantalla>;
}
export function Postulantes() {
  const { id: publicacion } = useLocalSearchParams<{ id: string }>();
  const [filtro, setFiltro] = useState("Pendiente"), [motivo, setMotivo] = useState(""), [notice, setNotice] = useState("");
  const estado = usePagina(`/api/publicaciones/${Number(publicacion)}/postulantes?estado=${filtro}`, postulacionValida, "id_postulacion");
  const claves = useRef(new Map<number, string>()), op = useOperacion();
  function decidir(postulacion: number, siguiente: string) {
    if (!claves.current.has(postulacion)) claves.current.set(postulacion, nuevaClave());
    void op.ejecutar(() => consultar(`/api/postulaciones/${postulacion}/estado`, postulacionValida, { metodo: "PATCH", claveIdempotencia: siguiente === "Aceptada" ? claves.current.get(postulacion) : undefined,
      cuerpo: { estado: siguiente, ...(siguiente === "Rechazada" ? { motivo: motivo.trim() } : {}) } }), respuesta => {
      setNotice(respuesta.incorporacion_pendiente ? "Ingreso en proceso. Actualiza para consultar la confirmación." : `Estado guardado: ${respuesta.estado}.`); estado.actualizar(); });
  }
  return <Pantalla titulo="Postulantes"><View style={s.fila}>{["Pendiente", "Preseleccionada", "Aceptada"].map(e => <Boton key={e} secundario disabled={op.ocupado} onPress={() => setFiltro(e)}>{e}</Boton>)}</View>
    <Campo titulo="Motivo de rechazo" value={motivo} onChangeText={setMotivo} maxLength={1000} /><Aviso>{op.mensaje}</Aviso>{notice ? <Text>{notice}</Text> : null}
    {estado.items.map(p => <Panel key={p.id_postulacion}><Text>Postulante #{p.id_usuario}</Text><Text>{p.estado}</Text><Boton secundario onPress={() => ir(`/usuario/${p.id_usuario}`)}>Ver perfil</Boton>
      {p.estado === "Pendiente" && <Boton disabled={op.ocupado} onPress={() => decidir(p.id_postulacion, "Preseleccionada")}>Preseleccionar</Boton>}
      {p.estado === "Preseleccionada" && <Boton disabled={op.ocupado} onPress={() => decidir(p.id_postulacion, "Aceptada")}>Aceptar e incorporar</Boton>}
      {["Pendiente", "Preseleccionada"].includes(p.estado) && <Boton secundario disabled={!motivo.trim() || op.ocupado} onPress={() => decidir(p.id_postulacion, "Rechazada")}>Rechazar con motivo</Boton>}
    </Panel>)}<Pie estado={estado} /></Pantalla>;
}

export function MisPostulaciones() {
  const [filtro, setFiltro] = useState("");
  const estado = usePagina(`/api/postulaciones/mias${filtro ? `?estado=${filtro}` : ""}`, postulacionValida, "id_postulacion");
  const op = useOperacion();
  return <Pantalla titulo="Mis postulaciones"><View style={s.fila}>{["", "Pendiente", "Preseleccionada", "Aceptada", "Cancelada"].map(e => <Boton key={e} secundario disabled={op.ocupado} onPress={() => setFiltro(e)}>{e || "Todas"}</Boton>)}</View>
    <Aviso>{op.mensaje}</Aviso>{estado.items.map(p => <Panel key={p.id_postulacion}><Text style={s.subtitulo}>{typeof p.titulo === "string" ? p.titulo : `Postulación #${p.id_postulacion}`}</Text>
      <Text style={s.purpura}>{p.estado}</Text>{typeof p.motivo === "string" && <Text>{p.motivo}</Text>}<Boton secundario onPress={() => ir(`/publicacion/${p.id_publicacion}`)}>Ver publicación</Boton>
      {["Pendiente", "Preseleccionada"].includes(p.estado) && <Boton secundario disabled={op.ocupado} onPress={() => void op.ejecutar(() => consultar(`/api/postulaciones/${p.id_postulacion}/retiro`, postulacionValida, { metodo: "POST" }), estado.actualizar)}>Retirar postulación</Boton>}
      {p.estado === "Aceptada" && <Boton secundario onPress={() => ir("/arriendo")}>Consultar mi arriendo</Boton>}</Panel>)}<Pie estado={estado} /></Pantalla>;
}

export function PerfilPublico() {
  const { id: identificador } = useLocalSearchParams<{ id: string }>();
  const { resultado, actualizar } = useConsulta(`/conexiones/usuarios/${Number(identificador)}`, personaValida, true);
  return <Pantalla titulo="Perfil público">{!resultado ? <ActivityIndicator /> : !resultado.exito ? <><Aviso>{resultado.error}</Aviso><Boton onPress={actualizar}>Reintentar</Boton></> : <Panel>
    <Foto uri={resultado.datos.foto_perfil} /><Text style={s.subtitulo}>{resultado.datos.nombre}</Text>
    {typeof resultado.datos.ocupacion === "string" && <Text>{resultado.datos.ocupacion}</Text>}
    <SolicitarConexion />
    <Boton secundario onPress={() => ir(`/reportes?tipo=Usuario&objetivo=${resultado.datos.id_usuario_PK}`)}>Reportar persona</Boton></Panel>}</Pantalla>;
}

export function MenuPublicar() {
  return <Pantalla titulo="Publicar"><Panel><Text style={s.subtitulo}>Publicar arriendo</Text><Text style={s.muted}>Ofrece un espacio con su ubicación, cupos y fotografías.</Text>
    <Boton onPress={() => ir("/publicacion/crear/arrendador")}>Crear publicación</Boton></Panel><Boton secundario onPress={() => ir("/mis-publicaciones")}>Administrar mis publicaciones</Boton></Pantalla>;
}

export const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#fcfbff" }, contenido: { padding: 20, paddingTop: 38, paddingBottom: 40, gap: 16 },
  titulo: { fontSize: 26, fontWeight: "800", color: "#563bdd" }, subtitulo: { fontSize: 18, fontWeight: "700", color: "#25243a" },
  panel: { backgroundColor: "white", borderWidth: 1, borderColor: "#e9e5f3", borderRadius: 20, padding: 16, gap: 12 },
  boton: { padding: 14, backgroundColor: "#563bdd", borderRadius: 14, alignItems: "center" }, botonTexto: { fontSize: 14, fontWeight: "700", color: "white" },
  secundario: { backgroundColor: "#f0ebff" }, purpura: { color: "#563bdd" }, deshabilitado: { opacity: 0.45 }, muted: { color: "#817d96", fontSize: 13 },
  input: { borderWidth: 1, borderColor: "#e9e5f3", borderRadius: 13, padding: 13, color: "#25243a", backgroundColor: "white", minHeight: 46 },
  textarea: { minHeight: 100, textAlignVertical: "top" }, campo: { gap: 8 }, etiqueta: { color: "#25243a", fontWeight: "600" }, error: { color: "#9b1c31" },
  fila: { flexDirection: "row", gap: 10, flexWrap: "wrap" }, flex: { flex: 1, minWidth: 110 }, foto: { width: "100%", height: 200, borderRadius: 14 }, precio: { fontSize: 22, fontWeight: "800", color: "#563bdd" },
});
