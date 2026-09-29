import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import BarraBusqueda from "@/components/BarraBusqueda";
import FiltrosModal, {
  FILTROS_VACIOS,
  type FiltrosSeleccionados,
} from "@/components/FiltrosModal";
import { PublicacionCard } from "@/components/Publicacion_Card";
import { publicacionesMock } from "@/mocks";
import type { Publicacion } from "@/types/Publicacion";

function formatearPrecio(precio: number): string {
  return `$${precio.toLocaleString("es-CL")} CLP`;
}

function obtenerTipoCard(publicacion: Publicacion) {
  return publicacion.tipo === "Arrendador" ? "arriendo" : "se_busca";
}

function obtenerPersonas(publicacion: Publicacion): string {
  const cantidad = publicacion.cuposDisponibles;
  return `${cantidad} ${cantidad === 1 ? "cupo disponible" : "cupos disponibles"}`;
}

function coincideBusqueda(publicacion: Publicacion, busqueda: string): boolean {
  const termino = busqueda.trim().toLocaleLowerCase("es-CL");
  if (!termino) return true;

  return [
    publicacion.titulo,
    publicacion.descripcion,
    publicacion.ubicacion,
  ].some((campo) => campo.toLocaleLowerCase("es-CL").includes(termino));
}

function coincideFiltros(
  publicacion: Publicacion,
  filtros: FiltrosSeleccionados,
): boolean {
  const coincideZona =
    filtros.zonas.length === 0 ||
    filtros.zonas.some((zona) =>
      publicacion.ubicacion.toLocaleLowerCase("es-CL").includes(zona.toLocaleLowerCase("es-CL")),
    );

  const coincidePersonas =
    filtros.personas.length === 0 ||
    filtros.personas.some((opcion) => {
      if (opcion === "1 persona") return publicacion.cuposDisponibles === 1;
      if (opcion === "2 personas") return publicacion.cuposDisponibles === 2;
      return publicacion.cuposDisponibles >= 3;
    });

  const precioMaximo = Number(filtros.precioMaximo);
  const coincidePrecio =
    !filtros.precioMaximo || Number.isNaN(precioMaximo)
      ? true
      : publicacion.precio <= precioMaximo;

  return coincideZona && coincidePersonas && coincidePrecio;
}

function TarjetaPublicacion({ publicacion }: { publicacion: Publicacion }) {
  return (
    <PublicacionCard
      tipo={obtenerTipoCard(publicacion)}
      titulo={publicacion.titulo}
      imagenUrl={publicacion.imagenPrincipalUrl}
      precio={formatearPrecio(publicacion.precio)}
      ubicacion={publicacion.ubicacion}
      personas={obtenerPersonas(publicacion)}
      descripcion={publicacion.descripcion}
      publicadoHace="recientemente"
    />
  );
}

export default function BuscadorPublicaciones() {
  const [busqueda, setBusqueda] = useState("");
  const [filtrosVisibles, setFiltrosVisibles] = useState(false);
  const [filtros, setFiltros] = useState<FiltrosSeleccionados>(FILTROS_VACIOS);

  const publicacionesFiltradas = useMemo(
    () =>
      publicacionesMock.filter(
        (publicacion) =>
          coincideBusqueda(publicacion, busqueda) &&
          coincideFiltros(publicacion, filtros),
      ),
    [busqueda, filtros],
  );

  const hayFiltrosActivos =
    filtros.zonas.length > 0 ||
    filtros.personas.length > 0 ||
    filtros.precioMaximo !== "";

  return (
    <View style={styles.contenedor}>
      <BarraBusqueda
        valor={busqueda}
        onCambiarValor={setBusqueda}
        onPresionarFiltros={() => setFiltrosVisibles(true)}
      />

      {(busqueda !== "" || hayFiltrosActivos) && (
        <View style={styles.resumenBusqueda}>
          <Text style={styles.resumenTexto}>
            {publicacionesFiltradas.length}{" "}
            {publicacionesFiltradas.length === 1
              ? "publicación encontrada"
              : "publicaciones encontradas"}
          </Text>
        </View>
      )}

      <View style={styles.encabezadoListado}>
        <Text style={styles.tituloListado}>Publicaciones disponibles</Text>
        <Text style={styles.cantidadListado}>
          {publicacionesFiltradas.length}
        </Text>
      </View>

      {publicacionesFiltradas.length > 0 ? (
        <View style={styles.lista}>
          {publicacionesFiltradas.map((publicacion) => (
            <TarjetaPublicacion
              key={publicacion.idPublicacion}
              publicacion={publicacion}
            />
          ))}
        </View>
      ) : (
        <View style={styles.sinResultados}>
          <Text style={styles.sinResultadosTitulo}>
            No encontramos publicaciones
          </Text>
          <Text style={styles.sinResultadosTexto}>
            Prueba con otra búsqueda o modifica los filtros.
          </Text>
        </View>
      )}

      <FiltrosModal
        visible={filtrosVisibles}
        valores={filtros}
        onCerrar={() => setFiltrosVisibles(false)}
        onAplicar={(nuevosFiltros) => {
          setFiltros(nuevosFiltros);
          setFiltrosVisibles(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
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
  encabezadoListado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  tituloListado: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  cantidadListado: {
    minWidth: 24,
    textAlign: "center",
    backgroundColor: "#EEF2FF",
    color: "#4F46E5",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 12,
    fontWeight: "700",
  },
  lista: {
    gap: 12,
  },
  sinResultados: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 20,
    alignItems: "center",
  },
  sinResultadosTitulo: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  sinResultadosTexto: {
    marginTop: 4,
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
  },
});
