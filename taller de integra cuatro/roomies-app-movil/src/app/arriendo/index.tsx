import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import CompositorMensaje from "@/components/chat/CompositorMensaje";
import ListaMensajes from "@/components/chat/ListaMensajes";
import EncabezadoConvivencia from "@/components/EncabezadoConvivencia";
import NuestroLugar from "@/components/NuestroLugar";
import OrganizacionCasaCard from "@/components/OrganizacionCasaCard";
import {
  INTEGRANTES_MOCK,
  MENSAJES_MOCK,
  TAREAS_MOCK,
  USUARIO_ACTUAL_MOCK,
} from "@/data/convivenciaMock";
import type { MensajeConvivencia } from "@/types/Convivencia";

function horaActualTexto(): string {
  const ahora = new Date();
  const horas = String(ahora.getHours()).padStart(2, "0");
  const minutos = String(ahora.getMinutes()).padStart(2, "0");
  return `${horas}:${minutos}`;
}

export default function DashboardArriendo() {
  const [mensajes, setMensajes] = useState<MensajeConvivencia[]>(MENSAJES_MOCK);
  const [texto, setTexto] = useState("");

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
    // Nota: esto solo actualiza la lista en memoria. No hay backend ni
    // socket detrás todavía — eso es la integración de Convivencia en
    // Sprint 3 (ver M4-D11).
  }

  return (
    <View style={styles.pantalla}>
      <EncabezadoConvivencia integrantes={INTEGRANTES_MOCK} />
      <NuestroLugar />

      <ScrollView contentContainerStyle={styles.contenedorScroll}>
        <ListaMensajes mensajes={mensajes} />
        <OrganizacionCasaCard tareas={TAREAS_MOCK} onVerTodo={() => router.push("/convivencia/tareas")} />
      </ScrollView>

      <CompositorMensaje valor={texto} onCambiarValor={setTexto} onEnviar={enviarMensaje} />
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#F9FAFB" },
  contenedorScroll: { padding: 16, gap: 10 },
});
