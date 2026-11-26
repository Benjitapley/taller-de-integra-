import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { CustomButton } from "@/components/CustomButton";
import { paletaPublicacion } from "@/constants/origenPublicacion";
import { cerrarPublicacion, consultarPublicacionPropia } from "@/services/publicacionesService";
import { colors } from "@/theme/colors";
import { mensajeDeError } from "@/types/erroresServidor";
import type { PublicacionPropia } from "@/types/PublicacionPropia";

type Carga =
  | { estado: "cargando" }
  | { estado: "error"; mensaje: string }
  | { estado: "listo"; publicacion: PublicacionPropia };

const ETIQUETAS_VIVIENDA: Record<string, string> = {
  casa: "Casa",
  departamento: "Departamento",
  habitacion: "Habitación",
};

function formatoPrecio(precio: number): string {
  return `$${precio.toLocaleString("es-CL")} CLP / mes`;
}

function formatoFecha(fecha: string | null): string | null {
  if (!fecha) return null;
  const fechaValida = new Date(fecha);
  if (Number.isNaN(fechaValida.getTime())) return null;
  return fechaValida.toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function DetallePublicacionPropia() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(Array.isArray(params.id) ? params.id[0] : params.id);
  const router = useRouter();
  const [intento, setIntento] = useState(0);
  const [carga, setCarga] = useState<Carga>({ estado: "cargando" });
  const [cerrando, setCerrando] = useState(false);
  const cerrandoRef = useRef(false);

  useEffect(() => {
    let vigente = true;
    consultarPublicacionPropia(id).then((resultado) => {
      if (!vigente) return;
      setCarga(resultado.exito
        ? { estado: "listo", publicacion: resultado.datos }
        : { estado: "error", mensaje: mensajeDeError(resultado) });
    });
    return () => {
      vigente = false;
    };
  }, [id, intento]);

  const volver = () => (router.canGoBack() ? router.back() : router.replace("/publicaciones"));
  const opcionesHeader = {
    headerShown: true,
    title: "Mi publicación",
    headerTintColor: colors.primary,
    headerShadowVisible: false,
    headerStyle: { backgroundColor: colors.background },
    headerLeft: () => (
      <Pressable onPress={volver} hitSlop={12} accessibilityLabel="Volver" style={styles.botonVolver}>
        <Ionicons name="arrow-back" size={24} color={colors.primary} />
      </Pressable>
    ),
  };

  if (carga.estado === "cargando") {
    return (
      <>
        <Stack.Screen options={opcionesHeader} />
        <View style={styles.centro}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.secundario}>Cargando tu publicación…</Text>
        </View>
      </>
    );
  }

  if (carga.estado === "error") {
    return (
      <>
        <Stack.Screen options={opcionesHeader} />
        <View style={styles.centro}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.primary} />
          <Text style={styles.tituloCentro}>No pudimos cargar tu publicación</Text>
          <Text style={styles.secundario}>{carga.mensaje}</Text>
          <CustomButton
            titulo="Reintentar"
            iconoIzquierdo="refresh-outline"
            onPress={() => {
              setCarga({ estado: "cargando" });
              setIntento((actual) => actual + 1);
            }}
          />
          <CustomButton titulo="Volver a mis publicaciones" variante="contorno" onPress={volver} />
        </View>
      </>
    );
  }

  const publicacion = carga.publicacion;
  const lugar = [publicacion.nombreComuna, publicacion.nombreRegion]
    .filter(Boolean)
    .join(", ") || publicacion.ubicacion;
  const fecha = formatoFecha(publicacion.fechaPublicacion);
  const vivienda = ETIQUETAS_VIVIENDA[publicacion.tipoVivienda] ?? "No especificado";

  async function cerrarAviso() {
    if (cerrandoRef.current) return;
    cerrandoRef.current = true;
    setCerrando(true);
    const resultado = await cerrarPublicacion(publicacion.idPublicacion);
    cerrandoRef.current = false;
    setCerrando(false);

    if (resultado.exito) {
      setCarga({ estado: "listo", publicacion: resultado.datos });
      return;
    }

    if (resultado.codigo === "respuesta_invalida" && (resultado.estadoHttp ?? 0) < 300) {
      Alert.alert(
        "Revisa el estado",
        "No pudimos confirmar el cierre. Actualizaremos el detalle para mostrar cómo quedó.",
        [{
          text: "Aceptar",
          onPress: () => {
            setCarga({ estado: "cargando" });
            setIntento((actual) => actual + 1);
          },
        }],
      );
      return;
    }

    if (resultado.estadoHttp === 409 && !resultado.codigoServidor) {
      Alert.alert(
        "No se pudo cerrar",
        "No se pudo cerrar el aviso: hay una aceptación en curso. Espera a que termine e inténtalo de nuevo.",
      );
      return;
    }

    Alert.alert("No se pudo cerrar", mensajeDeError(resultado));
  }

  function confirmarCierre() {
    Alert.alert(
      "Cerrar publicación",
      `“${publicacion.titulo}” dejará de aceptar postulaciones y las postulaciones abiertas (pendientes o preseleccionadas) se cancelarán. Quienes ya viven en el arriendo no se ven afectados.`,
      [
        { text: "Ahora no", style: "cancel" },
        { text: "Cerrar aviso", style: "destructive", onPress: () => void cerrarAviso() },
      ],
    );
  }

  return (
    <>
      <Stack.Screen options={opcionesHeader} />
      <ScrollView style={styles.pantalla} contentContainerStyle={styles.contenido}>
        {publicacion.imagenes.length > 0 ? (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            {publicacion.imagenes
              .slice()
              .sort((a, b) => a.orden - b.orden)
              .map((imagen) => (
                <Image
                  key={imagen.idImagen}
                  source={{ uri: imagen.url }}
                  style={styles.imagen}
                  resizeMode="cover"
                  accessibilityLabel="Foto de la publicación"
                />
              ))}
          </ScrollView>
        ) : (
          <View style={[styles.imagen, styles.imagenVacia]}>
            <Ionicons name="image-outline" size={42} color={colors.primary} />
            <Text style={styles.secundario}>Sin fotos</Text>
          </View>
        )}

        <View style={styles.panel}>
          <View style={styles.estadoFila}>
            <Text style={styles.tipo}>{publicacion.tipo}</Text>
            <Text style={[styles.estado, publicacion.estado === "Cerrada" && styles.estadoCerrada]}>
              {publicacion.estado}
            </Text>
          </View>
          <Text style={styles.titulo}>{publicacion.titulo}</Text>
          <Text style={styles.precio}>{formatoPrecio(publicacion.precio)}</Text>

          <View style={styles.datos}>
            <Dato icono="location-outline" texto={lugar || "Ubicación no disponible"} />
            <Dato
              icono="people-outline"
              texto={publicacion.cuposDisponibles === null
                ? `Capacidad: ${publicacion.cuposTotales} · disponibilidad sin confirmar`
                : `${publicacion.cuposDisponibles} de ${publicacion.cuposTotales} cupos libres`}
            />
            <Dato icono="home-outline" texto={vivienda} />
            <Dato
              icono="paw-outline"
              texto={publicacion.aceptaMascotas ? "Acepta mascotas" : "No acepta mascotas"}
            />
            {fecha ? <Dato icono="calendar-outline" texto={`Publicada el ${fecha}`} /> : null}
          </View>

          <Seccion titulo="Descripción">
            <Text style={styles.texto}>{publicacion.descripcion}</Text>
          </Seccion>

          {publicacion.reglas.length > 0 ? (
            <Seccion titulo="Reglas del arrendador">
              {publicacion.reglas.map((regla, indice) => (
                <View key={`${indice}-${regla}`} style={styles.regla}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
                  <Text style={styles.texto}>{regla}</Text>
                </View>
              ))}
            </Seccion>
          ) : null}

          {publicacion.estado !== "Cerrada" ? (
            <>
              <CustomButton
                titulo="Editar publicación"
                iconoIzquierdo="create-outline"
                onPress={() =>
                  router.push({
                    pathname: "/publicaciones/[id]/editar",
                    params: { id: String(publicacion.idPublicacion) },
                  })
                }
              />
              <CustomButton
                titulo={cerrando ? "Cerrando aviso..." : "Cerrar aviso"}
                variante="contorno"
                iconoIzquierdo="lock-closed-outline"
                onPress={confirmarCierre}
                deshabilitado={cerrando}
              />
            </>
          ) : (
            <Text style={styles.avisoCerrada}>Esta publicación está cerrada: ya no recibe postulaciones y las que estaban abiertas fueron canceladas.</Text>
          )}
        </View>
      </ScrollView>
    </>
  );
}

