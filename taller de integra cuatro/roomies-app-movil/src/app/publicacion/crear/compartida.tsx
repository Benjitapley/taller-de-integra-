import { Stack, useRouter } from "expo-router";
import { Text, View, StyleSheet, Pressable } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { colors } from "@/theme/colors";

export default function Compartida() {
  const router = useRouter();

  const opcionesHeader = {
        headerShown: true,
        title: 'Publicar',
        headerTintColor: colors.primary,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerLeft: () => (
            <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
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
      <Stack.Screen
        options={opcionesHeader}
      />
      <View style={styles.container}>
        <Text>Creación Publicación de Tipo Compartida</Text>
        <Text style={styles.nota}>Formulario Compartido (M4-C02) va aquí.</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  nota: { marginTop: 8, color: "#666" },
});
