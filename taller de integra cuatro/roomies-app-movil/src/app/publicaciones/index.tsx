import React, { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CustomButton } from "@/components/CustomButton";
import { paletaPublicacion } from "@/constants/origenPublicacion";
import { useMisPublicaciones } from "@/hooks/useMisPublicaciones";
import { colors } from "@/theme/colors";
import type { EstadoPublicacion } from "@/types/Publicacion";
import type { PublicacionPropia } from "@/types/PublicacionPropia";

// Mis publicaciones (M4S3-C02). Lista con cursor y filtro por estado. El servicio no
// filtra por estado todavía, así que el filtro se aplica aquí; si queda corto, se
// siguen pidiendo páginas hasta llenar la pantalla o terminar la lista.

type Filtro = "Todas" | EstadoPublicacion;
const FILTROS: readonly Filtro[] = ["Todas", "Disponible", "Activa", "Cerrada"];
const MIN_VISIBLES = 6;

const COLORES_ESTADO: Record<EstadoPublicacion, { fondo: string; texto: string }> = {
  Disponible: { fondo: "#DCFCE7", texto: "#15803D" },
  Activa: { fondo: "#DBEAFE", texto: "#1D4ED8" },
  Cerrada: { fondo: "#E5E7EB", texto: "#4B5563" },
};

const formatearMiles = (numero: number) =>
  String(numero).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

function textoCupos(p: PublicacionPropia): string {
  if (p.estado === "Cerrada") return `Capacidad: ${p.cuposTotales}`;
  // null = el servicio aún no confirma la ocupación: no se muestra como si fuera 0.
  if (p.cuposDisponibles === null) return `Capacidad: ${p.cuposTotales} · disponibilidad sin confirmar`;
  return `${p.cuposDisponibles} de ${p.cuposTotales} cupos libres`;
}

interface TarjetaProps {
  publicacion: PublicacionPropia;
  onVer: () => void;
}

function TarjetaPublicacion({ publicacion: p, onVer }: TarjetaProps) {
  const portada = p.imagenes[0]?.url;
  const lugar = [p.nombreComuna, p.nombreRegion].filter(Boolean).join(", ") || p.ubicacion;
  const colorEstado = COLORES_ESTADO[p.estado];
  const abierta = p.estado !== "Cerrada";

  return (
    <Pressable
      style={styles.tarjeta}
      onPress={onVer}
      accessibilityRole="button"
      accessibilityLabel={`Ver detalle de ${p.titulo}`}
    >
      <View style={styles.filaSuperior}>
        {portada ? (
          <Image source={{ uri: portada }} style={styles.portada} resizeMode="cover" accessibilityLabel="Portada" />
        ) : (
          <View style={[styles.portada, styles.sinPortada]}>
            <Text style={styles.sinPortadaTexto}>Sin foto</Text>
          </View>
        )}
        <View style={styles.datos}>
          <View style={[styles.chip, { backgroundColor: colorEstado.fondo }]}>
            <Text style={[styles.chipTexto, { color: colorEstado.texto }]}>{p.estado}</Text>
          </View>
          <Text style={styles.titulo} numberOfLines={2}>{p.titulo}</Text>
          {lugar ? <Text style={styles.secundario} numberOfLines={1}>{lugar}</Text> : null}
          <Text style={styles.precio}>${formatearMiles(p.precio)} / mes</Text>
          <Text style={styles.secundario}>{textoCupos(p)}</Text>
        </View>
      </View>
      {!abierta && (
        <Text style={styles.secundario}>Publicación cerrada: ya no recibe postulaciones.</Text>
      )}
    </Pressable>
  );
}