function Dato({ icono, texto }: { icono: keyof typeof Ionicons.glyphMap; texto: string }) {
  return (
    <View style={styles.dato}>
      <Ionicons name={icono} size={19} color={colors.primary} />
      <Text style={styles.texto}>{texto}</Text>
    </View>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={styles.seccion}>
      <Text style={styles.seccionTitulo}>{titulo}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  contenido: { paddingBottom: 28 },
  centro: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 24,
    backgroundColor: colors.background,
  },
  botonVolver: { paddingHorizontal: 12 },
  imagen: { width: "100%", height: 270, backgroundColor: paletaPublicacion.fondoSuave },
  imagenVacia: { alignItems: "center", justifyContent: "center", gap: 8 },
  panel: { padding: 20, gap: 12 },
  estadoFila: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tipo: { color: colors.primary, fontSize: 14, fontWeight: "700" },
  estado: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    overflow: "hidden",
    color: "#15803D",
    backgroundColor: "#DCFCE7",
    fontSize: 12,
    fontWeight: "700",
  },
  estadoCerrada: { color: "#4B5563", backgroundColor: "#E5E7EB" },
  titulo: { color: paletaPublicacion.textoPrincipal, fontSize: 24, lineHeight: 30, fontWeight: "700" },
  tituloCentro: { color: paletaPublicacion.textoPrincipal, fontSize: 18, fontWeight: "700", textAlign: "center" },
  precio: { color: colors.primary, fontSize: 20, fontWeight: "700" },
  datos: { gap: 12, paddingVertical: 8 },
  dato: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  seccion: { gap: 8, paddingTop: 10 },
  seccionTitulo: { color: paletaPublicacion.textoPrincipal, fontSize: 18, fontWeight: "700" },
  texto: { color: paletaPublicacion.textoSecundario, fontSize: 15, lineHeight: 22, flex: 1 },
  secundario: { color: paletaPublicacion.textoSecundario, fontSize: 14, lineHeight: 20, textAlign: "center" },
  regla: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  avisoCerrada: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    color: paletaPublicacion.textoSecundario,
    fontSize: 14,
    lineHeight: 20,
  },
});
