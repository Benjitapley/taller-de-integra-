import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import type { ArriendoVista } from "@/types/Arriendo";


type Props = { arriendo: ArriendoVista };

function plural(cantidad: number, singular: string, plural: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : plural}`;
}

export function textoOcupacion(arriendo: ArriendoVista): string {
  const integrantes = plural(arriendo.integrantesActivos, "integrante", "integrantes");
  if (arriendo.cuposDisponibles === null) {
    return `${integrantes} · ${plural(arriendo.cuposTotales, "cupo en total", "cupos en total")}`;
  }
  return `${integrantes} · ${plural(arriendo.cuposDisponibles, "cupo disponible", "cupos disponibles")}`;
}

export default function ResumenMiArriendo({ arriendo }: Props) {
  return (
    <View style={styles.tarjeta}>
      <Ionicons name="home" size={18} color="#4F46E5" />
      <View style={styles.textos}>
        <Text style={styles.titulo}>Nuestro lugar</Text>
        {/* Si no se pudo obtener el título de la publicación se usa un rótulo genérico, no uno inventado. */}
        <Text style={styles.nombre} numberOfLines={2}>{arriendo.titulo ?? "Tu arriendo"}</Text>
        {arriendo.ubicacion ? <Text style={styles.texto}>{arriendo.ubicacion}</Text> : null}
        <Text style={styles.texto}>{textoOcupacion(arriendo)}</Text>
        {arriendo.soyResponsable === true ? <Text style={styles.texto}>Eres el responsable de este arriendo</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#F5F3FF",
    borderRadius: 12,
    padding: 14,
  },
  textos: { flex: 1 },
  titulo: { fontSize: 13, fontWeight: "700", color: "#111827" },
  nombre: { fontSize: 14, fontWeight: "600", color: "#111827", marginTop: 2 },
  texto: { fontSize: 12, color: "#6B7280", marginTop: 2 },
});
