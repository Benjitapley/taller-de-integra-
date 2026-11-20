import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { paletaPublicacion } from "@/constants/origenPublicacion";
import { colors } from "@/theme/colors";

type NombreIcono = keyof typeof Ionicons.glyphMap;

export interface OpcionDesplegable {
  id: number;
  nombre: string;
}

interface SelectorDesplegableProps {
  etiqueta: string;
  icono: NombreIcono;
  placeholder: string;
  opciones: readonly OpcionDesplegable[];
  /** Id elegido, o "" si no hay. */
  valor: string;
  onCambiar: (opcion: OpcionDesplegable) => void;
  cargando?: boolean;
  /** Error de carga del catálogo (con reintento) o de validación. */
  error?: string;
  onReintentar?: () => void;
  deshabilitado?: boolean;
}

// Lista desplegable en pantalla completa (las regiones y comunas son muchas para
// chips). Mismo encabezado y estilo de error que CustomInput.
export const SelectorDesplegable: React.FC<SelectorDesplegableProps> = ({
  etiqueta,
  icono,
  placeholder,
  opciones,
  valor,
  onCambiar,
  cargando = false,
  error,
  onReintentar,
  deshabilitado = false,
}) => {
  const [abierto, setAbierto] = useState(false);
  const elegida = opciones.find((o) => String(o.id) === valor);
  const bloqueado = deshabilitado || cargando || opciones.length === 0;

  return (
    <View style={styles.contenedor}>
      <View style={styles.filaEtiqueta}>
        <Ionicons name={icono} size={16} color={colors.primary} />
        <Text style={styles.etiqueta}>{etiqueta}</Text>
      </View>

      <Pressable
        onPress={() => setAbierto(true)}
        disabled={bloqueado}
        accessibilityRole="button"
        accessibilityLabel={`${etiqueta}: ${elegida?.nombre ?? placeholder}`}
        style={[styles.campo, !!error && styles.campoError, bloqueado && styles.campoBloqueado]}
      >
        <Text style={[styles.campoTexto, !elegida && styles.campoPlaceholder]} numberOfLines={1}>
          {elegida?.nombre ?? placeholder}
        </Text>
        {cargando ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="chevron-down" size={20} color={colors.border} />
        )}
      </Pressable>

      {error ? (
        <View>
          <Text accessibilityRole="alert" style={styles.textoError}>{error}</Text>
          {onReintentar ? (
            <Pressable onPress={onReintentar} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.reintentar}>Reintentar</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Modal visible={abierto} animationType="slide" onRequestClose={() => setAbierto(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalEncabezado}>
            <Text style={styles.modalTitulo}>{etiqueta}</Text>
            <Pressable
              onPress={() => setAbierto(false)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            >
              <Ionicons name="close" size={26} color={colors.primary} />
            </Pressable>
          </View>
          <FlatList
            data={opciones}
            keyExtractor={(o) => String(o.id)}
            renderItem={({ item }) => {
              const seleccionada = String(item.id) === valor;
              return (
                <Pressable
                  onPress={() => {
                    onCambiar(item);
                    setAbierto(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: seleccionada }}
                  style={[styles.fila, seleccionada && styles.filaSeleccionada]}
                >
                  <Text style={[styles.filaTexto, seleccionada && styles.filaTextoSeleccionada]}>
                    {item.nombre}
                  </Text>
                  {seleccionada ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  contenedor: { marginBottom: 16, width: "100%" },
  filaEtiqueta: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 7 },
  etiqueta: { fontSize: 15, fontWeight: "700", color: colors.primary },
  campo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 54,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },
  campoError: { borderColor: "#B42318" },
  campoBloqueado: { opacity: 0.6 },
  campoTexto: { flex: 1, fontSize: 16, color: "#2D2D2D" },
  campoPlaceholder: { color: "#9CA3AF" },
  textoError: { fontSize: 12, color: "#B42318", marginTop: 4 },
  reintentar: { fontSize: 12, fontWeight: "700", color: colors.primary, marginTop: 4 },
  modal: { flex: 1, backgroundColor: colors.background },
  modalEncabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  modalTitulo: { fontSize: 18, fontWeight: "800", color: colors.primary },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filaSeleccionada: { backgroundColor: paletaPublicacion.fondoSuave },
  filaTexto: { fontSize: 15, color: paletaPublicacion.textoPrincipal },
  filaTextoSeleccionada: { fontWeight: "700", color: colors.primary },
});
