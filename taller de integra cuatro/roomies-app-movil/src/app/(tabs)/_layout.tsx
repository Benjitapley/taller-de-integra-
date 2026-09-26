import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

const COLOR_ACTIVO = "#4F46E5";
const COLOR_INACTIVO = "#666";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLOR_ACTIVO,
        tabBarInactiveTintColor: COLOR_INACTIVO,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? "home" : "home-outline"} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="buscar"
        options={{
          title: "Buscar",
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? "search" : "search-outline"} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="publicar"
        options={{
          title: "Publicar",
          // En el mockup este ícono siempre se ve resaltado (círculo relleno,
          // color de marca), sin importar si la tab está activa o no.
          tabBarIcon: ({ size }) => (
            <Ionicons name="add-circle" color={COLOR_ACTIVO} size={size + 10} />
          ),
        }}
      />
      <Tabs.Screen
        name="mensajes"
        options={{
          title: "Mensajes",
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? "chatbubble" : "chatbubble-outline"} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? "person" : "person-outline"} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
