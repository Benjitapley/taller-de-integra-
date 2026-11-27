import { useState } from "react";
import { Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import AccesoArriendo from "@/components/convivencia/AccesoArriendo";
import { useConsulta, useOperacion, usePagina } from "@/hooks/useApi";
import { arriendoValido, consultar, id, integranteValido } from "@/services/roomiesApi";
import { tarea } from "@/services/tareasService";
import { Aviso, Boton, Campo, ir, Pantalla, Pie } from "./Recorrido";

export default function FormularioTarea() {
  return <AccesoArriendo><Formulario /></AccesoArriendo>;
}
function Formulario() {
  const { tarea: identificador } = useLocalSearchParams<{ tarea?: string }>();
  const arriendo = useConsulta("/api/arriendos/mio", arriendoValido);
  if (!arriendo.resultado?.exito) return <Pantalla titulo="Tarea"><Aviso>{arriendo.resultado && !arriendo.resultado.exito ? arriendo.resultado.error : "Cargando arriendo…"}</Aviso></Pantalla>;
  return <Campos key={`${arriendo.resultado.datos.id_arriendo}:${identificador}`} arriendo={arriendo.resultado.datos.id_arriendo} identificador={Number(identificador)} />;
}
function Campos({ arriendo, identificador }: { arriendo: number; identificador: number }) {
  const edicion = id(identificador);
  const integrantes = usePagina(`/api/arriendos/${arriendo}/integrantes`, integranteValido, "id_usuario");
  const [titulo, setTitulo] = useState(""), [descripcion, setDescripcion] = useState("");
  const [asignado, setAsignado] = useState<number | null>(null), [confirmado, setConfirmado] = useState(false);
  const op = useOperacion();
  return <Pantalla titulo={edicion ? "Reasignar tarea" : "Crear tarea"}>
    {!edicion && <><Campo titulo="Título" value={titulo} onChangeText={setTitulo} maxLength={120} editable={!op.ocupado} />
      <Campo titulo="Descripción" value={descripcion} onChangeText={setDescripcion} multiline maxLength={1000} editable={!op.ocupado} /></>}
    <Text>Responsable</Text><Boton secundario disabled={op.ocupado} onPress={() => setAsignado(null)}>{asignado === null ? "✓ " : ""}Sin asignar</Boton>
    {integrantes.items.map(p => <Boton key={p.id_usuario} secundario disabled={op.ocupado} onPress={() => setAsignado(p.id_usuario)}>{asignado === p.id_usuario ? "✓ " : ""}{p.nombre ?? `Integrante #${p.id_usuario}`}</Boton>)}
    <Pie estado={integrantes} /><Aviso>{op.mensaje}</Aviso>
    {confirmado ? <Text>Tarea guardada.</Text> : <Boton disabled={op.ocupado || (!edicion && !titulo.trim()) || !integrantes.iniciada || !!integrantes.error} onPress={() => void op.ejecutar(
      () => consultar(edicion ? `/api/tareas/${identificador}` : `/api/arriendos/${arriendo}/tareas`, tarea,
        { metodo: edicion ? "PATCH" : "POST", cuerpo: edicion ? { id_asignado: asignado } : { titulo: titulo.trim(), descripcion: descripcion.trim() || null, id_asignado: asignado } }),
      () => setConfirmado(true))}>{op.ocupado ? "Guardando…" : "Guardar tarea"}</Boton>}
    <Boton secundario onPress={() => ir("/convivencia/tareas")}>Consultar tareas guardadas</Boton>
  </Pantalla>;
}
