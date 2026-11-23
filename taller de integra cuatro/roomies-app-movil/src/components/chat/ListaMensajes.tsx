import { useMemo, type RefObject } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import MensajeBurbuja from "@/components/chat/MensajeBurbuja";
import type { MensajeConvivencia } from "@/types/Convivencia";
import { claveDia, etiquetaDia } from "@/utils/chatFechas";


export type HistorialChat = {
  hayMas: boolean;
  cargando: boolean;
  hayError: boolean;
  onCargarMas: () => void;
};

type Props = {
  /** Orden cronologico ascendente (el mas antiguo primero). */
  mensajes: MensajeConvivencia[];
  onReintentar?: (clave: string) => void;
  onDescartar?: (clave: string) => void;
  /** Sin este valor la lista se comporta como el chat demo: sin paginacion. */
  historial?: HistorialChat;
  listaRef?: RefObject<FlatList<MensajeConvivencia> | null>;
};

function PieHistorial({ historial, hayMensajes }: { historial?: HistorialChat; hayMensajes: boolean }) {
  // Chat demo: solo el rotulo "Hoy" de siempre.
  if (!historial) return <Text style={styles.divisorFecha}>Hoy</Text>;

  if (historial.cargando) {
    return (
      <View style={styles.pie} accessibilityLiveRegion="polite">
        <ActivityIndicator color="#4F46E5" />
      </View>
    );
  }
  if (historial.hayError) {
    return (
      <View style={styles.pie}>
        <Text style={styles.textoPie}>No pudimos cargar los mensajes anteriores.</Text>
        <Pressable onPress={historial.onCargarMas} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.accionPie}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }
  if (historial.hayMas) {
    return (
      <View style={styles.pie}>
        <Pressable onPress={historial.onCargarMas} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.accionPie}>Cargar mensajes anteriores</Text>
        </Pressable>
      </View>
    );
  }
  return hayMensajes ? (
    <View style={styles.pie}>
      <Text style={styles.textoPie}>Inicio de la conversación</Text>
    </View>
  ) : null;
}

export default function ListaMensajes({ mensajes, onReintentar, onDescartar, historial, listaRef }: Props) {
  const datos = useMemo(() => [...mensajes].reverse(), [mensajes]);

  function alLlegarAlFinal() {
    // Con error no se reintenta solo: evita un ciclo de pedidos fallidos al estar al final.
    if (historial && historial.hayMas && !historial.cargando && !historial.hayError) historial.onCargarMas();
  }

  return (
    <FlatList
      ref={listaRef}
      data={datos}
      inverted
      keyExtractor={(mensaje) => mensaje.id}
      renderItem={({ item, index }) => {
        // El vecino mas antiguo esta en index + 1: si cambia el dia, se pone el rotulo arriba.
        const anterior = datos[index + 1];
        const dia = item.fechaIso ? claveDia(item.fechaIso) : "";
        const diaAnterior = anterior?.fechaIso ? claveDia(anterior.fechaIso) : null;
        const mostrarDia = historial !== undefined && dia !== "" && (anterior === undefined || dia !== diaAnterior);
        return (
          <View>
            {mostrarDia && item.fechaIso ? <Text style={styles.divisorFecha}>{etiquetaDia(item.fechaIso)}</Text> : null}
            <MensajeBurbuja mensaje={item} onReintentar={onReintentar} onDescartar={onDescartar} />
          </View>
        );
      }}
      ListFooterComponent={<PieHistorial historial={historial} hayMensajes={datos.length > 0} />}
      onEndReached={alLlegarAlFinal}
      onEndReachedThreshold={0.3}
      contentContainerStyle={styles.contenido}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      style={styles.lista}
    />
  );
}

const styles = StyleSheet.create({
  lista: { flex: 1 },
  contenido: { padding: 16 },
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
  pie: { alignItems: "center", gap: 6, paddingVertical: 8 },
  textoPie: { fontSize: 12, color: "#9CA3AF", textAlign: "center" },
  accionPie: { fontSize: 13, fontWeight: "700", color: "#4F46E5" },
});
