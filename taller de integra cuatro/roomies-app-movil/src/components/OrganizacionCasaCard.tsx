import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { TareaConvivencia } from "@/types/Convivencia";

// Este es el componente que implementa MOB-11:
// "Visualización inicial de tareas de convivencia utilizando datos simulados".
// Se muestra en fila horizontal deslizable (en vez de una fila fija de 4
// columnas como en el mockup) para que las tarjetas no queden apretadas en
// un celular angosto — mismo contenido, ajuste de responsividad.

type Props = {
  tareas: TareaConvivencia[];
  onVerTodo?: () => void;
};

export default function OrganizacionCasaCard({ tareas, onVerTodo }: Props) {
  return (
    <View style={styles.tarjeta}>
      <View style={styles.encabezado}>
        <View style={styles.filaTitulo}>
          <Ionicons name="clipboard-outline" size={16} color="#4F46E5" />
          <Text style={styles.titulo}>Organización de la casa</Text>
        </View>
        {onVerTodo && (
          <Pressable onPress={onVerTodo} hitSlop={8}>
            <Text style={styles.verTodo}>Ver todo ›</Text>
          </Pressable>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fila}>
        {tareas.map((tarea) => (
          <TareaItem key={tarea.id} tarea={tarea} />
        ))}
      </ScrollView>
    </View>
  );
}

function TareaItem({ tarea }: { tarea: TareaConvivencia }) {
  return (
    <View style={styles.item}>
      <View style={styles.filaCategoria}>
        <Ionicons name={tarea.icono as never} size={14} color="#4F46E5" />
        <Text style={styles.categoria}>{tarea.categoria}</Text>
      </View>

      {tarea.frecuenciaTexto ? <Text style={styles.frecuencia}>{tarea.frecuenciaTexto}</Text> : null}

      <View style={styles.badgeDia}>
        <Text style={styles.badgeDiaTexto}>{tarea.diaTexto}</Text>
      </View>

      <Image source={{ uri: tarea.responsable.fotoUrl }} style={styles.avatar} />
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    gap: 12,
  },
  encabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  filaTitulo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  titulo: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  verTodo: {
    fontSize: 12,
    color: "#4F46E5",
    fontWeight: "600",
  },
  fila: {
    flexDirection: "row",
    gap: 10,
  },
  item: {
    width: 110,
    backgroundColor: "#F5F3FF",
    borderRadius: 12,
    padding: 10,
    alignItems: "flex-start",
    gap: 6,
  },
  filaCategoria: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  categoria: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  frecuencia: {
    fontSize: 11,
    color: "#6B7280",
  },
  badgeDia: {
    backgroundColor: "#EEF2FF",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeDiaTexto: {
    fontSize: 11,
    color: "#4F46E5",
    fontWeight: "600",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginTop: 2,
  },
});