export default function MisPublicaciones() {
  const router = useRouter();
  const {
    items, hayMas, estado, error, cargandoMas, errorMas, refrescando,
    recargar, cargarMas,
  } = useMisPublicaciones();

  const [filtro, setFiltro] = useState<Filtro>("Todas");

  // Al volver de editar, la lista se refresca sin borrarla (la primera vez la carga el hook).
  const primeraVez = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (primeraVez.current) {
        primeraVez.current = false;
        return;
      }
      recargar(true);
    }, [recargar]),
  );

  const visibles = filtro === "Todas" ? items : items.filter((p) => p.estado === filtro);

  useEffect(() => {
    if (filtro === "Todas") return;
    if (estado !== "listo" || !hayMas || cargandoMas || errorMas) return;
    if (visibles.length < MIN_VISIBLES) cargarMas();
  }, [filtro, estado, hayMas, cargandoMas, errorMas, visibles.length, cargarMas]);

  if (estado === "cargando") {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (estado === "error") {
    return (
      <View style={styles.centro}>
        <Text accessibilityRole="alert" style={styles.mensaje}>{error ?? "No pudimos cargar tus publicaciones."}</Text>
        <CustomButton titulo="Reintentar" iconoIzquierdo="refresh-outline" onPress={() => recargar()} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.pantalla}
      contentContainerStyle={styles.contenido}
      data={visibles}
      keyExtractor={(p) => String(p.idPublicacion)}
      refreshing={refrescando}
      onRefresh={() => recargar(true)}
      onEndReached={() => {
        if (hayMas) cargarMas();
      }}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={
        <View style={styles.filtros}>
          {FILTROS.map((f) => (
            <Pressable
              key={f}
              onPress={() => setFiltro(f)}
              accessibilityRole="button"
              accessibilityState={{ selected: filtro === f }}
              style={[styles.filtro, filtro === f && styles.filtroActivo]}
            >
              <Text style={[styles.filtroTexto, filtro === f && styles.filtroTextoActivo]}>{f}</Text>
            </Pressable>
          ))}
        </View>
      }
      renderItem={({ item }) => (
        <TarjetaPublicacion
          publicacion={item}
          onVer={() =>
            router.push({ pathname: "/publicaciones/[id]", params: { id: String(item.idPublicacion) } })
          }
        />
      )}
      ListEmptyComponent={
        hayMas ? null : (
          <View style={styles.vacio}>
            <Text style={styles.mensaje}>
              {items.length === 0
                ? "Aún no tienes publicaciones."
                : "No tienes publicaciones en este estado."}
            </Text>
            {items.length === 0 ? (
              <CustomButton titulo="Publicar un arriendo" onPress={() => router.push("/(tabs)/publicar")} />
            ) : null}
          </View>
        )
      }
      ListFooterComponent={
        cargandoMas ? (
          <ActivityIndicator style={styles.pie} color={colors.primary} />
        ) : errorMas ? (
          <View style={styles.pie}>
            <Text accessibilityRole="alert" style={styles.mensaje}>{errorMas}</Text>
            <CustomButton titulo="Reintentar" variante="contorno" onPress={() => cargarMas()} />
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  contenido: { padding: 16, gap: 12, flexGrow: 1 },
  centro: { flex: 1, padding: 24, gap: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  vacio: { gap: 16, paddingVertical: 32, alignItems: "stretch" },
  pie: { paddingVertical: 16, gap: 12 },
  mensaje: { fontSize: 14, lineHeight: 21, textAlign: "center", color: paletaPublicacion.textoSecundario },
  filtros: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  filtro: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: "#FFFFFF" },
  filtroActivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  filtroTexto: { fontSize: 13, fontWeight: "600", color: paletaPublicacion.textoPrincipal },
  filtroTextoActivo: { color: "#FFFFFF" },
  tarjeta: { padding: 12, gap: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: "#FFFFFF" },
  filaSuperior: { flexDirection: "row", gap: 12 },
  portada: { width: 92, height: 92, borderRadius: 10 },
  sinPortada: { alignItems: "center", justifyContent: "center", backgroundColor: paletaPublicacion.fondoSuave },
  sinPortadaTexto: { fontSize: 11, color: paletaPublicacion.textoSecundario },
  datos: { flex: 1, gap: 3 },
  chip: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 2, borderRadius: 10 },
  chipTexto: { fontSize: 11, fontWeight: "700" },
  titulo: { fontSize: 15, fontWeight: "700", color: paletaPublicacion.textoPrincipal },
  precio: { fontSize: 14, fontWeight: "600", color: colors.primary },
  secundario: { fontSize: 12, color: paletaPublicacion.textoSecundario },
});
