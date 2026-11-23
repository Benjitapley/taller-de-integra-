import { Pressable, StyleSheet, Text, View } from "react-native";

// M4S3-D02: franja de aviso sobre la lista de mensajes (por ejemplo, fallo al actualizar).

type Props = {
  texto: string;
  accion?: { titulo: string; onPress: () => void };
};

export default function AvisoChat({ texto, accion }: Props) {
  return (
    <View style={styles.franja} accessibilityRole="alert">
      <Text style={styles.texto}>{texto}</Text>
      {accion && (
        <Pressable onPress={accion.onPress} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.accion}>{accion.titulo}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  franja: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  texto: { flex: 1, fontSize: 12, color: "#92400E" },
  accion: { fontSize: 12, fontWeight: "700", color: "#4F46E5" },
});
