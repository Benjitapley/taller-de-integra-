import { useState, type ReactNode } from "react";
import { ActivityIndicator, Text } from "react-native";
import { useAuth } from "@/hooks/useAuth";
import { useConsulta, useOperacion } from "@/hooks/useApi";
import { consultar, perfilValido } from "@/services/roomiesApi";
import { validarFechaNacimiento } from "@/utils/fechaNacimiento";
import { Aviso, Boton, Campo, Pantalla } from "@/screens/Recorrido";

/** El alta del proveedor y el perfil de negocio se confirman por separado. */
export default function AccesoPerfil({ children }: { children: ReactNode }) {
  const { sesion, cerrarSesion } = useAuth();
  const { resultado, actualizar } = useConsulta("/api/usuarios/me", perfilValido);
  if (resultado?.exito) return children;
  if (!resultado) return <Pantalla titulo="Preparando tu cuenta"><ActivityIndicator /></Pantalla>;
  return <Pantalla titulo="Mi cuenta">{resultado.estadoHttp === 404 ? <Inicializar key={sesion?.access_token} actualizar={actualizar} /> : <>
    <Aviso>{resultado.error}</Aviso><Boton onPress={actualizar}>Reintentar</Boton></>}
    <Boton secundario onPress={() => void cerrarSesion()}>Cerrar sesión</Boton></Pantalla>;
}
function Inicializar({ actualizar }: { actualizar: () => void }) {
  const { sesion } = useAuth();
  const datos = sesion?.user.user_metadata;
  const [nombre, setNombre] = useState(typeof datos?.nombre === "string" ? datos.nombre : "");
  const [fecha, setFecha] = useState(typeof datos?.fecha_nacimiento === "string" ? datos.fecha_nacimiento : "");
  const op = useOperacion();
  return <><Text>Confirma tus datos para completar el perfil de Roomies.</Text>
    <Campo titulo="Nombre" value={nombre} onChangeText={setNombre} maxLength={120} editable={!op.ocupado} />
    <Campo titulo="Fecha de nacimiento (AAAA-MM-DD)" value={fecha} onChangeText={setFecha} maxLength={10} editable={!op.ocupado} />
    <Aviso>{op.mensaje}</Aviso><Boton disabled={op.ocupado} onPress={() => {
      const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
      const validacion = validarFechaNacimiento(partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : "");
      if (!nombre.trim() || !validacion.valido) { op.setMensaje(!nombre.trim() ? "Indica tu nombre." : !validacion.valido ? validacion.error : "Revisa los datos."); return; }
      void op.ejecutar(() => consultar("/api/usuarios/me", perfilValido, { metodo: "POST", cuerpo: { nombre: nombre.trim(), fecha_nacimiento: validacion.fechaISO } }), actualizar);
    }}>{op.ocupado ? "Guardando…" : "Completar perfil"}</Boton></>;
}
