import * as ImagePicker from "expo-image-picker";
import { useRef, useState } from "react";
import { Image, Platform, Text, View } from "react-native";
import { CustomButton } from "@/components/CustomButton";
import { guardarFotoPerfil, prepararFoto, type FotoPerfilElegida } from "@/services/fotoPerfilService";

interface Props {
  identidad: string;
  tieneFoto: boolean;
  onGuardada: (identidad: string, url: string) => void;
}

export function EditorFotoPerfil({ identidad, tieneFoto, onGuardada }: Props) {
  const [foto, setFoto] = useState<FotoPerfilElegida | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);
  const ocupado = useRef(false);

  async function elegir() {
    if (ocupado.current) return;
    setMensaje("");
    try {
      if (Platform.OS !== "web") {
        const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permiso.granted) {
          setMensaje("Para elegir una foto, permite el acceso a tus fotos en los ajustes del teléfono.");
          return;
        }
      }
      const seleccion = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"] });
      if (seleccion.canceled) return;
      const resultado = prepararFoto(seleccion.assets[0]);
      if (resultado.archivo) setFoto(resultado.archivo);
      else setMensaje(resultado.error);
    } catch {
      setMensaje("No pudimos abrir la foto. Intenta elegirla nuevamente.");
    }
  }

  async function guardar() {
    if (!foto || ocupado.current) return;
    ocupado.current = true;
    setGuardando(true);
    setMensaje("");
    try {
      const resultado = await guardarFotoPerfil(foto, identidad);
      if (!resultado.exito) {
        setMensaje(resultado.error);
        return;
      }
      onGuardada(identidad, resultado.url);
      setFoto(null);
      setMensaje("Foto de perfil actualizada.");
    } catch {
      setMensaje("No pudimos confirmar la subida. Vuelve a consultar el perfil o reintenta.");
    } finally {
      ocupado.current = false;
      setGuardando(false);
    }
  }

  return (
    <View style={{ gap: 8 }}>
      {foto ? (
        <>
          <Image source={{ uri: foto.uri }} accessibilityLabel="Vista previa de la nueva foto"
            style={{ width: 96, height: 96, borderRadius: 48, alignSelf: "center" }} />
          <CustomButton titulo="Guardar foto" onPress={guardar} cargando={guardando} />
          <CustomButton titulo="Cancelar" variante="contorno" deshabilitado={guardando}
            onPress={() => { setFoto(null); setMensaje(""); }} />
        </>
      ) : (
        <CustomButton titulo={tieneFoto ? "Reemplazar foto de perfil" : "Elegir foto de perfil"}
          variante="contorno" iconoIzquierdo="image-outline" onPress={elegir} />
      )}
      {mensaje ? <Text accessibilityRole="alert">{mensaje}</Text> : null}
    </View>
  );
}
