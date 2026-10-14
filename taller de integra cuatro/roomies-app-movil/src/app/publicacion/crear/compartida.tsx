import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FormularioPublicacion } from "@/components/publicaciones/FormularioPublicacion";
import { colors } from "@/theme/colors";
import { formularioPublicacionInicialConOrigen, type FormularioPublicacionValores } from "@/types/Publicacion";

export default function Compartida() {
  const router = useRouter();
  const [valores, setValores] = useState<FormularioPublicacionValores>(() =>
    formularioPublicacionInicialConOrigen("Compartida"),
  );

  function cambiarCampo<K extends keyof FormularioPublicacionValores>(
    campo: K,
    valor: FormularioPublicacionValores[K],
  ) {
    setValores((anterior) => ({ ...anterior, [campo]: valor }));
  }

  function continuar() {
    Alert.alert(
      "Siguiente Paso: Vista Previa y Fotos",
      "Se habilitará en la tarea M4-C05.",
    );
  }

  const opcionesHeader = {
    headerShown: true,
    title: "Crear publicación",
    headerTintColor: colors.primary,
    headerShadowVisible: false,
    headerStyle: { backgroundColor: colors.background },
    headerLeft: () => (
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        hitSlop={12}
        accessibilityLabel="Volver"
        style={{ paddingHorizontal: 12 }}
      >
        <Ionicons name="arrow-back" size={24} color={colors.primary} />
      </Pressable>
    ),
  };

  return (
    <>
      <Stack.Screen options={opcionesHeader} />
      <FormularioPublicacion
        valores={valores}
        onCambiar={cambiarCampo}
        onContinuar={continuar}
      />
    </>
  );
}
