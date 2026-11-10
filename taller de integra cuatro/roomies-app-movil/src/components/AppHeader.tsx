import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";


const NOMBRE_APP = "Roomies";

type Props = {
  fotoUsuarioUrl?: string;
};

export default function AppHeader({ fotoUsuarioUrl }: Props) {
  return (
    <View style={styles.encabezado}>
      <View style={styles.izquierda}>
        <View style={styles.iconoCasa}>
          <Ionicons name="home" size={20} color="#4F46E5" />
        </View>
        <Text style={styles.titulo}>{NOMBRE_APP}</Text>
      </View>

      <Pressable onPress={() => router.push("/(tabs)/perfil")} hitSlop={8}>
        {fotoUsuarioUrl ? (
          <Image source={{ uri: fotoUsuarioUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={20} color="#4F46E5" />
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  encabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  izquierda: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconoCasa: {
    backgroundColor: "#EEF2FF",
    borderRadius: 8,
    padding: 6,
  },
  titulo: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  avatarPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
});
