import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import CompositorMensaje from "@/components/chat/CompositorMensaje";
import EncabezadoContextual from "@/components/chat/EncabezadoContextual";
import ListaMensajes from "@/components/chat/ListaMensajes";
import { CHATS_EXPLORATORIOS_MOCK } from "@/data/chatsMock";
import { USUARIO_ACTUAL_MOCK } from "@/data/convivenciaMock";
import type { MensajeConvivencia } from "@/types/Convivencia";

function horaActualTexto(): string {
  const ahora = new Date();
  const horas = String(ahora.getHours()).padStart(2, "0");
  const minutos = String(ahora.getMinutes()).padStart(2, "0");
  return `${horas}:${minutos}`;
}

export default function ChatContextual() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chat = CHATS_EXPLORATORIOS_MOCK.find((c) => c.id === id);

  const [mensajes, setMensajes] = useState<MensajeConvivencia[]>(chat?.mensajes ?? []);
  const [texto, setTexto] = useState("");

  if (!chat) {
    return (
      <View style={styles.estadoVacio}>
        <Stack.Screen options={{ headerShown: true, title: "Chat" }} />
        <Text style={styles.estadoVacioTexto}>No se encontró esta conversación.</Text>
      </View>
    );
  }

  if (chat.estado !== "preseleccionada") {
    return (
      <View style={styles.estadoVacio}>
        <Stack.Screen
          options={{ headerShown: true, title: chat.nombreOtraPersona, headerTintColor: "#4F46E5" }}
        />
        <Text style={styles.estadoVacioTexto}>
          Esta conversación se habilita cuando tu postulación quede preseleccionada.
        </Text>
      </View>
    );
  }

  function enviarMensaje() {
    const contenido = texto.trim();
    if (contenido === "") return;

    setMensajes((actuales) => [
      ...actuales,
      {
        id: `local-${Date.now()}`,
        autorNombre: USUARIO_ACTUAL_MOCK.nombre,
        autorFotoUrl: USUARIO_ACTUAL_MOCK.fotoUrl,
        texto: contenido,
        hora: horaActualTexto(),
        esPropio: true,
      },
    ]);
    setTexto("");
    // Solo en memoria: no hay persistencia ni backend de Mensajería todavía
    // (contrato pendiente para Sprint 3, ver M4-D11).
  }

  return (
    <View style={styles.pantalla}>
      <Stack.Screen
        options={{ headerShown: true, title: chat.nombreOtraPersona, headerTintColor: "#4F46E5" }}
      />
      <EncabezadoContextual publicacion={chat.publicacion} />

      <ScrollView contentContainerStyle={styles.contenedorScroll}>
        <ListaMensajes mensajes={mensajes} />
      </ScrollView>

      <CompositorMensaje valor={texto} onCambiarValor={setTexto} onEnviar={enviarMensaje} />
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#F9FAFB" },
  contenedorScroll: { padding: 16, gap: 10 },
  estadoVacio: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F9FAFB",
  },
  estadoVacioTexto: { fontSize: 14, color: "#6B7280", textAlign: "center" },
});
