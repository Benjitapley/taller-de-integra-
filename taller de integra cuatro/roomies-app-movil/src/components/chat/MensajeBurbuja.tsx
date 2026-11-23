import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { MensajeConvivencia } from "@/types/Convivencia";


type Props = {
  mensaje: MensajeConvivencia;
  onReintentar?: (clave: string) => void;
  onDescartar?: (clave: string) => void;
};

export default function MensajeBurbuja({ mensaje, onReintentar, onDescartar }: Props) {
  const pendiente = mensaje.estado === "pendiente";
  const conError = mensaje.estado === "error";
  const inicial = mensaje.autorNombre.trim().charAt(0).toUpperCase() || "?";

  return (
    <View style={[styles.filaMensaje, mensaje.esPropio && styles.filaMensajePropio]}>
      {!mensaje.esPropio &&
        (mensaje.autorFotoUrl ? (
          <Image source={{ uri: mensaje.autorFotoUrl }} style={styles.avatarMensaje} />
        ) : (
          <View style={[styles.avatarMensaje, styles.avatarInicial]}>
            <Text style={styles.avatarInicialTexto}>{inicial}</Text>
          </View>
        ))}
      <View style={styles.columna}>
        {!mensaje.esPropio && <Text style={styles.autorMensaje}>{mensaje.autorNombre}</Text>}
        <View
          style={[
            styles.burbuja,
            mensaje.esPropio ? styles.burbujaPropia : styles.burbujaAjena,
            pendiente && styles.burbujaPendiente,
            conError && styles.burbujaError,
          ]}
        >
          <Text style={styles.textoMensaje}>{mensaje.texto}</Text>
          <View style={styles.filaHora}>
            <Text style={styles.horaMensaje}>{mensaje.hora}</Text>
            {pendiente ? (
              <Ionicons name="time-outline" size={14} color="#9CA3AF" accessibilityLabel="Enviando" />
            ) : conError ? (
              <Ionicons name="alert-circle" size={14} color="#DC2626" accessibilityLabel="No se envió" />
            ) : mensaje.esPropio ? (
              <Ionicons name="checkmark" size={14} color="#4F46E5" accessibilityLabel="Enviado" />
            ) : null}
          </View>
        </View>
        {conError && (
          <View style={styles.filaError}>
            <Text style={styles.textoError}>No se envió</Text>
            {onReintentar && (
              <Pressable
                onPress={() => onReintentar(mensaje.id)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Reintentar el envío del mensaje"
              >
                <Text style={styles.accionError}>Reintentar</Text>
              </Pressable>
            )}
            {onDescartar && (
              <Pressable
                onPress={() => onDescartar(mensaje.id)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Descartar el mensaje que no se envio"
              >
                <Text style={styles.accionDescartar}>Descartar</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  filaMensaje: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 10 },
  filaMensajePropio: { flexDirection: "row-reverse" },
  columna: { maxWidth: "78%" },
  avatarMensaje: { width: 28, height: 28, borderRadius: 14 },
  avatarInicial: { backgroundColor: "#C7D2FE", alignItems: "center", justifyContent: "center" },
  avatarInicialTexto: { fontSize: 12, fontWeight: "700", color: "#3730A3" },
  autorMensaje: { fontSize: 11, color: "#6B7280", marginBottom: 2, marginLeft: 4 },
  burbuja: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  burbujaAjena: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB", borderBottomLeftRadius: 4 },
  burbujaPropia: { backgroundColor: "#EEF2FF", borderBottomRightRadius: 4 },
  burbujaPendiente: { opacity: 0.7 },
  burbujaError: { backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FCA5A5" },
  textoMensaje: { fontSize: 14, color: "#111827" },
  filaHora: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end", marginTop: 2 },
  horaMensaje: { fontSize: 10, color: "#9CA3AF" },
  filaError: { flexDirection: "row", alignItems: "center", gap: 12, alignSelf: "flex-end", marginTop: 4 },
  textoError: { fontSize: 11, color: "#DC2626" },
  accionError: { fontSize: 12, fontWeight: "700", color: "#4F46E5" },
  accionDescartar: { fontSize: 12, fontWeight: "600", color: "#6B7280" },
});
