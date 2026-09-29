import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import OrganizacionCasaCard from "@/components/OrganizacionCasaCard";
import {
  INTEGRANTES_MOCK,
  MENSAJES_MOCK,
  TAREAS_MOCK,
  USUARIO_ACTUAL_MOCK,
} from "@/data/convivenciaMock";
import type { IntegranteConvivencia, MensajeConvivencia } from "@/types/Convivencia";

// ---------- Sub-componentes ----------

function EncabezadoConvivencia({ integrantes }: { integrantes: IntegranteConvivencia[] }) {
  return (
    <View style={styles.encabezado}>
      <View style={styles.avataresGrupo}>
        {integrantes.map((integrante, indice) => (
          <Image
            key={integrante.id}
            source={{ uri: integrante.fotoUrl }}
            style={[styles.avatarGrupo, { marginLeft: indice === 0 ? 0 : -10 }]}
          />
        ))}
      </View>
      <View style={styles.encabezadoTextos}>
        <View style={styles.filaNombreGrupo}>
          <Text style={styles.nombreGrupo}>Roomies</Text>
          <Ionicons name="home" size={16} color="#4F46E5" />
        </View>
        <Text style={styles.subtituloGrupo}>{integrantes.length} miembros • viviendo juntos</Text>
      </View>
      <View style={styles.encabezadoAcciones}>
        <Ionicons name="call-outline" size={20} color="#4F46E5" />
        <Ionicons name="ellipsis-vertical" size={20} color="#4F46E5" />
      </View>
    </View>
  );
}

function NuestroLugar() {
  return (
    <View style={styles.nuestroLugar}>
      <Ionicons name="pin-outline" size={16} color="#4F46E5" />
      <View style={{ flex: 1 }}>
        <Text style={styles.nuestroLugarTitulo}>Nuestro lugar</Text>
        <Text style={styles.nuestroLugarTexto}>Providencia, Santiago • Departamento 4D/2B</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
    </View>
  );
}

function Mensaje({ mensaje }: { mensaje: MensajeConvivencia }) {
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

function horaActualTexto(): string {
  const ahora = new Date();
  const horas = String(ahora.getHours()).padStart(2, "0");
  const minutos = String(ahora.getMinutes()).padStart(2, "0");
  return `${horas}:${minutos}`;
}

// ---------- Pantalla ----------

export default function Mensajes() {
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
    // socket detrás todavía — eso es MOB-10 / APIM-01 más adelante.
  }

  return (
    <View style={styles.pantalla}>
      <EncabezadoConvivencia integrantes={INTEGRANTES_MOCK} />
      <NuestroLugar />

      <ScrollView contentContainerStyle={styles.contenedorScroll}>
        <Text style={styles.divisorFecha}>Hoy</Text>

        {mensajes.map((mensaje) => (
          <Mensaje key={mensaje.id} mensaje={mensaje} />
        ))}

        <OrganizacionCasaCard tareas={TAREAS_MOCK} onVerTodo={() => router.push("/convivencia/tareas")} />
      </ScrollView>

      <View style={styles.barraEscribir}>
        <Ionicons name="add-circle" size={28} color="#4F46E5" />
        <TextInput
          value={texto}
          onChangeText={setTexto}
          placeholder="Escribe un mensaje..."
          placeholderTextColor="#9CA3AF"
          style={styles.inputEscribir}
          onSubmitEditing={enviarMensaje}
          returnKeyType="send"
        />
        <Ionicons name="happy-outline" size={22} color="#9CA3AF" />
        <Pressable style={styles.botonEnviar} onPress={enviarMensaje}>
          <Ionicons name="send" size={16} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#F9FAFB" },
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  avataresGrupo: { flexDirection: "row" },
  avatarGrupo: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: "#fff" },
  encabezadoTextos: { flex: 1 },
  filaNombreGrupo: { flexDirection: "row", alignItems: "center", gap: 4 },
  nombreGrupo: { fontSize: 16, fontWeight: "700", color: "#111827" },
  subtituloGrupo: { fontSize: 12, color: "#059669" },
  encabezadoAcciones: { flexDirection: "row", gap: 14 },
  nuestroLugar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F5F3FF",
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 12,
    padding: 12,
  },
  nuestroLugarTitulo: { fontSize: 13, fontWeight: "700", color: "#111827" },
  nuestroLugarTexto: { fontSize: 12, color: "#6B7280" },
  contenedorScroll: { padding: 16, gap: 10 },
  divisorFecha: {
    alignSelf: "center",
    fontSize: 12,
    color: "#9CA3AF",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 6,
  },
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
  barraEscribir: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  inputEscribir: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: "#111827",
  },
  botonEnviar: {
    backgroundColor: "#4F46E5",
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
