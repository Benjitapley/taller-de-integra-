import { useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useConsulta, useOperacion } from "@/hooks/useApi";
import { solicitarFormulario } from "@/services/httpClient";
import { adjuntarFoto, errorFoto, id, objeto, publicacionValida, nuevaClave, respuestaInvalida, type FotoSeleccionada, type PublicacionApi, type Resultado } from "@/services/roomiesApi";
import { Pantalla, Campo, Boton, Aviso, Panel, s, ir } from "@/screens/Recorrido";

type Lugar = { id_region?: number; id_comuna?: number; nombre: string };
const lugaresValidos = (v: unknown): v is Lugar[] => Array.isArray(v) && v.every(x => objeto(x) && typeof x.nombre === "string" && (id(x.id_region) || id(x.id_comuna)));
type Formulario = { titulo: string; descripcion: string; ubicacion: string; precio: string; cupos: string; vivienda: string; comuna: string; mascota: boolean; reglas: string };
const vacio: Formulario = { titulo: "", descripcion: "", ubicacion: "", precio: "", cupos: "", vivienda: "habitacion", comuna: "", mascota: false, reglas: "" };

export default function FormularioAviso() {
  const { editar } = useLocalSearchParams<{ editar?: string }>();
  const editId = Number(editar), edicion = id(editId);
  const regiones = useConsulta("/api/regiones", lugaresValidos, true);
  const region = regiones.resultado?.exito ? regiones.resultado.datos.find(x => x.nombre.toLowerCase().includes("araucan"))?.id_region : undefined;
  const comunas = useConsulta(region ? `/api/regiones/${region}/comunas` : "", lugaresValidos, true);
  const existente = useConsulta(edicion ? `/api/publicaciones/${editId}/detalle` : "", publicacionValida);
  const [form, setForm] = useState<Formulario>(vacio), [fotos, setFotos] = useState<FotoSeleccionada[]>([]);
  const [conservadas, setConservadas] = useState<{ id: number; url: string }[]>([]), [cargada, setCargada] = useState<number | null>(null), [vistaPrevia, setVistaPrevia] = useState(false);
  const clave = useRef({ cuerpo: "", valor: nuevaClave() }), op = useOperacion();
  if (edicion && existente.resultado?.exito && cargada !== editId) {
    const p = existente.resultado.datos;
    setForm({ titulo: p.titulo, descripcion: p.descripcion, ubicacion: p.ubicacion, precio: String(p.precio), cupos: String(p.cupos_totales), vivienda: String(p.tipo_vivienda), comuna: String(p.id_comuna), mascota: p.mascota === "si", reglas: Array.isArray(p.reglas) ? p.reglas.join("\n") : "" });
    setConservadas(Array.isArray(p.imagenes) ? p.imagenes.filter(objeto).flatMap(x => id(x.id_imagen ?? x.id) && typeof x.url === "string" ? [{ id: Number(x.id_imagen ?? x.id), url: x.url }] : []) : []);
    setCargada(editId);
  }
  const cambiar = (campo: keyof Formulario, valor: string | boolean) => setForm(old => ({ ...old, [campo]: valor }));
  async function elegir() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 5, quality: 1 });
      if (result.canceled) return;
      if (fotos.length + conservadas.length + result.assets.length > 5) { op.setMensaje("Puedes guardar hasta cinco fotografías."); return; }
      const error = result.assets.map(errorFoto).find(Boolean);
      if (error) { op.setMensaje(error); return; }
      setFotos(old => [...old, ...result.assets]); op.setMensaje("");
    } catch { op.setMensaje("No pudimos abrir la galería. Comprueba los permisos."); }
  }
  function validar() {
    if (!form.titulo.trim() || !form.descripcion.trim() || !form.ubicacion.trim()) return "Completa título, descripción y dirección.";
    if (!/^\d{1,12}$/.test(form.precio) || Number(form.precio) > 999999999999) return "El precio debe ser un entero CLP entre 0 y 999999999999.";
    if (!/^\d+$/.test(form.cupos) || !id(Number(form.cupos))) return "Indica un número de cupos mayor que cero.";
    if (!region || !comunas.resultado?.exito || !comunas.resultado.datos.some(x => x.id_comuna === Number(form.comuna))) return "Selecciona una comuna de La Araucanía.";
    return null;
  }
  async function guardar(): Promise<Resultado<PublicacionApi>> {
    const error = validar();
    if (error) return { exito: false, codigo: "peticion_invalida", error };
    const body = { titulo: form.titulo.trim(), descripcion: form.descripcion.trim(), ubicacion: form.ubicacion.trim(), precio: form.precio, cupos_totales: form.cupos,
      tipo: "Arrendador", categoria: "ofrezco", tipo_vivienda: form.vivienda, mascota: form.mascota ? "si" : "no", id_region: String(region), id_comuna: form.comuna,
      reglas_arrendador: JSON.stringify(form.reglas.split("\n").map(x => x.trim()).filter(Boolean)), ...(edicion ? { imagenes_conservar: JSON.stringify(conservadas.map(x => x.id)) } : {}) };
    const fingerprint = JSON.stringify({ body, fotos: fotos.map(x => x.uri) });
    if (clave.current.cuerpo !== fingerprint) clave.current = { cuerpo: fingerprint, valor: nuevaClave() };
    const cuerpo = new FormData();
    for (const [key, value] of Object.entries(body)) cuerpo.append(key, value);
    fotos.forEach(foto => adjuntarFoto(cuerpo, "imagenes", foto));
    const r = await solicitarFormulario(edicion ? `/api/publicaciones/${editId}` : "/api/publicaciones", { metodo: edicion ? "PUT" : "POST", cuerpo, claveIdempotencia: clave.current.valor, tiempoLimiteMs: 60000 });
    return !r.exito ? r : publicacionValida(r.datos) ? { ...r, datos: r.datos } : respuestaInvalida(r.estadoHttp);
  }
  if (edicion && !existente.resultado) return <Pantalla titulo="Editar publicación"><ActivityIndicator /></Pantalla>;
  if (edicion && existente.resultado && !existente.resultado.exito) return <Pantalla titulo="Editar publicación"><Aviso>{existente.resultado.error}</Aviso><Boton onPress={existente.actualizar}>Reintentar</Boton></Pantalla>;
  return <Pantalla titulo={vistaPrevia ? "Vista previa" : edicion ? "Editar arriendo" : "Publicar arriendo"}>
    <Text style={s.muted}>Región de La Araucanía · Solo publicaciones de arrendador</Text>
    {vistaPrevia ? <Panel><Text style={s.subtitulo}>{form.titulo}</Text><Text style={s.precio}>${Number(form.precio).toLocaleString("es-CL")} CLP</Text><Text>{form.ubicacion}</Text><Text>{form.descripcion}</Text><Text>{form.cupos} cupos</Text></Panel> : <>
      <Campo titulo="Título" value={form.titulo} onChangeText={v => cambiar("titulo", v)} maxLength={120} editable={!op.ocupado} />
      <Campo titulo="Descripción" value={form.descripcion} onChangeText={v => cambiar("descripcion", v)} multiline maxLength={2000} editable={!op.ocupado} />
      <Campo titulo="Dirección o sector" value={form.ubicacion} onChangeText={v => cambiar("ubicacion", v)} maxLength={250} editable={!op.ocupado} />
      <Campo titulo="Precio mensual CLP" value={form.precio} onChangeText={v => cambiar("precio", v)} numeric maxLength={12} editable={!op.ocupado} />
      <Campo titulo="Cupos totales" value={form.cupos} onChangeText={v => cambiar("cupos", v)} numeric maxLength={10} editable={!op.ocupado} />
      <Text style={s.etiqueta}>Tipo de vivienda</Text><View style={s.fila}>{["habitacion", "departamento", "casa"].map(tipo => <Boton key={tipo} secundario={form.vivienda !== tipo} disabled={op.ocupado} onPress={() => cambiar("vivienda", tipo)}>{tipo === "habitacion" ? "Habitación" : tipo === "casa" ? "Casa" : "Departamento"}</Boton>)}</View>
      <Text style={s.etiqueta}>Comuna</Text>
      {comunas.resultado?.exito ? <View style={s.fila}>{comunas.resultado.datos.map(comuna => <Boton key={comuna.id_comuna} secundario={form.comuna !== String(comuna.id_comuna)} disabled={op.ocupado} onPress={() => cambiar("comuna", String(comuna.id_comuna))}>{comuna.nombre}</Boton>)}</View> : <>
        <Aviso>{regiones.resultado && !regiones.resultado.exito ? regiones.resultado.error : comunas.resultado && !comunas.resultado.exito ? comunas.resultado.error : "Cargando comunas…"}</Aviso>
        <Boton secundario onPress={() => { regiones.actualizar(); comunas.actualizar(); }}>Actualizar comunas</Boton></>}
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: form.mascota }} disabled={op.ocupado} onPress={() => cambiar("mascota", !form.mascota)}><Text>{form.mascota ? "☑" : "☐"} Se aceptan mascotas</Text></Pressable>
      <Campo titulo="Reglas del arriendo (una por línea)" value={form.reglas} onChangeText={v => cambiar("reglas", v)} multiline editable={!op.ocupado} />
    </>}
    {conservadas.map(foto => <Panel key={foto.id}><Image source={{ uri: foto.url }} style={s.foto} /><Boton secundario disabled={op.ocupado} onPress={() => setConservadas(rows => rows.filter(x => x.id !== foto.id))}>Quitar fotografía guardada</Boton></Panel>)}
    {fotos.map((foto, i) => <Panel key={`${foto.uri}:${i}`}><Image source={{ uri: foto.uri }} style={s.foto} /><Boton secundario disabled={op.ocupado} onPress={() => setFotos(rows => rows.filter((_, n) => n !== i))}>Quitar foto seleccionada</Boton></Panel>)}
    <Boton secundario disabled={op.ocupado || fotos.length + conservadas.length >= 5} onPress={() => void elegir()}>Seleccionar fotografías</Boton><Aviso>{op.mensaje}</Aviso>
    {vistaPrevia ? <><Boton disabled={op.ocupado} onPress={() => void op.ejecutar(guardar, p => ir(`/publicacion/${p.id_publicacion}`))}>{op.ocupado ? "Guardando…" : "Confirmar y guardar"}</Boton>
      <Boton secundario disabled={op.ocupado} onPress={() => setVistaPrevia(false)}>Volver a editar</Boton></> : <Boton disabled={op.ocupado} onPress={() => { const error = validar(); if (error) op.setMensaje(error); else { op.setMensaje(""); setVistaPrevia(true); } }}>Revisar publicación</Boton>}
  </Pantalla>;
}
