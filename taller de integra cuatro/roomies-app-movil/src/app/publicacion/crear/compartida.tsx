import { Stack, useRouter } from "expo-router";
import { Alert, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FormularioPublicacion } from "@/components/publicaciones/FormularioPublicacion";
import { useFormularioPublicacion } from "@/hooks/useFormularioPublicacion";
import { colors } from "@/theme/colors";

export default function Compartida() {
  const router = useRouter();
  const { valores, errores, cambiarCampo, validarFormulario } =
    useFormularioPublicacion("Compartida");

  function continuar() {
    if (!validarFormulario()) return;
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
        errores={errores}
        onCambiar={cambiarCampo}
        onContinuar={continuar}
      />
    </>
  );
}
