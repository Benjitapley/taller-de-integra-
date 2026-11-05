import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import ContenedorChat from "@/components/chat/ContenedorChat";
import EncabezadoContextual from "@/components/chat/EncabezadoContextual";
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
  }

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: chat.nombreOtraPersona, headerTintColor: "#4F46E5" }}
      />
      <ContenedorChat
        encabezado={<EncabezadoContextual publicacion={chat.publicacion} />}
        mensajes={mensajes}
        texto={texto}
        onCambiarTexto={setTexto}
        onEnviar={enviarMensaje}
      />
    </>
  );
}

const styles = StyleSheet.create({
  estadoVacio: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F9FAFB",
  },
  estadoVacioTexto: { fontSize: 14, color: "#6B7280", textAlign: "center" },
});
