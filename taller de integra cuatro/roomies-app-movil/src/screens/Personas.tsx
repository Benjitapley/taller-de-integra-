import { useState } from "react";
import { ActivityIndicator, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useConsulta, useOperacion } from "@/hooks/useApi";
import { consultar, id, objeto, personaValida, perfilValido, type PersonaApi } from "@/services/roomiesApi";
import { Aviso, Boton, Campo, ir, Panel, Pantalla } from "./Recorrido";

const personasValidas = (v: unknown): v is PersonaApi[] => Array.isArray(v) && v.every(personaValida);
type Conexion = { id_conexion: number; id_solicitante_FK: number; id_receptor_FK: number; estado: string };
const conexionValida = (v: unknown): v is Conexion => objeto(v) && id(v.id_conexion) && id(v.id_solicitante_FK) && id(v.id_receptor_FK) && ["Pendiente", "Aceptada", "Rechazada"].includes(String(v.estado));
const conexionesValidas = (v: unknown): v is Conexion[] => Array.isArray(v) && v.every(conexionValida);

export default function Personas() {
  const [zona, setZona] = useState(""), [ocupacion, setOcupacion] = useState(""), [query, setQuery] = useState("");
  const { resultado, actualizar } = useConsulta(`/conexiones/usuarios/otros?${query}`, personasValidas);
  return <Pantalla titulo="Buscar personas"><Boton secundario onPress={() => ir("/conexiones")}>Mis conexiones</Boton>
    <Campo titulo="Zona de interés" value={zona} onChangeText={setZona} maxLength={250} />
    <Campo titulo="Ocupación" value={ocupacion} onChangeText={setOcupacion} maxLength={100} />
    <Boton onPress={() => { const siguiente = new URLSearchParams({ ...(zona.trim() ? { zona: zona.trim() } : {}), ...(ocupacion.trim() ? { ocupacion: ocupacion.trim() } : {}) }).toString(); if (query === siguiente) actualizar(); else setQuery(siguiente); }}>Buscar</Boton>
    {!resultado ? <ActivityIndicator /> : !resultado.exito ? <><Aviso>{resultado.error}</Aviso><Boton onPress={actualizar}>Reintentar</Boton></> : <>
      {resultado.datos.length === 0 && <Text>No hay personas para estos filtros.</Text>}
      {resultado.datos.map(p => <Panel key={p.id_usuario_PK}><Text>{p.nombre}</Text>{typeof p.ocupacion === "string" && <Text>{p.ocupacion}</Text>}
        <Boton secundario onPress={() => ir(`/usuario/${p.id_usuario_PK}`)}>Ver perfil</Boton></Panel>)}
      {resultado.datos.length === 100 && <Text>El servicio entrega hasta 100 resultados. Precisa la zona u ocupación para acotar la búsqueda.</Text>}</>}
  </Pantalla>;
}
export function Conexiones() {
  const [vista, setVista] = useState("recibidas");
  const perfil = useConsulta("/api/usuarios/me", perfilValido);
  const { resultado, actualizar } = useConsulta(`/conexiones/${vista}`, conexionesValidas), op = useOperacion();
  return <Pantalla titulo="Mis conexiones">{["recibidas", "enviadas", "aceptadas"].map(v => <Boton key={v} secundario onPress={() => setVista(v)}>{v}</Boton>)}
    <Aviso>{op.mensaje}</Aviso>{!resultado ? <ActivityIndicator /> : !resultado.exito ? <><Aviso>{resultado.error}</Aviso><Boton onPress={actualizar}>Reintentar</Boton></> : <>
      {!resultado.datos.length && <Text>No hay conexiones en esta vista.</Text>}
      {resultado.datos.map(c => <Panel key={c.id_conexion}><Text>Conexión #{c.id_conexion} · {c.estado}</Text>
        {perfil.resultado?.exito && <Boton secundario onPress={() => ir(`/usuario/${perfil.resultado?.exito && perfil.resultado.datos.id_usuario === c.id_solicitante_FK ? c.id_receptor_FK : c.id_solicitante_FK}`)}>Ver persona</Boton>}
        {vista === "recibidas" && c.estado === "Pendiente" && ["Aceptada", "Rechazada"].map(estado => <Boton key={estado} disabled={op.ocupado} onPress={() => void op.ejecutar(
          () => consultar(`/conexiones/${c.id_conexion}`, conexionValida, { metodo: "PUT", cuerpo: { estado } }), actualizar)}>{estado === "Aceptada" ? "Aceptar conexión" : "Rechazar conexión"}</Boton>)}
      </Panel>)}</>}
  </Pantalla>;
}
export function SolicitarConexion() {
  const { id: destinatario } = useLocalSearchParams<{ id: string }>();
  const op = useOperacion(); const [enviada, setEnviada] = useState(false);
  return <><Aviso>{op.mensaje}</Aviso><Boton disabled={op.ocupado || enviada} onPress={() => void op.ejecutar(
    () => consultar("/conexiones/", conexionValida, { metodo: "POST", cuerpo: { id_receptor_FK: Number(destinatario) } }), () => setEnviada(true))}>{enviada ? "Solicitud guardada" : "Solicitar conexión"}</Boton></>;
}
