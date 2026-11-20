import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Accion = { etiqueta: string; onPress: () => void };

type Props = {
  icono: keyof typeof Ionicons.glyphMap;
  titulo: string;
  texto: string;
  esError?: boolean;
  accion?: Accion;
  accionSecundaria?: Accion;
};

export default function MensajeArriendo({ icono, titulo, texto, esError = false, accion, accionSecundaria }: Props) {
  return (
    <View style={styles.contenedor}>
      <View style={styles.iconoFondo}>
        <Ionicons name={icono} size={36} color="#9CA3AF" />
      </View>
      <Text style={styles.titulo} accessibilityRole={esError ? "alert" : undefined}>{titulo}</Text>
      <Text style={styles.texto}>{texto}</Text>
      {accion ? (
        <Pressable style={styles.boton} onPress={accion.onPress} accessibilityRole="button">
          <Text style={styles.botonTexto}>{accion.etiqueta}</Text>
        </Pressable>
      ) : null}
      {accionSecundaria ? (
        <Pressable style={styles.botonSecundario} onPress={accionSecundaria.onPress} accessibilityRole="button">
          <Text style={styles.botonSecundarioTexto}>{accionSecundaria.etiqueta}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 32,
    gap: 10,
  },
  iconoFondo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  titulo: { fontSize: 16, fontWeight: "700", color: "#111827", textAlign: "center" },
  texto: { fontSize: 13, color: "#6B7280", textAlign: "center", lineHeight: 19 },
  boton: {
    backgroundColor: "#4F46E5",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 10,
  },
  botonTexto: { color: "#fff", fontWeight: "700", fontSize: 14 },
  botonSecundario: { paddingHorizontal: 24, paddingVertical: 10 },
  botonSecundarioTexto: { color: "#4F46E5", fontWeight: "600", fontSize: 14 },
});
