import React from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CustomButton } from "@/components/CustomButton";
import { PublicacionCard } from "@/components/Publicacion_Card";
import { PasoPublicacion } from "@/components/publicaciones/PasoPublicacion";
import { ENVIAR_DETALLE_MASCOTAS, ENVIAR_ENLACE_REFERENCIA } from "@/constants/camposPublicacion";
import { etiquetaMascota } from "@/constants/mascotas";
import { paletaPublicacion } from "@/constants/origenPublicacion";
import { OPCIONES_TIPO_VIVIENDA } from "@/constants/tipoVivienda";
import { colors } from "@/theme/colors";
import type { FormularioPublicacionValores, Publicacion } from "@/types/Publicacion";
import { leerBorradorDesdeParams } from "@/utils/borradorPublicacion";
import { leerFotosBorrador } from "@/utils/fotosBorrador";

function FilaDetalle({
  icono,
  texto,
  secundario,
}: {
  icono: React.ComponentProps<typeof Ionicons>["name"];
  texto: string;
  secundario?: string;
}) {
  return (
    <View style={styles.filaDetalle}>
      <Ionicons name={icono} size={18} color={colors.primary} />
      <View style={styles.textosDetalle}>
        <Text style={styles.detalleTexto}>{texto}</Text>
        {secundario ? <Text style={styles.detalleSecundario}>{secundario}</Text> : null}
      </View>
    </View>
  );
}

function textoMascotas(valores: FormularioPublicacionValores): string {
  if (!valores.aceptaMascotas) return "No se aceptan mascotas";
  if (!ENVIAR_DETALLE_MASCOTAS) return "Se aceptan mascotas";
  const tipos = valores.tiposMascotas.map(etiquetaMascota).join(", ");
  return `Se aceptan mascotas: ${tipos}`;
}

export default function Previa() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Al "Volver a editar" regresa al paso anterior (Fotos), que sigue montado con
  // sus fotos y el formulario conserva lo escrito porque nunca se desmonta.
  const volver = () =>
    router.canGoBack() ? router.back() : router.replace("/(tabs)/publicar");

  const opcionesHeader = {
    headerShown: true,
    title: "Vista previa",
    headerTintColor: colors.primary,
    headerShadowVisible: false,
    headerStyle: { backgroundColor: colors.background },
    headerLeft: () => (
      <Pressable
        onPress={volver}
        hitSlop={12}
        accessibilityLabel="Volver"
        style={{ paddingHorizontal: 12 }}
      >
        <Ionicons name="arrow-back" size={24} color={colors.primary} />
      </Pressable>
    ),
  };

  // Si se abre la ruta sin pasar por el formulario, o con datos que no pasan la
  // validación, no hay nada que mostrar.
  const valores = leerBorradorDesdeParams(params);

  if (!valores) {
    return (
      <>
        <Stack.Screen options={opcionesHeader} />
        <View style={styles.vacio}>
          <Text style={styles.vacioTexto}>
            No hay datos para mostrar. Completa el formulario primero.
          </Text>
          <CustomButton
            titulo="Ir a publicar"
            onPress={() => router.replace("/(tabs)/publicar")}
          />
        </View>
      </>
    );
  }

  const fotos = leerFotosBorrador(valores.tipo);
  const enlace = valores.enlaceReferencia.trim();
  const vivienda = OPCIONES_TIPO_VIVIENDA.find((o) => o.valor === valores.tipoVivienda);

  // Publicación solo para dibujar la tarjeta: aún no existe en el backend,
  // por eso el id es 0 y los cupos libres son los ingresados.
  const publicacion: Publicacion = {
    idPublicacion: 0,
    idUsuario: 0,
    tipo: valores.tipo,
    titulo: valores.titulo.trim(),
    descripcion: valores.descripcion.trim(),
    precio: Number(valores.precio),
    ubicacion: valores.ubicacion.trim(),
    estado: "Disponible",
    cuposTotales: Number(valores.cupos),
    cuposDisponibles: Number(valores.cupos),
    imagenPrincipalUrl: fotos[0],
  };

  return (
    <>
      <Stack.Screen options={opcionesHeader} />
      <ScrollView
        style={styles.pantalla}
        contentContainerStyle={styles.contenedor}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.filaBorrador}>
          <PasoPublicacion
            paso={3}
            etiqueta="Revisa tu publicación"
            mostrarBarra={false}
          />
          <View style={styles.chipBorrador}>
            <Text style={styles.chipBorradorTexto}>Borrador</Text>
          </View>
        </View>
        <PublicacionCard
          publicacion={publicacion}
          imagenesUrls={fotos}
          modoVistaPrevia
        />

        {vivienda ? (
          <View style={styles.detalles}>
            <FilaDetalle icono={vivienda.icono} texto={vivienda.etiqueta} />
            <FilaDetalle
              icono="paw-outline"
              texto={textoMascotas(valores)}
              secundario={
                ENVIAR_DETALLE_MASCOTAS && valores.aceptaMascotas && valores.condicionesMascotas.trim()
                  ? valores.condicionesMascotas.trim()
                  : undefined
              }
            />
            <FilaDetalle
              icono="chatbubbles-outline"
              texto={
                valores.permitirComentarios
                  ? "Se permiten comentarios"
                  : "Comentarios desactivados"
              }
            />
          </View>
        ) : null}

        {ENVIAR_ENLACE_REFERENCIA && valores.tipo === "Compartida" && enlace ? (
          <View style={styles.filaEnlace}>
            <Ionicons
              name="link-outline"
              size={16}
              color={paletaPublicacion.textoSecundario}
            />
            <Text style={styles.enlaceTexto} numberOfLines={1}>
              {enlace}
            </Text>
          </View>
        ) : null}

        <Text style={styles.aviso}>
          Así la verán otros usuarios una vez publicada.
        </Text>

        <View style={styles.acciones}>
          {/* M4-C08: conectar con la API de creación según el origen. */}
          <CustomButton
            titulo="Publicar ahora"
            deshabilitado
            onPress={() => {}}
          />
          <Text style={styles.notaPublicar}>
            Disponible cuando se conecte con la API (M4-C08).
          </Text>
          <CustomButton
            titulo="Volver a editar"
            variante="contorno"
            onPress={volver}
          />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contenedor: {
    padding: 16,
    paddingBottom: 32,
  },
  filaBorrador: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  chipBorrador: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#DCFCE7",
  },
  chipBorradorTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: "#15803D",
  },
  detalles: {
    marginTop: 14,
    padding: 12,
    gap: 10,
    borderRadius: 12,
    backgroundColor: paletaPublicacion.fondoSuave,
  },
  filaDetalle: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  textosDetalle: {
    flex: 1,
  },
  detalleTexto: {
    fontSize: 14,
    color: paletaPublicacion.textoPrincipal,
  },
  detalleSecundario: {
    marginTop: 2,
    fontSize: 12,
    color: paletaPublicacion.textoSecundario,
  },
  filaEnlace: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  enlaceTexto: {
    flex: 1,
    fontSize: 14,
    color: paletaPublicacion.textoSecundario,
  },
  aviso: {
    marginTop: 14,
    marginBottom: 16,
    fontSize: 14,
    color: paletaPublicacion.textoSecundario,
  },
  acciones: {
    gap: 12,
  },
  notaPublicar: {
    fontSize: 12,
    textAlign: "center",
    color: paletaPublicacion.textoSecundario,
  },
  vacio: {
    flex: 1,
    padding: 16,
    gap: 16,
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  vacioTexto: {
    fontSize: 15,
    textAlign: "center",
    color: paletaPublicacion.textoSecundario,
  },
});
