import { useState } from "react";
import {
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
import type { NuevoRecordatorioInput } from "@/types/Convivencia";

type Props = {
  visible: boolean;
  onCancelar: () => void;
  onGuardar: (recordatorio: NuevoRecordatorioInput) => void;
};

const FORMATO_HORA = /^([01]?\d|2[0-3]):[0-5]\d$/;

export default function NuevoRecordatorioSheet({ visible, onCancelar, onGuardar }: Props) {
  const [titulo, setTitulo] = useState("");
  const [fechaTexto, setFechaTexto] = useState("");
  const [horaTexto, setHoraTexto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [intentoGuardar, setIntentoGuardar] = useState(false);

  const horaLimpia = horaTexto.trim();
  const errorTitulo = titulo.trim() === "" ? "Escribe un título para el recordatorio." : null;
  const errorFecha = fechaTexto.trim() === "" ? "Indica una fecha." : null;
  const errorHora =
    horaLimpia !== "" && !FORMATO_HORA.test(horaLimpia)
      ? "Usa el formato HH:MM, por ejemplo 19:00."
      : null;
  const hayErrores = errorTitulo !== null || errorFecha !== null || errorHora !== null;

  function reiniciar() {
    setTitulo("");
    setFechaTexto("");
    setHoraTexto("");
    setDescripcion("");
    setIntentoGuardar(false);
  }

  function cancelar() {
    reiniciar();
    onCancelar();
  }

  function guardar() {
    setIntentoGuardar(true);
    if (hayErrores) return;

    onGuardar({
      titulo: titulo.trim(),
      fechaTexto: fechaTexto.trim(),
      // "9:30" se normaliza a "09:30" para que se vea igual que las demás.
      horaTexto: horaLimpia === "" ? undefined : horaLimpia.padStart(5, "0"),
      descripcion: descripcion.trim() === "" ? undefined : descripcion.trim(),
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
            <Text style={styles.titulo}>Nuevo recordatorio</Text>
            <Text style={styles.subtitulo}>Que no se les olvide lo importante.</Text>

            <Text style={styles.etiqueta}>Título</Text>
            <TextInput
              value={titulo}
              onChangeText={setTitulo}
              placeholder="Ej. Pagar internet"
              placeholderTextColor="#9CA3AF"
              style={[styles.input, intentoGuardar && errorTitulo !== null && styles.inputError]}
            />
            {intentoGuardar && errorTitulo !== null && (
              <Text style={styles.textoError}>{errorTitulo}</Text>
            )}

            <Text style={styles.etiqueta}>Fecha</Text>
            <TextInput
              value={fechaTexto}
              onChangeText={setFechaTexto}
              placeholder="Viernes 16 de octubre"
              placeholderTextColor="#9CA3AF"
              style={[styles.input, intentoGuardar && errorFecha !== null && styles.inputError]}
            />
            {intentoGuardar && errorFecha !== null && (
              <Text style={styles.textoError}>{errorFecha}</Text>
            )}

            <Text style={styles.etiqueta}>
              Hora <Text style={styles.opcional}>(opcional)</Text>
            </Text>
            <TextInput
              value={horaTexto}
              onChangeText={setHoraTexto}
              placeholder="19:00"
              placeholderTextColor="#9CA3AF"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              style={[styles.input, intentoGuardar && errorHora !== null && styles.inputError]}
            />
            {intentoGuardar && errorHora !== null && <Text style={styles.textoError}>{errorHora}</Text>}

            <Text style={styles.etiqueta}>
              Descripción <Text style={styles.opcional}>(opcional)</Text>
            </Text>
            <TextInput
              value={descripcion}
              onChangeText={setDescripcion}
              placeholder="Añade información útil"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
            />

            <Pressable style={styles.botonGuardar} onPress={guardar}>
              <Text style={styles.botonGuardarTexto}>Guardar recordatorio</Text>
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
  botonGuardar: {
    backgroundColor: "#4F46E5",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 22,
  },
  botonGuardarTexto: { color: "#fff", fontSize: 15, fontWeight: "700" },
  botonCancelar: {
    backgroundColor: "#EEF2FF",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  botonCancelarTexto: { color: "#4F46E5", fontSize: 15, fontWeight: "700" },
});
