import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AuthBranding from "@/components/AuthBranding";
import AuthFooter from "@/components/AuthFooter";
import { CustomButton } from "@/components/CustomButton";
import { CustomInput } from "@/components/CustomInput";
import { useAuth } from "@/hooks/useAuth";

export default function Registro() {
  const { registrarCuenta } = useAuth();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function crearCuenta() {
    setError("");

    if (!nombre.trim() || !email.trim() || !password || !confirmacion) {
      setError("Completa todos los campos.");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== confirmacion) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setCargando(true);
    const creada = await registrarCuenta({ nombre, email, password });
    setCargando(false);

    if (!creada) {
      setError("Ya existe una cuenta con ese correo.");
      return;
    }

    Alert.alert(
      "Cuenta creada",
      "Tu cuenta de prueba fue creada correctamente.",
      [{ text: "Continuar", onPress: () => router.replace("/(tabs)") }],
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.pantalla}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.contenedor}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={styles.volver} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#4B3FCA" />
          <Text style={styles.volverTexto}>Volver</Text>
        </Pressable>

        <AuthBranding />

        <View style={styles.bienvenida}>
          <Text style={styles.titulo}>¡Crea tu cuenta!</Text>
          <View style={styles.subrayado} />
          <Text style={styles.descripcion}>
            Regístrate para comenzar a{"\n"}encontrar tu próximo hogar.
          </Text>
        </View>

        <View style={styles.formulario}>
          <CustomInput
            etiqueta="Nombre"
            icono="person"
            mostrarIconoInterior={false}
            value={nombre}
            onChangeText={setNombre}
            placeholder="Tu nombre"
            autoCapitalize="words"
          />

          <CustomInput
            etiqueta="Correo electrónico"
            icono="mail"
            mostrarIconoInterior={false}
            iconoDerecho="mail-outline"
            value={email}
            onChangeText={setEmail}
            placeholder="ejemplo@correo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <CustomInput
            etiqueta="Contraseña"
            icono="lock-closed"
            mostrarIconoInterior={false}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            esContrasena
            autoCapitalize="none"
          />

          <CustomInput
            etiqueta="Confirmar contraseña"
            icono="lock-closed"
            mostrarIconoInterior={false}
            value={confirmacion}
            onChangeText={setConfirmacion}
            placeholder="••••••••"
            esContrasena
            autoCapitalize="none"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <CustomButton
            titulo="Crear mi cuenta"
            iconoDerecho="arrow-forward"
            onPress={crearCuenta}
            cargando={cargando}
          />

          <View style={styles.yaTieneCuenta}>
            <Text style={styles.textoCuenta}>¿Ya tienes cuenta?</Text>
            <Pressable onPress={() => router.replace("/login")} hitSlop={8}>
              <Text style={styles.enlaceLogin}> Iniciar sesión</Text>
            </Pressable>
          </View>
        </View>

        <AuthFooter />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: "#F8F7FF",
  },
  contenedor: {
    paddingHorizontal: 28,
    paddingTop: 18,
    paddingBottom: 24,
    alignItems: "center",
  },
  volver: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 2,
  },
  volverTexto: {
    color: "#4B3FCA",
    fontSize: 14,
    fontWeight: "700",
  },
  bienvenida: {
    width: "100%",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  titulo: {
    color: "#4B3FCA",
    fontSize: 27,
    fontWeight: "800",
    textAlign: "center",
  },
  subrayado: {
    width: 120,
    height: 5,
    borderRadius: 5,
    backgroundColor: "#C8BFF2",
    marginTop: 5,
  },
  descripcion: {
    color: "#6B7280",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    marginTop: 9,
  },
  formulario: {
    width: "100%",
  },
  error: {
    color: "#B42318",
    fontSize: 13,
    textAlign: "center",
    marginTop: -2,
    marginBottom: 10,
  },
  yaTieneCuenta: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  textoCuenta: {
    color: "#6B7280",
    fontSize: 14,
  },
  enlaceLogin: {
    color: "#4B3FCA",
    fontSize: 14,
    fontWeight: "800",
  },
});
