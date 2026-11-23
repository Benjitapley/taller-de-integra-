import React, { useRef } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { CustomButton } from "@/components/CustomButton";
import { CustomInput } from "@/components/CustomInput";
import { InterruptorFormulario } from "@/components/publicaciones/InterruptorFormulario";
import { PasoPublicacion } from "@/components/publicaciones/PasoPublicacion";
import { SelectorChips } from "@/components/publicaciones/SelectorChips";
import { SelectorTipoVivienda } from "@/components/publicaciones/SelectorTipoVivienda";
import { ENVIAR_DETALLE_MASCOTAS, ENVIAR_ENLACE_REFERENCIA } from "@/constants/camposPublicacion";
import { MAX_CARACTERES_CONDICIONES_MASCOTAS, OPCIONES_MASCOTAS } from "@/constants/mascotas";
import { paletaPublicacion, textosFormularioPorOrigen } from "@/constants/origenPublicacion";
import { colors } from "@/theme/colors";
import type {
  ErroresFormularioPublicacion,
  FormularioPublicacionValores,
  TipoMascota,
} from "@/types/Publicacion";

interface FormularioPublicacionProps {
  valores: FormularioPublicacionValores;
  errores?: ErroresFormularioPublicacion;
  onCambiar: <K extends keyof FormularioPublicacionValores>(
    campo: K,
    valor: FormularioPublicacionValores[K],
  ) => void;
  onContinuar: () => void;
}

const soloDigitos = (texto: string) => texto.replace(/\D/g, "");

const formatearMiles = (digitos: string) =>
  digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export const FormularioPublicacion: React.FC<
  FormularioPublicacionProps
> = ({ valores, errores = {}, onCambiar, onContinuar }) => {
  const textos = textosFormularioPorOrigen[valores.tipo];
  const scrollRef = useRef<ScrollView>(null);

  const bajarAlFinal = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 250);
  };

  // Agrega el tipo si no estaba y lo quita si ya estaba elegido.
  const alternarMascota = (tipo: TipoMascota) => {
    const elegidos = valores.tiposMascotas;
    onCambiar(
      "tiposMascotas",
      elegidos.includes(tipo) ? elegidos.filter((t) => t !== tipo) : [...elegidos, tipo],
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.pantalla}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.contenedor}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.encabezado}>
          <Text style={styles.titulo}>{textos.tituloPantalla}</Text>
          <View style={styles.paso}>
            <PasoPublicacion paso={1} etiqueta="Información" />
          </View>
        </View>

        <View style={styles.campos}>
          <CustomInput
            etiqueta="Título de publicación"
            icono="pricetag-outline"
            mostrarIconoInterior={false}
            value={valores.titulo}
            onChangeText={(t) => onCambiar("titulo", t)}
            placeholder={textos.placeholderTitulo}
            maxLength={80}
            error={errores.titulo}
          />

          <SelectorTipoVivienda
            valor={valores.tipoVivienda}
            onCambiar={(v) => onCambiar("tipoVivienda", v)}
            error={errores.tipoVivienda}
          />

          <CustomInput
            etiqueta="Precio mensual por persona (CLP)"
            icono="cash-outline"
            mostrarIconoInterior={false}
            value={formatearMiles(valores.precio)}
            onChangeText={(t) => onCambiar("precio", soloDigitos(t))}
            placeholder="190.000"
            keyboardType="number-pad"
            maxLength={9}
            error={errores.precio}
          />

          <CustomInput
            etiqueta="Comuna o sector"
            icono="location-outline"
            mostrarIconoInterior={false}
            value={valores.ubicacion}
            onChangeText={(t) => onCambiar("ubicacion", t)}
            placeholder="Temuco Centro"
            autoCapitalize="words"
            error={errores.ubicacion}
          />

          <CustomInput
            etiqueta="Cupos disponibles"
            icono="people-outline"
            mostrarIconoInterior={false}
            value={valores.cupos}
            onChangeText={(t) => onCambiar("cupos", soloDigitos(t))}
            placeholder="1"
            keyboardType="number-pad"
            maxLength={2}
            error={errores.cupos}
          />

          <CustomInput
            etiqueta="Descripción"
            icono="document-text-outline"
            mostrarIconoInterior={false}
            value={valores.descripcion}
            onChangeText={(t) => onCambiar("descripcion", t)}
            placeholder="Describe el lugar y la convivencia..."
            multilinea
            maxLength={500}
            error={errores.descripcion}
            onFocus={bajarAlFinal}
          />

          <InterruptorFormulario
            etiqueta="¿Se aceptan mascotas?"
            icono="paw-outline"
            valor={valores.aceptaMascotas}
            onCambiar={(v) => onCambiar("aceptaMascotas", v)}
          />

          {valores.aceptaMascotas && ENVIAR_DETALLE_MASCOTAS && (
            <>
              <SelectorChips
                etiqueta="¿Qué animales se aceptan?"
                iconoEtiqueta="paw-outline"
                ayuda="Puedes elegir más de uno."
                opciones={OPCIONES_MASCOTAS}
                seleccionados={valores.tiposMascotas}
                onAlternar={alternarMascota}
                error={errores.tiposMascotas}
              />

              <CustomInput
                etiqueta={
                  valores.tiposMascotas.includes("otro")
                    ? "Condiciones para mascotas"
                    : "Condiciones para mascotas (opcional)"
                }
                icono="reader-outline"
                mostrarIconoInterior={false}
                value={valores.condicionesMascotas}
                onChangeText={(t) => onCambiar("condicionesMascotas", t)}
                placeholder={
                  valores.tiposMascotas.includes("otro")
                    ? "Indica qué otro animal se acepta"
                    : "Ej: máximo una mascota por persona"
                }
                multilinea
                maxLength={MAX_CARACTERES_CONDICIONES_MASCOTAS}
                error={errores.condicionesMascotas}
                onFocus={bajarAlFinal}
              />
            </>
          )}

          <InterruptorFormulario
            etiqueta="Permitir comentarios"
            icono="chatbubble-ellipses-outline"
            descripcion="Otras personas podrán comentar en tu publicación."
            valor={valores.permitirComentarios}
            onCambiar={(v) => onCambiar("permitirComentarios", v)}
          />

          {textos.mostrarEnlace && ENVIAR_ENLACE_REFERENCIA && (
            <CustomInput
              etiqueta="Enlace de referencia (opcional)"
              icono="link-outline"
              mostrarIconoInterior={false}
              value={valores.enlaceReferencia}
              onChangeText={(t) => onCambiar("enlaceReferencia", t)}
              placeholder="Pega un enlace solo si quieres"
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              error={errores.enlaceReferencia}
              onFocus={bajarAlFinal}
            />
          )}

          {textos.nota && (
            <View style={styles.nota}>
              <Text style={styles.notaTexto}>{textos.nota}</Text>
            </View>
          )}
        </View>
        <CustomButton
          titulo="Continuar"
          iconoDerecho="arrow-forward"
          onPress={onContinuar}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contenedor: {
    padding: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
  encabezado: {
    marginBottom: 20,
  },
  titulo: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.primary,
  },
  paso: {
    marginTop: 6,
  },
  campos: {
    width: "100%",
  },
  nota: {
    padding: 12,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: paletaPublicacion.fondoSuave,
  },
  notaTexto: {
    fontSize: 12,
    color: paletaPublicacion.textoSecundario,
  },
});
