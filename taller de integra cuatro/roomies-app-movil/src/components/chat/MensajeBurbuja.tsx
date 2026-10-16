import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, Text, View } from "react-native";
import type { MensajeConvivencia } from "@/types/Convivencia";


type Props = {
  mensaje: MensajeConvivencia;
};

export default function MensajeBurbuja({ mensaje }: Props) {
  return (
    <View style={[styles.filaMensaje, mensaje.esPropio && styles.filaMensajePropio]}>
      {!mensaje.esPropio && <Image source={{ uri: mensaje.autorFotoUrl }} style={styles.avatarMensaje} />}
      <View style={{ maxWidth: "78%" }}>
        {!mensaje.esPropio && <Text style={styles.autorMensaje}>{mensaje.autorNombre}</Text>}
        <View style={[styles.burbuja, mensaje.esPropio ? styles.burbujaPropia : styles.burbujaAjena]}>
          <Text style={styles.textoMensaje}>{mensaje.texto}</Text>
          <View style={styles.filaHora}>
            <Text style={styles.horaMensaje}>{mensaje.hora}</Text>
            {mensaje.esPropio && <Ionicons name="checkmark-done" size={14} color="#4F46E5" />}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  filaMensaje: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 10 },
  filaMensajePropio: { flexDirection: "row-reverse" },
  avatarMensaje: { width: 28, height: 28, borderRadius: 14 },
  autorMensaje: { fontSize: 11, color: "#6B7280", marginBottom: 2, marginLeft: 4 },
  burbuja: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  burbujaAjena: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB", borderBottomLeftRadius: 4 },
  burbujaPropia: { backgroundColor: "#EEF2FF", borderBottomRightRadius: 4 },
  textoMensaje: { fontSize: 14, color: "#111827" },
  filaHora: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end", marginTop: 2 },
  horaMensaje: { fontSize: 10, color: "#9CA3AF" },
});
