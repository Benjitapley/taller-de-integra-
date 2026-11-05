import { Image, StyleSheet, Text, View } from "react-native";
import type { PublicacionContexto } from "@/data/chatsMock";

type Props = {
  publicacion: PublicacionContexto;
};

export default function EncabezadoContextual({ publicacion }: Props) {
  return (
    <View style={styles.tarjeta}>
      <Image source={{ uri: publicacion.imagenUrl }} style={styles.imagen} />
      <View style={styles.textos}>
        <Text style={styles.titulo} numberOfLines={1}>
          {publicacion.titulo}
        </Text>
        <Text style={styles.subtitulo} numberOfLines={1}>
          {publicacion.subtitulo}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F5F3FF",
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 12,
    padding: 10,
  },
  imagen: { width: 48, height: 48, borderRadius: 10 },
  textos: { flex: 1 },
  titulo: { fontSize: 14, fontWeight: "700", color: "#111827" },
  subtitulo: { fontSize: 12, color: "#6B7280", marginTop: 2 },
});
