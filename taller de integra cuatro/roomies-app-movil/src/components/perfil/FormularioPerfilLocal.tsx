// Formulario local previo a A08, conservado para adaptar en A09.
// No está montado en Perfil: faltan el contrato de campos editables y PATCH real.
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { UsuarioPerfil } from "@/types/Usuario";

type PerfilEdicionLocal = UsuarioPerfil & {
  edad: number;
  ubicacion: string;
  bio: string;
  preferencias: string[];
  buscaEn: string[];
};

const OPCIONES_PREFERENCIAS = [
  "No fuma", "No tiene mascotas", "Ordenado", "Responsable", "Sociable", "Tranquilo",
];

function CampoTexto({
  etiqueta,
  valor,
  onCambiar,
  teclado,
  multilinea,
  estiloContenedor,
}: {
  etiqueta: string;
  valor: string;
  onCambiar: (texto: string) => void;
  teclado?: "default" | "numeric";
  multilinea?: boolean;
  estiloContenedor?: object;
}) {
  return (
    <View style={estiloContenedor}>
      <Text style={styles.etiquetaCampo}>{etiqueta}</Text>
      <TextInput
        value={valor}
        onChangeText={onCambiar}
        keyboardType={teclado}
        multiline={multilinea}
        style={[styles.inputEditar, multilinea && styles.inputEditarMultilinea]}
      />
    </View>
  );
}

export function TarjetaEditarPerfil({
  usuario,
  onGuardar,
  onCancelar,
}: {
  usuario: PerfilEdicionLocal;
  onGuardar: (usuario: PerfilEdicionLocal) => void;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(usuario.nombre);
  const [edad, setEdad] = useState(String(usuario.edad));
  const [ocupacion, setOcupacion] = useState(usuario.ocupacion);
  const [ubicacion, setUbicacion] = useState(usuario.ubicacion);
  const [bio, setBio] = useState(usuario.bio);
  const [buscaEnTexto, setBuscaEnTexto] = useState(usuario.buscaEn.join(", "));
  const [presupuesto, setPresupuesto] = useState(String(usuario.presupuesto));
  const [preferencias, setPreferencias] = useState<string[]>(usuario.preferencias);

  function alternarPreferencia(opcion: string) {
    setPreferencias((actual) =>
      actual.includes(opcion) ? actual.filter((p) => p !== opcion) : [...actual, opcion]
    );
  }

  function guardar() {
    onGuardar({
      ...usuario,
      nombre: nombre.trim() || usuario.nombre,
      edad: Number(edad) || usuario.edad,
      ocupacion,
      ubicacion,
      bio,
      buscaEn: buscaEnTexto.split(",").map((z) => z.trim()).filter(Boolean),
      presupuesto: Number(presupuesto) || usuario.presupuesto,
      preferencias,
    });
  }

  return (
    <View style={styles.tarjeta}>
      <View style={styles.filaTituloSeccion}>
        <Ionicons name="create-outline" size={16} color="#4F46E5" />
        <Text style={styles.tituloSeccion}>Editar perfil</Text>
      </View>

      <CampoTexto etiqueta="Nombre" valor={nombre} onCambiar={setNombre} />
      <View style={styles.filaDosCampos}>
        <CampoTexto etiqueta="Edad" valor={edad} onCambiar={setEdad} teclado="numeric" estiloContenedor={{ flex: 1 }} />
        <CampoTexto etiqueta="Ocupación" valor={ocupacion} onCambiar={(texto) => {
          if (
            texto === "Estudiante" ||
            texto === "Trabajador" ||
            texto === "Ambos"
          ) {
            setOcupacion(texto);
          }
        }} estiloContenedor={{ flex: 2 }} />
      </View>
      <CampoTexto etiqueta="Ubicación" valor={ubicacion} onCambiar={setUbicacion} />
      <CampoTexto etiqueta="Bio" valor={bio} onCambiar={setBio} multilinea />
      <CampoTexto etiqueta="Busco en (separado por comas)" valor={buscaEnTexto} onCambiar={setBuscaEnTexto} />
      <CampoTexto etiqueta="Presupuesto máximo (CLP)" valor={presupuesto} onCambiar={setPresupuesto} teclado="numeric" />

      <Text style={styles.etiquetaCampo}>Preferencias</Text>
      <View style={styles.filaChipsPreferencias}>
        {OPCIONES_PREFERENCIAS.map((opcion) => {
          const activa = preferencias.includes(opcion);
          return (
            <Pressable
              key={opcion}
              style={[styles.chipPreferencia, activa && styles.chipPreferenciaActiva]}
              onPress={() => alternarPreferencia(opcion)}
            >
              <Text style={[styles.chipPreferenciaTexto, activa && styles.chipPreferenciaTextoActiva]}>
                {opcion}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.filaBotonesEditar}>
        <Pressable style={styles.botonCancelar} onPress={onCancelar}>
          <Text style={styles.botonCancelarTexto}>Cancelar</Text>
        </Pressable>
        <Pressable style={styles.botonGuardar} onPress={guardar}>
          <Text style={styles.botonGuardarTexto}>Guardar</Text>
        </Pressable>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  tarjeta: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#E5E7EB", padding: 16, gap: 8 },
  filaTituloSeccion: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  tituloSeccion: { fontSize: 15, fontWeight: "700", color: "#111827" },
  // Edición
  etiquetaCampo: { fontSize: 12, fontWeight: "600", color: "#6B7280", marginTop: 10, marginBottom: 4 },
  inputEditar: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
  },
  inputEditarMultilinea: { minHeight: 70, textAlignVertical: "top" },
  filaDosCampos: { flexDirection: "row", gap: 10 },
  filaChipsPreferencias: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chipPreferencia: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipPreferenciaActiva: { backgroundColor: "#4F46E5", borderColor: "#4F46E5" },
  chipPreferenciaTexto: { fontSize: 12, color: "#374151" },
  chipPreferenciaTextoActiva: { color: "#fff", fontWeight: "600" },
  filaBotonesEditar: { flexDirection: "row", gap: 10, marginTop: 16 },
  botonCancelar: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  botonCancelarTexto: { color: "#374151", fontWeight: "600" },
  botonGuardar: { flex: 1, backgroundColor: "#4F46E5", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  botonGuardarTexto: { color: "#fff", fontWeight: "600" },
});
