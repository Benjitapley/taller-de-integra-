import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MensajeArriendo from "@/components/convivencia/MensajeArriendo";
import NuevaTareaSheet from "@/components/convivencia/NuevaTareaSheet";
import NuevoRecordatorioSheet from "@/components/convivencia/NuevoRecordatorioSheet";
import ProximosRecordatorios from "@/components/convivencia/ProximosRecordatorios";
import ResumenArriendo from "@/components/convivencia/ResumenArriendo";
import OrganizacionCasaCard from "@/components/OrganizacionCasaCard";
import {
  INFO_ARRIENDO_MOCK,
  INTEGRANTES_MOCK,
  ULTIMO_MENSAJE_ARRIENDO_MOCK,
  USUARIO_TIENE_ARRIENDO_MOCK,
} from "@/data/convivenciaMock";
import { useConvivenciaDemo } from "@/hooks/useConvivenciaDemo";
import type { NuevaTareaInput, NuevoRecordatorioInput } from "@/types/Convivencia";

export default function DashboardArriendoDemo() {
  if (!USUARIO_TIENE_ARRIENDO_MOCK) {
    return (
      <MensajeArriendo
        icono="home-outline"
        titulo="Todavía no tienes un arriendo activo"
        texto="Cuando te unas a un arriendo o encuentres compañeros de casa, vas a poder ver acá la convivencia, las tareas y el chat del grupo."
        accion={{ etiqueta: "Ir a Buscar", onPress: () => router.dismissTo("/(tabs)/buscar") }}
      />
    );
  }

  return <DashboardActivo />;
}

function DashboardActivo() {
  const { tareas, recordatorios, agregarTarea, agregarRecordatorio } = useConvivenciaDemo();
  const [formularioVisible, setFormularioVisible] = useState(false);
  const [recordatorioVisible, setRecordatorioVisible] = useState(false);

  function crearTarea(nueva: NuevaTareaInput) {
    agregarTarea(nueva);
    setFormularioVisible(false);
  }

  function crearRecordatorio(nuevo: NuevoRecordatorioInput) {
    agregarRecordatorio(nuevo);
    setRecordatorioVisible(false);
  }

  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={styles.contenedor}>
      <ResumenArriendo info={INFO_ARRIENDO_MOCK} cantidadIntegrantes={INTEGRANTES_MOCK.length} />

      <Pressable style={styles.tarjetaChat} onPress={() => router.push("/arriendo/chat")}>
        <View style={styles.grupoAvatares}>
          {INTEGRANTES_MOCK.map((integrante, indice) => (
            <Image
              key={integrante.id}
              source={{ uri: integrante.fotoUrl }}
              style={[styles.avatarChat, { marginLeft: indice === 0 ? 0 : -10 }]}
            />
          ))}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.tarjetaChatTitulo}>Chat del arriendo</Text>
          <Text style={styles.tarjetaChatSubtitulo} numberOfLines={1}>
            Roomies · &quot;{ULTIMO_MENSAJE_ARRIENDO_MOCK.texto}&quot;
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#4F46E5" />
      </Pressable>

      <OrganizacionCasaCard
        tareas={tareas}
        onVerTodo={() => router.push("/convivencia/tareas")}
        onAgregar={() => setFormularioVisible(true)}
      />

      <ProximosRecordatorios
        recordatorios={recordatorios}
        onAgregar={() => setRecordatorioVisible(true)}
      />

      <NuevaTareaSheet
        visible={formularioVisible}
        integrantes={INTEGRANTES_MOCK}
        onCancelar={() => setFormularioVisible(false)}
        onCrear={crearTarea}
      />

      <NuevoRecordatorioSheet
        visible={recordatorioVisible}
        onCancelar={() => setRecordatorioVisible(false)}
        onGuardar={crearRecordatorio}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#F9FAFB" },
  contenedor: { padding: 16, gap: 14 },
  tarjetaChat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
  },
  grupoAvatares: { flexDirection: "row" },
  avatarChat: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: "#fff" },
  tarjetaChatTitulo: { fontSize: 14, fontWeight: "700", color: "#111827" },
  tarjetaChatSubtitulo: { fontSize: 12, color: "#6B7280", marginTop: 2 },
});
