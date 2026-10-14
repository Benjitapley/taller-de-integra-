import React, { useRef } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { CustomButton } from "@/components/CustomButton";
import { CustomInput } from "@/components/CustomInput";
import { paletaPublicacion, textosFormularioPorOrigen } from "@/constants/origenPublicacion";
import { colors } from "@/theme/colors";
import type { FormularioPublicacionValores } from "@/types/Publicacion";

interface FormularioPublicacionProps {
  valores: FormularioPublicacionValores;
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
> = ({ valores, onCambiar, onContinuar }) => {
  const textos = textosFormularioPorOrigen[valores.tipo];
  const scrollRef = useRef<ScrollView>(null);

  const bajarAlFinal = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 250);
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
          />

          <CustomInput
            etiqueta="Comuna o sector"
            icono="location-outline"
            mostrarIconoInterior={false}
            value={valores.ubicacion}
            onChangeText={(t) => onCambiar("ubicacion", t)}
            placeholder="Temuco Centro"
            autoCapitalize="words"
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
            onFocus={bajarAlFinal}
          />

          {textos.mostrarEnlace && (
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