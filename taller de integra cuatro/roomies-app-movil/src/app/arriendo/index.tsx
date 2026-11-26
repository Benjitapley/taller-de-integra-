import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AccesoArriendo from "@/components/convivencia/AccesoArriendo";
import OrganizacionCasaCard from "@/components/OrganizacionCasaCard";
import NuevoRecordatorioSheet from "@/components/convivencia/NuevoRecordatorioSheet";
import ProximosRecordatorios from "@/components/convivencia/ProximosRecordatorios";
import ResumenArriendo from "@/components/convivencia/ResumenArriendo";
import {
  INFO_ARRIENDO_MOCK,
  INTEGRANTES_MOCK,
  ULTIMO_MENSAJE_ARRIENDO_MOCK,
} from "@/data/convivenciaMock";
import { useConvivenciaDemo } from "@/hooks/useConvivenciaDemo";
import { listarTareas, obtenerArriendoActual, type PaginaTareas } from "@/services/tareasService";
import type { NuevoRecordatorioInput } from "@/types/Convivencia";


function SinArriendo() {
  return (
    <View style={styles.sinArriendoContenedor}>
      <View style={styles.sinArriendoIconoFondo}>
        <Ionicons name="home-outline" size={36} color="#9CA3AF" />
      </View>
      <Text style={styles.sinArriendoTitulo}>Todavía no tienes un arriendo activo</Text>
      <Text style={styles.sinArriendoTexto}>
        Cuando te unas a un arriendo o encuentres compañeros de casa, vas a poder ver acá la
        convivencia, las tareas y el chat del grupo.
      </Text>
      <Pressable style={styles.sinArriendoBoton} onPress={() => router.dismissTo("/(tabs)/buscar")}>
        <Text style={styles.sinArriendoBotonTexto}>Ir a Buscar</Text>
      </Pressable>
    </View>
  );
}

export default function DashboardArriendo() {
  const [estado, setEstado] = useState<"cargando" | "sin_arriendo" | "listo" | "error">("cargando");
  const [idArriendo, setIdArriendo] = useState<number | null>(null);
  const [mensaje, setMensaje] = useState("");
  const cargar = useCallback(async () => {
    setEstado("cargando");
    const resultado = await obtenerArriendoActual();
    if (resultado.exito) { setIdArriendo(resultado.datos); setEstado("listo"); }
    else if (resultado.estadoHttp === 404) setEstado("sin_arriendo");
    else { setMensaje(resultado.error); setEstado("error"); }
  }, []);
  useFocusEffect(useCallback(() => { void cargar(); }, [cargar]));
  if (estado === "cargando") return <ActivityIndicator style={{ flex: 1 }} accessibilityLabel="Cargando arriendo" color="#4F46E5" />;
  if (estado === "sin_arriendo") return <SinArriendo />;
  if (estado === "error") return <View style={styles.sinArriendoContenedor}><Text>{mensaje}</Text>
    <Pressable accessibilityRole="button" onPress={() => void cargar()}><Text style={styles.sinArriendoBotonTexto}>Reintentar</Text></Pressable></View>;
  return idArriendo ? <AccesoArriendo><DashboardActivo idArriendo={idArriendo} /></AccesoArriendo> : null;
}

function DashboardActivo({ idArriendo }: { idArriendo: number }) {
  const { recordatorios, agregarRecordatorio } = useConvivenciaDemo();
  const [recordatorioVisible, setRecordatorioVisible] = useState(false);
  const [tareas, setTareas] = useState<PaginaTareas | null>(null);
  const [cargandoTareas, setCargandoTareas] = useState(true);
  const [errorTareas, setErrorTareas] = useState("");

  const cargarTareas = useCallback(async () => {
    setCargandoTareas(true); setErrorTareas("");
    const resultado = await listarTareas(idArriendo, "Pendiente");
    if (resultado.exito) setTareas(resultado.datos);
    else { setTareas(null); setErrorTareas(resultado.error); }
    setCargandoTareas(false);
  }, [idArriendo]);
  useFocusEffect(useCallback(() => { void cargarTareas(); }, [cargarTareas]));

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

      <OrganizacionCasaCard tareas={tareas?.items ?? []} idUsuarioActual={tareas?.id_usuario_actual ?? null}
        cargando={cargandoTareas} error={errorTareas}
        onVerTodo={() => router.push("/convivencia/tareas")} onReintentar={() => void cargarTareas()} />

      <ProximosRecordatorios
        recordatorios={recordatorios}
        onAgregar={() => setRecordatorioVisible(true)}
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
  pantalla: { flex: 1, backgroundColor: "#FAF9FE" },
  contenedor: { padding: 20, gap: 14 },
  tarjetaChat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8E2FA",
    padding: 14,
  },
  grupoAvatares: { flexDirection: "row" },
  avatarChat: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: "#fff" },
  tarjetaChatTitulo: { fontSize: 15, fontWeight: "700", color: "#25243D" },
  tarjetaChatSubtitulo: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  sinArriendoContenedor: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 32,
    gap: 10,
  },
  sinArriendoIconoFondo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  sinArriendoTitulo: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  sinArriendoTexto: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 19,
  },
  sinArriendoBoton: {
    backgroundColor: "#4F46E5",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 10,
  },
  sinArriendoBotonTexto: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});
