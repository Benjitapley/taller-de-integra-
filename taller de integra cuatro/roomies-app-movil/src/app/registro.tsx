import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
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
import { formatearFechaNacimiento, validarFechaNacimiento } from "@/utils/fechaNacimiento";
import { REQUISITOS_CONTRASENA, validarContrasena } from "@/utils/contrasena";

export default function Registro() {
  const { registrarCuenta } = useAuth();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [errorFecha, setErrorFecha] = useState("");
  const [password, setPassword] = useState("");
  const [errorPassword, setErrorPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [correoPendiente, setCorreoPendiente] = useState("");
  const enviando = useRef(false);

  async function crearCuenta() {
    if (enviando.current) return;
    setError("");
    setErrorFecha("");
    setErrorPassword("");

    if (!nombre.trim() || !email.trim() || !password || !confirmacion) {
      setError("Completa todos los campos.");
      return;
    }

    const resultadoFecha = validarFechaNacimiento(fechaNacimiento);
    if (!resultadoFecha.valido) {
      setErrorFecha(resultadoFecha.error);
      return;
    }

    const errorContrasena = validarContrasena(password);
    if (errorContrasena) {
      setErrorPassword(errorContrasena);
      return;
    }

    if (password !== confirmacion) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    enviando.current = true;
    setCargando(true);
    try {
      const resultado = await registrarCuenta({
        nombre,
        email,
        password,
        fechaNacimiento: resultadoFecha.fechaISO,
      });
      if (!resultado.exito) {
        setError(resultado.error);
        return;
      }

      setPassword("");
      setConfirmacion("");
      if (resultado.estado === "confirmacion_pendiente") {
        setCorreoPendiente(email.trim().toLowerCase());
      } else {
        router.replace("/(tabs)");
      }
    } catch {
      setError("No pudimos completar el registro. Inténtalo nuevamente.");
    } finally {
      enviando.current = false;
      setCargando(false);
    }
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
          <Text style={styles.titulo}>{correoPendiente ? "Revisa tu correo" : "¡Crea tu cuenta!"}</Text>
          <View style={styles.subrayado} />
          <Text style={styles.descripcion}>
            {correoPendiente
              ? "Confirma tu dirección para continuar."
              : "Regístrate para comenzar a\nencontrar tu próximo hogar."}
          </Text>
        </View>

        {correoPendiente ? (
          <View style={styles.confirmacion} accessibilityLiveRegion="polite">
            <Ionicons name="mail-outline" size={40} color="#4B3FCA" />
            <Text style={styles.mensajeConfirmacion}>
              Si {correoPendiente} puede registrarse, recibirás un enlace de confirmación.
              Revisa también la carpeta de spam. Todavía no has iniciado sesión.
            </Text>
            <Text style={styles.mensajeConfirmacion}>
              Si ya tenías una cuenta, puedes iniciar sesión con ella.
            </Text>
            <CustomButton titulo="Ir a iniciar sesión" onPress={() => router.replace("/login")} />
            <CustomButton
              titulo="Volver al formulario"
              variante="contorno"
              onPress={() => setCorreoPendiente("")}
            />
          </View>
        ) : (
          <View style={styles.formulario}>
            <CustomInput
              etiqueta="Nombre"
              icono="person"
              mostrarIconoInterior={false}
              value={nombre}
              onChangeText={setNombre}
              placeholder="Tu nombre"
              autoCapitalize="words"
              editable={!cargando}
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
              editable={!cargando}
            />

            <CustomInput
              etiqueta="Fecha de nacimiento"
              icono="calendar-outline"
              mostrarIconoInterior={false}
              value={fechaNacimiento}
              onChangeText={(valor) => {
                setFechaNacimiento(formatearFechaNacimiento(valor));
                setErrorFecha("");
              }}
              onBlur={() => {
                const resultado = validarFechaNacimiento(fechaNacimiento);
                setErrorFecha(resultado.valido ? "" : resultado.error);
              }}
              placeholder="DD/MM/AAAA"
              keyboardType="number-pad"
              maxLength={10}
              error={errorFecha}
              editable={!cargando}
            />

            <CustomInput
              etiqueta="Contraseña"
              icono="lock-closed"
              mostrarIconoInterior={false}
              value={password}
              onChangeText={(valor) => {
                setPassword(valor);
                setErrorPassword("");
                setError("");
              }}
              placeholder="••••••••"
              esContrasena
              autoCapitalize="none"
              autoCorrect={false}
              editable={!cargando}
              error={errorPassword}
              ayuda={REQUISITOS_CONTRASENA}
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
              autoCorrect={false}
              editable={!cargando}
            />

            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

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
        )}

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
  confirmacion: {
    width: "100%",
    maxWidth: 520,
    alignItems: "center",
    gap: 16,
    marginVertical: 16,
  },
  mensajeConfirmacion: {
    color: "#374151",
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
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
