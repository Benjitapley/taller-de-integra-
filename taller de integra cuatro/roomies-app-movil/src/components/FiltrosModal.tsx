import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

export type FiltrosSeleccionados = {
  zonas: string[];
  personas: string[];
  precioMaximo: string;
};

export const FILTROS_VACIOS: FiltrosSeleccionados = {
  zonas: [],
  personas: [],
  precioMaximo: "",
};

type Props = {
  visible: boolean;
  valores: FiltrosSeleccionados;
  onCerrar: () => void;
  onAplicar: (filtros: FiltrosSeleccionados) => void;
};

const ZONAS_DISPONIBLES = ["Providencia", "Ñuñoa", "Santiago Centro", "Las Condes"];
const PERSONAS_DISPONIBLES = ["1 persona", "2 personas", "3 o más"];

// Filtros 100% visuales: seleccionar acá NO dispara ninguna búsqueda real
// todavía (no hay listado que filtrar hasta que se implemente MOB-06). La
// idea es que Matías/el equipo vean cómo se va a sentir interactuar con
// esto cuando esté conectado.

export default function FiltrosModal({ visible, valores, onCerrar, onAplicar }: Props) {
  const [zonas, setZonas] = useState(valores.zonas);
  const [personas, setPersonas] = useState(valores.personas);
  const [precioMaximo, setPrecioMaximo] = useState(valores.precioMaximo);

  function alternar(lista: string[], item: string, actualizar: (nueva: string[]) => void) {
    actualizar(lista.includes(item) ? lista.filter((x) => x !== item) : [...lista, item]);
  }

  function limpiar() {
    setZonas([]);
    setPersonas([]);
    setPrecioMaximo("");
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}>
      <View style={styles.fondo}>
        <View style={styles.hoja}>
          <View style={styles.filaTitulo}>
            <Text style={styles.titulo}>Filtros</Text>
            <Pressable onPress={onCerrar} hitSlop={8}>
              <Ionicons name="close" size={22} color="#6B7280" />
            </Pressable>
          </View>

          <ScrollView>
            <Text style={styles.seccionTitulo}>Zona</Text>
            <View style={styles.filaChips}>
              {ZONAS_DISPONIBLES.map((zona) => {
                const activo = zonas.includes(zona);
                return (
                  <Pressable
                    key={zona}
                    style={[styles.chip, activo && styles.chipActivo]}
                    onPress={() => alternar(zonas, zona, setZonas)}
                  >
                    <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>{zona}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.seccionTitulo}>Personas</Text>
            <View style={styles.filaChips}>
              {PERSONAS_DISPONIBLES.map((opcion) => {
                const activo = personas.includes(opcion);
                return (
                  <Pressable
                    key={opcion}
                    style={[styles.chip, activo && styles.chipActivo]}
                    onPress={() => alternar(personas, opcion, setPersonas)}
                  >
                    <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>{opcion}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.seccionTitulo}>Presupuesto máximo (CLP)</Text>
            <TextInput
              value={precioMaximo}
              onChangeText={setPrecioMaximo}
              placeholder="Ej: 250000"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              style={styles.inputPrecio}
            />
          </ScrollView>

          <View style={styles.filaBotones}>
            <Pressable style={styles.botonLimpiar} onPress={limpiar}>
              <Text style={styles.botonLimpiarTexto}>Limpiar</Text>
            </Pressable>
            <Pressable
              style={styles.botonAplicar}
              onPress={() => onAplicar({ zonas, personas, precioMaximo })}
            >
              <Text style={styles.botonAplicarTexto}>Aplicar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.4)",
    justifyContent: "flex-end",
  },
  hoja: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "75%",
    gap: 12,
  },
  filaTitulo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  titulo: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  seccionTitulo: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    marginTop: 14,
    marginBottom: 8,
  },
  filaChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActivo: {
    backgroundColor: "#4F46E5",
    borderColor: "#4F46E5",
  },
  chipTexto: {
    fontSize: 13,
    color: "#374151",
  },
  chipTextoActivo: {
    color: "#fff",
    fontWeight: "600",
  },
  inputPrecio: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
  },
  filaBotones: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  botonLimpiar: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  botonLimpiarTexto: {
    color: "#374151",
    fontWeight: "600",
  },
  botonAplicar: {
    flex: 1,
    backgroundColor: "#4F46E5",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  botonAplicarTexto: {
    color: "#fff",
    fontWeight: "600",
  },
});
