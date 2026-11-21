import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import BarraBusqueda from "@/components/BarraBusqueda";
import { CustomButton } from "@/components/CustomButton";
import EstadoVacio from "@/components/EstadoVacio";
import FiltrosModal, {
  FILTROS_VACIOS,
  type FiltrosSeleccionados,
} from "@/components/FiltrosModal";
import { PublicacionCard } from "@/components/Publicacion_Card";
import { listarPublicaciones, type FiltrosListado } from "@/services/publicacionesService";
import type { Publicacion } from "@/types/Publicacion";

const PERSONAS_API: Record<string, "1" | "2" | "3"> = {
  "1 persona": "1",
  "2 personas": "2",
  "3 o más": "3",
};

// El servidor solo acepta un texto de búsqueda (`consulta`): si el usuario escribe algo
// se usa ese texto; si no, se usa la zona elegida.
function aFiltrosListado(busqueda: string, filtros: FiltrosSeleccionados): FiltrosListado {
  const precioMax = Number(filtros.precioMaximo);
  const personas = filtros.personas[0];
  return {
    consulta: busqueda.trim() || filtros.zonas[0],
    precioMax:
      filtros.precioMaximo !== "" && Number.isFinite(precioMax) && precioMax >= 0
        ? precioMax
        : undefined,
    personas: personas ? PERSONAS_API[personas] : undefined,
  };
}

export default function BuscadorPublicaciones() {
  const [busqueda, setBusqueda] = useState("");
  const [filtrosVisibles, setFiltrosVisibles] = useState(false);
  const [filtros, setFiltros] = useState<FiltrosSeleccionados>(FILTROS_VACIOS);

  const [publicaciones, setPublicaciones] = useState<Publicacion[]>([]);
  const [pagina, setPagina] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState("");
  const [errorMas, setErrorMas] = useState("");
  const [intento, setIntento] = useState(0);

  // Carga la primera página cada vez que cambia la búsqueda o los filtros.
  // La espera de 400 ms evita una petición por cada letra que se escribe.
  useEffect(() => {
    let vigente = true;
    const espera = setTimeout(async () => {
      setCargando(true);
      setError("");
      setErrorMas("");
      const resultado = await listarPublicaciones(aFiltrosListado(busqueda, filtros), 1);
      if (!vigente) return;
      if (resultado.exito) {
        setPublicaciones(resultado.publicaciones);
        setHayMas(resultado.hayMas);
        setPagina(1);
      } else {
        setPublicaciones([]);
        setHayMas(false);
        setError(resultado.error);
      }
      setCargando(false);
    }, 400);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [busqueda, filtros, intento]);

  async function cargarMas() {
    if (cargandoMas) return;
    setCargandoMas(true);
    setErrorMas("");
    const resultado = await listarPublicaciones(aFiltrosListado(busqueda, filtros), pagina + 1);
    if (resultado.exito) {
      // Evita repetir una publicación si el listado cambió entre dos páginas.
      setPublicaciones((actuales) => {
        const ids = new Set(actuales.map((p) => p.idPublicacion));
        return [...actuales, ...resultado.publicaciones.filter((p) => !ids.has(p.idPublicacion))];
      });
      setPagina(pagina + 1);
      setHayMas(resultado.hayMas);
    } else {
      setErrorMas(resultado.error);
    }
    setCargandoMas(false);
  }

  const hayFiltrosActivos =
    filtros.zonas.length > 0 ||
    filtros.personas.length > 0 ||
    filtros.precioMaximo !== "";

  // La API no entrega el total: el "+" indica que hay más páginas por cargar.
  const total = `${publicaciones.length}${hayMas ? "+" : ""}`;

  return (
    <View style={styles.contenedor}>
      <BarraBusqueda
        valor={busqueda}
        onCambiarValor={setBusqueda}
        onPresionarFiltros={() => setFiltrosVisibles(true)}
      />

      {!cargando && !error && (busqueda !== "" || hayFiltrosActivos) && (
        <View style={styles.resumenBusqueda}>
          <Text style={styles.resumenTexto}>
            {total}{" "}
            {publicaciones.length === 1 && !hayMas
              ? "publicación encontrada"
              : "publicaciones encontradas"}
          </Text>
        </View>
      )}

      <View style={styles.encabezadoListado}>
        <Text style={styles.tituloListado}>Publicaciones disponibles</Text>
        {!cargando && !error ? <Text style={styles.cantidadListado}>{total}</Text> : null}
      </View>

      {cargando ? (
        <ActivityIndicator size="large" color="#4F46E5" />
      ) : error ? (
        <View style={styles.errorCaja}>
          <Text style={styles.errorTexto}>{error}</Text>
          <CustomButton titulo="Reintentar" onPress={() => setIntento((n) => n + 1)} />
        </View>
      ) : publicaciones.length > 0 ? (
        <View style={styles.lista}>
          {publicaciones.map((publicacion) => (
            <PublicacionCard key={publicacion.idPublicacion} publicacion={publicacion} />
          ))}
          {errorMas ? <Text style={styles.errorTexto}>{errorMas}</Text> : null}
          {hayMas ? (
            <CustomButton
              titulo="Cargar más"
              variante="contorno"
              cargando={cargandoMas}
              onPress={cargarMas}
            />
          ) : null}
        </View>
      ) : (
        <EstadoVacio
          titulo="No encontramos publicaciones"
          mensaje="Prueba buscando en otras zonas o flexibiliza el precio máximo en los filtros."
          icono="home-outline"
        />
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
  errorCaja: {
    gap: 12,
    alignItems: "center",
  },
  errorTexto: {
    fontSize: 13,
    color: "#B42318",
    textAlign: "center",
  },
});