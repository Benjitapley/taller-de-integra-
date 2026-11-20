import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AvatarIntegrante from "@/components/convivencia/AvatarIntegrante";
import ListaIntegrantes from "@/components/convivencia/ListaIntegrantes";
import MensajeArriendo from "@/components/convivencia/MensajeArriendo";
import ResumenMiArriendo from "@/components/convivencia/ResumenMiArriendo";
import { CHAT_ARRIENDO_REAL, TAREAS_ARRIENDO_REAL } from "@/constants/funcionesArriendo";
import { useMiArriendo } from "@/hooks/useMiArriendo";
import type { EstadoMiArriendo, IntegranteArriendoVista } from "@/types/Arriendo";



type Funciones = { chat: boolean; tareas: boolean };

type PropsPantalla = {
  estado: EstadoMiArriendo;
  onReintentar: () => void;
  funciones?: Funciones;
};

const MAX_AVATARES_CHAT = 4;

function irABuscar() {
  router.dismissTo("/(tabs)/buscar");
}

function verPostulaciones() {
  router.push("/postulaciones");
}

function Cargando() {
  return (
    <View style={styles.cargando} accessibilityLiveRegion="polite">
      <ActivityIndicator size="large" color="#4F46E5" />
      <Text style={styles.cargandoTexto}>Cargando tu arriendo…</Text>
    </View>
  );
}

function AvisoActualizacion({ onReintentar }: { onReintentar: () => void }) {
  return (
    <View style={styles.aviso} accessibilityRole="alert">
      <Text style={styles.avisoTexto}>No pudimos actualizar. Mostramos la última información disponible.</Text>
      <Pressable onPress={onReintentar} hitSlop={8} accessibilityRole="button">
        <Text style={styles.avisoAccion}>Reintentar</Text>
      </Pressable>
    </View>
  );
}

function TarjetaChat({ integrantes, habilitada }: { integrantes: IntegranteArriendoVista[] | null; habilitada: boolean }) {
  const visibles = (integrantes ?? []).slice(0, MAX_AVATARES_CHAT);
  return (
    <Pressable
      style={[styles.tarjetaEntrada, !habilitada && styles.tarjetaDeshabilitada]}
      disabled={!habilitada}
      onPress={() => router.push("/arriendo/chat")}
      accessibilityRole="button"
      accessibilityState={{ disabled: !habilitada }}
    >
      <View style={styles.grupoAvatares}>
        {visibles.map((integrante, indice) => (
          <View key={integrante.idUsuario} style={{ marginLeft: indice === 0 ? 0 : -10 }}>
            <AvatarIntegrante nombre={integrante.nombre} fotoUrl={integrante.fotoUrl} tamano={30} conBorde />
          </View>
        ))}
      </View>
      <View style={styles.entradaTextos}>
        <Text style={styles.entradaTitulo}>Chat del arriendo</Text>
        <Text style={styles.entradaSubtitulo} numberOfLines={1}>
          {habilitada ? "Conversa con quienes viven contigo" : "Disponible próximamente"}
        </Text>
      </View>
      {habilitada ? <Ionicons name="chevron-forward" size={20} color="#4F46E5" /> : null}
    </Pressable>
  );
}

function TarjetaTareas({ habilitada }: { habilitada: boolean }) {
  return (
    <Pressable
      style={[styles.tarjetaEntrada, !habilitada && styles.tarjetaDeshabilitada]}
      disabled={!habilitada}
      onPress={() => router.push("/convivencia/tareas")}
      accessibilityRole="button"
      accessibilityState={{ disabled: !habilitada }}
    >
      <View style={styles.iconoEntrada}>
        <Ionicons name="clipboard-outline" size={18} color="#4F46E5" />
      </View>
      <View style={styles.entradaTextos}>
        <Text style={styles.entradaTitulo}>Organización de la casa</Text>
        <Text style={styles.entradaSubtitulo} numberOfLines={1}>
          {habilitada ? "Tareas de la casa y quién las hace" : "Disponible próximamente"}
        </Text>
      </View>
      {habilitada ? <Ionicons name="chevron-forward" size={20} color="#4F46E5" /> : null}
    </Pressable>
  );
}

export function PantallaMiArriendo({ estado, onReintentar, funciones }: PropsPantalla) {
  const habilitadas: Funciones = funciones ?? { chat: CHAT_ARRIENDO_REAL, tareas: TAREAS_ARRIENDO_REAL };

  switch (estado.tipo) {
    case "cargando":
      return <Cargando />;

    case "sin_pertenencia":
      return (
        <MensajeArriendo
          icono="home-outline"
          titulo="Todavía no tienes un arriendo activo"
          texto="Cuando un arrendador acepte tu postulación, verás aquí tu arriendo, a quienes viven contigo y las herramientas de convivencia."
          accion={{ etiqueta: "Ir a Buscar", onPress: irABuscar }}
          accionSecundaria={{ etiqueta: "Ver mis postulaciones", onPress: verPostulaciones }}
        />
      );

    case "sin_permiso":
      return (
        <MensajeArriendo
          icono="lock-closed-outline"
          titulo="No tienes acceso a este arriendo"
          texto="Tu cuenta no tiene permiso para ver esta información. Si aún no confirmaste tu correo, confírmalo e inténtalo otra vez."
          esError
          accion={{ etiqueta: "Reintentar", onPress: onReintentar }}
        />
      );

    case "error":
      return (
        <MensajeArriendo
          icono="cloud-offline-outline"
          titulo="No pudimos cargar tu arriendo"
          texto={estado.error.error}
          esError
          accion={{ etiqueta: "Reintentar", onPress: onReintentar }}
        />
      );

    case "datos":
      return (
        <ScrollView style={styles.pantalla} contentContainerStyle={styles.contenedor}>
          {estado.errorActualizacion ? <AvisoActualizacion onReintentar={onReintentar} /> : null}
          <ResumenMiArriendo arriendo={estado.arriendo} />
          <TarjetaChat integrantes={estado.integrantes} habilitada={habilitadas.chat} />
          <ListaIntegrantes
            integrantes={estado.integrantes}
            integrantesActivos={estado.arriendo.integrantesActivos}
            cuposTotales={estado.arriendo.cuposTotales}
            parcial={estado.integrantesParciales}
          />
          <TarjetaTareas habilitada={habilitadas.tareas} />
        </ScrollView>
      );
  }
}

export default function MiArriendo() {
  const { estado, reintentar } = useMiArriendo();
  return <PantallaMiArriendo estado={estado} onReintentar={reintentar} />;
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#F9FAFB" },
  contenedor: { padding: 16, gap: 14 },
  cargando: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F9FAFB", gap: 12 },
  cargandoTexto: { fontSize: 14, color: "#6B7280" },
  aviso: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 12,
  },
  avisoTexto: { flex: 1, fontSize: 12, color: "#92400E", lineHeight: 17 },
  avisoAccion: { fontSize: 13, fontWeight: "700", color: "#4F46E5" },
  tarjetaEntrada: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
  },
  tarjetaDeshabilitada: { opacity: 0.6 },
  grupoAvatares: { flexDirection: "row" },
  iconoEntrada: { backgroundColor: "#EEF2FF", borderRadius: 10, padding: 8 },
  entradaTextos: { flex: 1 },
  entradaTitulo: { fontSize: 14, fontWeight: "700", color: "#111827" },
  entradaSubtitulo: { fontSize: 12, color: "#6B7280", marginTop: 2 },
});
