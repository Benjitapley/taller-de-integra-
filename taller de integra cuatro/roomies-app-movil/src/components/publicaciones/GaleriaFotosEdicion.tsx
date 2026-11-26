import React, { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Image, type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MAX_MEGAPIXELES_FOTO, TAMANO_MAX_FOTO_MB } from "@/constants/fotosPublicacion";
import { paletaPublicacion } from "@/constants/origenPublicacion";
import { colors } from "@/theme/colors";
import type { ImagenRemota } from "@/types/PublicacionPropia";
import { motivoRechazoFoto } from "@/utils/validarFotoPublicacion";

const COLUMNAS = 3;
const SEPARACION = 10;

interface GaleriaFotosEdicionProps {
  /** Fotos ya guardadas que se conservan (cada una con su `idImagen`). */
  remotas: ImagenRemota[];
  /** Fotos nuevas elegidas en este dispositivo (URIs locales). */
  nuevas: string[];
  /** Máximo entre conservadas y nuevas. */
  limite: number;
  onQuitarRemota: (idImagen: number) => void;
  onQuitarNueva: (uri: string) => void;
  onAgregar: (uris: string[]) => void;
  deshabilitado?: boolean;
}

// Edición de fotos: mezcla las que ya están en el servidor con las nuevas. Quitar una
// foto remota solo la saca de la lista que se enviará como `imagenes_conservar`: el
// servidor no borra nada hasta que se guardan los cambios.
export const GaleriaFotosEdicion: React.FC<GaleriaFotosEdicionProps> = ({
  remotas,
  nuevas,
  limite,
  onQuitarRemota,
  onQuitarNueva,
  onAgregar,
  deshabilitado = false,
}) => {
  const [error, setError] = useState<string>();
  const [abriendo, setAbriendo] = useState(false);
  const [ancho, setAncho] = useState(0);

  const total = remotas.length + nuevas.length;
  const restantes = limite - total;
  const lado = ancho > 0 ? Math.floor((ancho - SEPARACION * (COLUMNAS - 1)) / COLUMNAS) : 0;

  const medir = (e: LayoutChangeEvent) => setAncho(e.nativeEvent.layout.width);

  async function agregar() {
    if (abriendo || deshabilitado || restantes <= 0) return;
    setError(undefined);
    setAbriendo(true);
    try {
      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: restantes > 1,
        selectionLimit: restantes,
        quality: 0.8,
      });
      if (resultado.canceled) return;

      const aceptadas: string[] = [];
      let formatoInvalido = false;
      let muyPesada = false;
      let resolucionAlta = false;
      let sobraron = false;

      for (const asset of resultado.assets) {
        const motivo = motivoRechazoFoto(asset);
        if (motivo === "formato") {
          formatoInvalido = true;
        } else if (motivo === "tamano") {
          muyPesada = true;
        } else if (motivo === "resolucion") {
          resolucionAlta = true;
        } else if (nuevas.includes(asset.uri) || aceptadas.includes(asset.uri)) {
          // Misma foto elegida dos veces: se ignora.
        } else if (aceptadas.length >= restantes) {
          sobraron = true;
        } else {
          aceptadas.push(asset.uri);
        }
      }

      if (aceptadas.length > 0) onAgregar(aceptadas);

      const avisos: string[] = [];
      if (formatoInvalido) avisos.push("Solo se aceptan fotos JPG, PNG o WEBP.");
      if (muyPesada) avisos.push(`Cada foto debe pesar máximo ${TAMANO_MAX_FOTO_MB} MB.`);
      if (resolucionAlta) avisos.push(`Cada foto debe tener como máximo ${MAX_MEGAPIXELES_FOTO} megapíxeles.`);
      if (sobraron) avisos.push(`Solo puedes tener hasta ${limite} fotos.`);
      if (avisos.length > 0) setError(avisos.join(" "));
    } catch {
      setError("No se pudo abrir la galería. Inténtalo de nuevo.");
    } finally {
      setAbriendo(false);
    }
  }

  return (
    <View>
      <View style={styles.grilla} onLayout={medir}>
        {lado > 0 &&
          Array.from({ length: limite }, (_, i) => {
            const caja = { width: lado, height: lado };
            const remota = remotas[i];
            const uriNueva = i >= remotas.length ? nuevas[i - remotas.length] : undefined;
            const uri = remota?.url ?? uriNueva;

            if (uri) {
              const clave = remota ? `remota-${remota.idImagen}` : `nueva-${uriNueva}`;
              return (
                <View key={clave} style={[styles.ranura, caja]}>
                  <Image source={{ uri }} style={styles.foto} resizeMode="cover" />
                  {i === 0 && (
                    <View style={styles.chip}>
                      <Text style={styles.chipTexto}>Principal</Text>
                    </View>
                  )}
                  {!remota && (
                    <View style={[styles.chip, styles.chipNueva]}>
                      <Text style={styles.chipTexto}>Nueva</Text>
                    </View>
                  )}
                  <Pressable
                    onPress={() => (remota ? onQuitarRemota(remota.idImagen) : onQuitarNueva(uriNueva as string))}
                    disabled={deshabilitado}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Quitar foto ${i + 1}`}
                    style={styles.botonQuitar}
                  >
                    <Ionicons name="close" size={16} color="#FFFFFF" />
                  </Pressable>
                </View>
              );
            }

            return (
              <Pressable
                key={`vacia-${i}`}
                onPress={agregar}
                disabled={abriendo || deshabilitado}
                accessibilityRole="button"
                accessibilityLabel="Subir foto"
                style={[styles.ranura, styles.ranuraVacia, caja]}
              >
                <Ionicons name="image-outline" size={26} color={colors.primary} />
                <Text style={styles.ranuraTitulo}>Subir foto</Text>
                <Text style={styles.ranuraDetalle}>JPG, PNG o WEBP</Text>
                <Text style={styles.ranuraDetalle}>Máx. {TAMANO_MAX_FOTO_MB} MB</Text>
              </Pressable>
            );
          })}
      </View>

      <Text style={styles.contador}>
        {total} de {limite} fotos
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  grilla: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SEPARACION,
  },
  ranura: {
    borderRadius: 12,
    overflow: "hidden",
  },
  ranuraVacia: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    padding: 6,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#C4BDF5",
    backgroundColor: paletaPublicacion.fondoSuave,
  },
  ranuraTitulo: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  ranuraDetalle: {
    fontSize: 10,
    color: paletaPublicacion.textoSecundario,
  },
  foto: {
    width: "100%",
    height: "100%",
  },
  chip: {
    position: "absolute",
    left: 6,
    bottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  chipNueva: {
    left: undefined,
    right: 6,
    backgroundColor: "#15803D",
  },
  chipTexto: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  botonQuitar: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  contador: {
    marginTop: 10,
    fontSize: 12,
    color: paletaPublicacion.textoSecundario,
  },
  error: {
    marginTop: 6,
    fontSize: 12,
    color: "#B91C1C",
  },
});
