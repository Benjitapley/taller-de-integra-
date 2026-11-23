import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { IntegranteConvivencia, NuevaTareaInput } from "@/types/Convivencia";


type Props = {
  visible: boolean;
  integrantes: IntegranteConvivencia[];
  onCancelar: () => void;
  onCrear: (tarea: NuevaTareaInput) => void;
};

export default function NuevaTareaSheet({ visible, integrantes, onCancelar, onCrear }: Props) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [responsableId, setResponsableId] = useState<string | null>(null);
  const [fechaTexto, setFechaTexto] = useState("");
  const [intentoCrear, setIntentoCrear] = useState(false);

  const errorNombre = nombre.trim() === "" ? "Escribe un nombre para la tarea." : null;
  const errorResponsable = responsableId === null ? "Elige a quién se la asignas." : null;
  const errorFecha = fechaTexto.trim() === "" ? "Indica una fecha." : null;
  const hayErrores = errorNombre !== null || errorResponsable !== null || errorFecha !== null;

  function reiniciar() {
    setNombre("");
    setDescripcion("");
    setResponsableId(null);
    setFechaTexto("");
    setIntentoCrear(false);
  }

  function cancelar() {
    reiniciar();
    onCancelar();
  }

  function crear() {
    setIntentoCrear(true);
    if (hayErrores) return;

    const responsable = integrantes.find((integrante) => integrante.id === responsableId);
    if (!responsable) return;

    onCrear({
      nombre: nombre.trim(),
      descripcion: descripcion.trim() === "" ? undefined : descripcion.trim(),
      responsable,
      fechaTexto: fechaTexto.trim(),
    });
    reiniciar();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={cancelar}>
      <KeyboardAvoidingView
        style={styles.fondo}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.areaCierre} onPress={cancelar} />

        <View style={styles.hoja}>
          <View style={styles.asa} />

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.titulo}>Nueva tarea</Text>
            <Text style={styles.subtitulo}>Organiza responsabilidades del hogar.</Text>

            <Text style={styles.etiqueta}>Nombre</Text>
            <TextInput
              value={nombre}
              onChangeText={setNombre}
              placeholder="Ej. Aseo de la cocina"
              placeholderTextColor="#9CA3AF"
              style={[styles.input, intentoCrear && errorNombre !== null && styles.inputError]}
            />
            {intentoCrear && errorNombre !== null && <Text style={styles.textoError}>{errorNombre}</Text>}

            <Text style={styles.etiqueta}>
              Descripción <Text style={styles.opcional}>(opcional)</Text>
            </Text>
            <TextInput
              value={descripcion}
              onChangeText={setDescripcion}
              placeholder="Detalles de la tarea"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
            />

            <Text style={styles.etiqueta}>Asignar a</Text>
            <View style={styles.filaChips}>
              {integrantes.map((integrante) => {
                const activo = integrante.id === responsableId;
                return (
                  <Pressable
                    key={integrante.id}
                    style={[styles.chip, activo && styles.chipActivo]}
                    onPress={() => setResponsableId(integrante.id)}
                  >
                    <Image source={{ uri: integrante.fotoUrl }} style={styles.chipAvatar} />
                    <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>
                      {integrante.nombre}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {intentoCrear && errorResponsable !== null && (
              <Text style={styles.textoError}>{errorResponsable}</Text>
            )}

            <Text style={styles.etiqueta}>Fecha</Text>
            <TextInput
              value={fechaTexto}
              onChangeText={setFechaTexto}
              placeholder="Martes 13 de octubre"
              placeholderTextColor="#9CA3AF"
              style={[styles.input, intentoCrear && errorFecha !== null && styles.inputError]}
            />
            {intentoCrear && errorFecha !== null && <Text style={styles.textoError}>{errorFecha}</Text>}

            <Pressable style={styles.botonCrear} onPress={crear}>
              <Text style={styles.botonCrearTexto}>Crear tarea</Text>
            </Pressable>
            <Pressable style={styles.botonCancelar} onPress={cancelar}>
              <Text style={styles.botonCancelarTexto}>Cancelar</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: "rgba(17, 24, 39, 0.4)", justifyContent: "flex-end" },
  areaCierre: { flex: 1 },
  hoja: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    maxHeight: "90%",
  },
  asa: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    marginBottom: 14,
  },
  titulo: { fontSize: 22, fontWeight: "700", color: "#4F46E5" },
  subtitulo: { fontSize: 13, color: "#6B7280", marginTop: 4, marginBottom: 6 },
  etiqueta: { fontSize: 13, fontWeight: "700", color: "#111827", marginTop: 14, marginBottom: 6 },
  opcional: { fontWeight: "400", color: "#6B7280" },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#111827",
  },
  inputError: { borderColor: "#DC2626" },
  textoError: { fontSize: 12, color: "#DC2626", marginTop: 4 },
  filaChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 20,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 12,
  },
  chipActivo: { backgroundColor: "#4F46E5", borderColor: "#4F46E5" },
  chipAvatar: { width: 22, height: 22, borderRadius: 11 },
  chipTexto: { fontSize: 13, color: "#374151" },
  chipTextoActivo: { color: "#fff", fontWeight: "600" },
  botonCrear: {
    backgroundColor: "#4F46E5",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 22,
  },
  botonCrearTexto: { color: "#fff", fontSize: 15, fontWeight: "700" },
  botonCancelar: {
    backgroundColor: "#EEF2FF",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  botonCancelarTexto: { color: "#4F46E5", fontSize: 15, fontWeight: "700" },
});
