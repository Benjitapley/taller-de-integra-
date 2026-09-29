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
import AuthDivider from "@/components/AuthDivider";
import AuthFooter from "@/components/AuthFooter";
import { CustomButton } from "@/components/CustomButton";
import { CustomInput } from "@/components/CustomInput";
import { useAuth } from "@/hooks/useAuth";

export default function Login() {
  const { iniciarSesion } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function manejarInicioSesion() {
    setError("");

    if (!email.trim() || !password) {
      setError("Ingresa tu correo y contraseña.");
      return;
    }

    setCargando(true);
    const correcto = await iniciarSesion(email, password);
    setCargando(false);

    if (!correcto) {
      setError("El correo o la contraseña no son correctos.");
      return;
    }

    router.replace("/(tabs)");
  }

  function mostrarRecuperacion() {
    Alert.alert(
      "Recuperar contraseña",
      "Esta función se simula en MOB-05. En una versión conectada se enviaría un enlace al correo.",
    );
  }

  function continuarConGoogle() {
    Alert.alert(
      "Continuar con Google",
      "Inicio con Google simulado para validar la navegación de MOB-05.",
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
        <AuthBranding />

        <View style={styles.bienvenida}>
          <Text style={styles.titulo}>¡Bienvenido de vuelta!</Text>
          <View style={styles.subrayado} />
          <Text style={styles.descripcion}>
            Inicia sesión para continuar{"\n"}encontrando tu próximo hogar.
          </Text>
        </View>

        <View style={styles.formulario}>
          <CustomInput
            etiqueta="Correo electrónico"
            icono="person"
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

          <Pressable
            onPress={mostrarRecuperacion}
            style={styles.enlaceRecuperacion}
            hitSlop={8}
          >
            <Text style={styles.enlaceTexto}>¿Olvidaste tu contraseña?</Text>
          </Pressable>

          {error ? <Text style={styles.errorGeneral}>{error}</Text> : null}

          <CustomButton
            titulo="Iniciar sesión"
            iconoDerecho="arrow-forward"
            onPress={manejarInicioSesion}
            cargando={cargando}
          />

          <AuthDivider />

          <Pressable style={styles.botonGoogle} onPress={continuarConGoogle}>
            <Ionicons name="logo-google" size={21} color="#4285F4" />
            <Text style={styles.textoGoogle}>Continuar con Google</Text>
          </Pressable>

          <CustomButton
            titulo="Crear cuenta nueva"
            iconoIzquierdo="people"
            variante="contorno"
            onPress={() => router.push("/registro")}
          />
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
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: "center",
  },
  bienvenida: {
    width: "100%",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 20,
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
  enlaceRecuperacion: {
    alignSelf: "flex-end",
    marginTop: -4,
    marginBottom: 12,
  },
  enlaceTexto: {
    color: "#4B3FCA",
    fontSize: 13,
    fontWeight: "700",
  },
  errorGeneral: {
    color: "#B42318",
    fontSize: 13,
    marginBottom: 10,
    textAlign: "center",
  },
  botonGoogle: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D0D0D8",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 18,
    marginBottom: 12,
  },
  textoGoogle: {
    color: "#1F2937",
    fontSize: 16,
    fontWeight: "600",
  },
});
