import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { CustomButton } from "@/components/CustomButton";
import {
  actualizarPerfilPropio, consultarPerfilPropio, crearBorradorPerfilPropio,
  LIMITES_EDICION_PERFIL, obtenerCambiosPerfilPropio, type BorradorPerfilPropio,
} from "@/services/usuariosService";
import type { PerfilPropioVista } from "@/types/Usuario";

const campos = [
  { campo: "ocupacion", etiqueta: "Ocupación" },
  { campo: "ciudad", etiqueta: "Ciudad" },
  { campo: "breve_descripcion", etiqueta: "Descripción breve" },
  { campo: "sobre_mi", etiqueta: "Sobre mí" },
] as const satisfies readonly { campo: keyof BorradorPerfilPropio; etiqueta: string }[];

export function FormularioEditarPerfil({ perfil, identidadId, onGuardado, onCancelar }: {
  perfil: PerfilPropioVista;
  identidadId: string;
  onGuardado: (perfil: PerfilPropioVista) => void;
  onCancelar: (requiereConsulta: boolean) => void;
}) {
  const [inicial] = useState(() => crearBorradorPerfilPropio(perfil));
  const [borrador, setBorrador] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const [requiereConsulta, setRequiereConsulta] = useState(false);
  const [error, setError] = useState("");
  const activa = useRef(false);
  const solicitudEnCurso = useRef(false);
  const cambios = obtenerCambiosPerfilPropio(inicial, borrador);

  useFocusEffect(useCallback(() => {
    activa.current = true;
    return () => { activa.current = false; };
  }, []));

  async function guardar() {
    if (solicitudEnCurso.current || (!requiereConsulta && !Object.keys(cambios).length)) return;
    solicitudEnCurso.current = true;
    setGuardando(true);
    setError("");
    try {
      if (requiereConsulta) {
        const consulta = await consultarPerfilPropio(undefined, identidadId);
        if (!activa.current) return;
        if (consulta.exito) onGuardado(consulta.perfil);
        else setError(consulta.error);
        return;
      }

      const resultado = await actualizarPerfilPropio(cambios, identidadId);
      if (!activa.current) return;
      if (resultado.exito) {
        onGuardado(resultado.perfil);
      } else {
        setRequiereConsulta(resultado.guardado);
        setError(resultado.error);
      }
    } catch {
      if (activa.current) setError("No pudimos completar la solicitud. Inténtalo otra vez.");
    } finally {
      solicitudEnCurso.current = false;
      if (activa.current) setGuardando(false);
    }
  }

  return (
    <View style={styles.tarjeta}>
      <Text style={styles.titulo}>Editar perfil</Text>
      <Text style={styles.ayuda}>Puedes dejar un campo vacío para quitarlo de tu perfil.</Text>
      {campos.map(({ campo, etiqueta }) => {
        const multilinea = campo === "breve_descripcion" || campo === "sobre_mi";
        return (
          <View key={campo} style={styles.campo}>
            <Text style={styles.etiqueta}>{etiqueta}</Text>
            <TextInput
              accessibilityLabel={etiqueta}
              value={borrador[campo]}
              onChangeText={(texto) => setBorrador((actual) => ({ ...actual, [campo]: texto }))}
              editable={!guardando && !requiereConsulta}
              maxLength={LIMITES_EDICION_PERFIL[campo]}
              multiline={multilinea}
              style={[styles.input, multilinea && styles.multilinea]}
            />
          </View>
        );
      })}
      {requiereConsulta ? (
        <Text style={styles.ayuda}>El servicio guardó el cambio. Vuelve a consultar el perfil para ver el resultado.</Text>
      ) : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <CustomButton
        titulo={requiereConsulta ? "Volver a consultar" : "Guardar cambios"}
        onPress={guardar}
        cargando={guardando}
        deshabilitado={!requiereConsulta && !Object.keys(cambios).length}
      />
      <CustomButton
        titulo={requiereConsulta ? "Salir de edición" : "Cancelar"}
        variante="contorno"
        onPress={() => onCancelar(requiereConsulta)}
        deshabilitado={guardando}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#E5E7EB", padding: 16, gap: 12 },
  titulo: { fontSize: 16, fontWeight: "700", color: "#111827" },
  ayuda: { fontSize: 13, color: "#4B5563" },
  campo: { gap: 5 },
  etiqueta: { fontSize: 14, fontWeight: "600", color: "#374151" },
  input: { minHeight: 44, borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: "#111827" },
  multilinea: { minHeight: 80, textAlignVertical: "top" },
  error: { color: "#B42318", fontSize: 14 },
});
