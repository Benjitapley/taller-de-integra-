import { Stack, useRouter } from "expo-router";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FormularioPublicacion } from "@/components/publicaciones/FormularioPublicacion";
import { useFormularioPublicacion } from "@/hooks/useFormularioPublicacion";
import { colors } from "@/theme/colors";
import { armarParametrosBorrador } from "@/utils/borradorPublicacion";

export default function Arrendador() {
  const router = useRouter();

  // Se usa el mismo formulario que Compartida, solo cambia el origen, y los
  // textos y campos que muestra.
  const { valores, errores, cambiarCampo, validarFormulario } =
    useFormularioPublicacion("Arrendador");

  function continuar() {
    if (!validarFormulario()) return;
    // Paso 2 de 3: fotos. La vista previa viene después de las fotos.
    router.push({
      pathname: "/publicacion/crear/fotos",
      params: armarParametrosBorrador(valores),
    });
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
