import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import AppHeader from "@/components/AppHeader";
import BarraBusqueda from "@/components/BarraBusqueda";
import FiltrosModal, { FILTROS_VACIOS, type FiltrosSeleccionados } from "@/components/FiltrosModal";
import { USUARIO_ACTUAL_MOCK } from "@/data/convivenciaMock";


export default function Inicio() {
  const [busqueda, setBusqueda] = useState("");
  const [filtrosVisibles, setFiltrosVisibles] = useState(false);
  const [filtros, setFiltros] = useState<FiltrosSeleccionados>(FILTROS_VACIOS);

  const hayFiltrosActivos = filtros.zonas.length > 0 || filtros.personas.length > 0 || filtros.precioMaximo !== "";

  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={styles.contenedor}>
      <AppHeader fotoUsuarioUrl={USUARIO_ACTUAL_MOCK.fotoUrl} />

      <BarraBusqueda
        valor={busqueda}
        onCambiarValor={setBusqueda}
        onPresionarFiltros={() => setFiltrosVisibles(true)}
      />

      {(busqueda !== "" || hayFiltrosActivos) && (
        <View style={styles.resumenBusqueda}>
          <Text style={styles.resumenTexto}>
            {busqueda !== "" ? `Buscando "${busqueda}"` : "Filtros aplicados"}
            {hayFiltrosActivos &&
              ` · ${[...filtros.zonas, ...filtros.personas].join(", ")}${
                filtros.precioMaximo ? ` · Máx. $${filtros.precioMaximo}` : ""
              }`}
          </Text>
        </View>
      )}

      <View style={styles.notaPlaceholder}>
        <Text style={styles.notaTexto}>
          Listado de publicaciones (MOB-06) va aquí. El buscador y los filtros de arriba ya funcionan
          visualmente, pero todavía no hay datos que filtrar.
        </Text>
      </View>

      <FiltrosModal
        visible={filtrosVisibles}
        valores={filtros}
        onCerrar={() => setFiltrosVisibles(false)}
        onAplicar={(nuevosFiltros) => {
          setFiltros(nuevosFiltros);
          setFiltrosVisibles(false);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  contenedor: {
    padding: 16,
    gap: 12,
  },
  resumenBusqueda: {
    backgroundColor: "#EEF2FF",
    borderRadius: 10,
    padding: 10,
  },
  resumenTexto: {
    fontSize: 12,
    color: "#4F46E5",
  },
  notaPlaceholder: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    padding: 16,
    marginTop: 8,
  },
  notaTexto: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
  },
});
