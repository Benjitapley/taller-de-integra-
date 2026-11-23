import { router, useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import AvisoChat from "@/components/chat/AvisoChat";
import ContenedorChat from "@/components/chat/ContenedorChat";
import { CustomButton } from "@/components/CustomButton";
import EncabezadoConvivencia from "@/components/EncabezadoConvivencia";
import { useAuth } from "@/hooks/useAuth";
import { useChatArriendo } from "@/hooks/useChatArriendo";


const TITULO_POR_DEFECTO = "Chat del arriendo";

function volver() {
  if (router.canGoBack()) router.back();
  else router.replace("/(tabs)/mensajes");
}

function PantallaEstado({ children }: { children: ReactNode }) {
  return (
    <View style={styles.raiz}>
      <EncabezadoConvivencia titulo={TITULO_POR_DEFECTO} subtitulo={null} />
      <View style={styles.centro}>{children}</View>
    </View>
  );
}

function ChatConectado({ idConversacion }: { idConversacion: string | null }) {
  const chat = useChatArriendo(idConversacion);
  const { estado } = chat;

  if (estado.fase === "resolviendo" || estado.fase === "cargando") {
    return (
      <PantallaEstado>
        <ActivityIndicator color="#4F46E5" />
        <Text style={styles.texto}>Cargando conversación...</Text>
      </PantallaEstado>
    );
  }

  if (estado.fase === "sin_conversacion") {
    return (
      <PantallaEstado>
        <Text style={styles.titulo}>Todavía no hay un chat de arriendo</Text>
        <Text style={styles.texto}>El chat aparece cuando perteneces a un arriendo activo.</Text>
        <CustomButton titulo="Volver" variante="contorno" onPress={volver} />
      </PantallaEstado>
    );
  }

  if (estado.fase === "error") {
    return (
      <PantallaEstado>
        <Text style={styles.titulo}>No pudimos cargar el chat</Text>
        <Text style={styles.texto}>{estado.error?.error ?? "Ocurrió un error inesperado."}</Text>
        <CustomButton titulo="Reintentar" onPress={chat.reintentarCarga} />
      </PantallaEstado>
    );
  }

  if (estado.fase === "sin_acceso") {
    return (
      <PantallaEstado>
        <Text style={styles.titulo}>Ya no tienes acceso a este chat</Text>
        <Text style={styles.texto}>Los mensajes de esta conversación ya no están disponibles para tu cuenta.</Text>
        <CustomButton titulo="Volver" variante="contorno" onPress={volver} />
      </PantallaEstado>
    );
  }

  return (
    <ContenedorChat
      encabezado={
        <EncabezadoConvivencia
          titulo={TITULO_POR_DEFECTO}
          subtitulo={null}
          onActualizar={chat.actualizar}
          actualizando={estado.actualizando}
        />
      }
      aviso={
        estado.errorActualizacion ? (
          <AvisoChat
            texto="No pudimos actualizar los mensajes."
            accion={{ titulo: "Reintentar", onPress: chat.actualizar }}
          />
        ) : undefined
      }
      mensajes={estado.mensajes}
      texto={chat.texto}
      onCambiarTexto={chat.cambiarTexto}
      onEnviar={chat.enviar}
      onReintentar={chat.reintentarEnvio}
      onDescartar={chat.descartarEnvio}
      historial={{
        hayMas: estado.cursorAnterior !== null,
        cargando: estado.cargandoAnteriores,
        hayError: estado.errorAnteriores !== null,
        onCargarMas: chat.cargarAnteriores,
      }}
      vacio={<Text style={styles.texto}>Aún no hay mensajes. Escribe el primero.</Text>}
      soloTexto
    />
  );
}

export default function ChatArriendo() {
  const { usuarioActual } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const idConversacion = typeof id === "string" && id.trim() !== "" ? id.trim() : null;
  const identidadId = usuarioActual?.identidad.id ?? "sin-sesion";

  return <ChatConectado key={`${identidadId}:${idConversacion ?? ""}`} idConversacion={idConversacion} />;
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: "#F9FAFB" },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  titulo: { fontSize: 16, fontWeight: "700", color: "#111827", textAlign: "center" },
  texto: { fontSize: 14, color: "#6B7280", textAlign: "center" },
});
