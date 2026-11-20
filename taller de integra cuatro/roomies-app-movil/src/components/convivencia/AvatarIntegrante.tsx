import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

type Props = {
  nombre: string;
  fotoUrl: string | null;
  tamano?: number;
  conBorde?: boolean;
};

export default function AvatarIntegrante({ nombre, fotoUrl, tamano = 34, conBorde = false }: Props) {
  const [urlFallida, setUrlFallida] = useState<string | null>(null);
  const forma = { width: tamano, height: tamano, borderRadius: tamano / 2 };
  const borde = conBorde ? styles.borde : null;

  if (fotoUrl && fotoUrl !== urlFallida) {
    return (
      <Image
        source={{ uri: fotoUrl }}
        style={[forma, borde]}
        onError={() => setUrlFallida(fotoUrl)}
        accessibilityIgnoresInvertColors
      />
    );
  }

  const inicial = nombre.trim().charAt(0).toUpperCase() || "?";
  return (
    <View style={[styles.inicial, forma, borde]}>
      <Text style={[styles.inicialTexto, { fontSize: Math.max(11, Math.round(tamano * 0.4)) }]}>{inicial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  inicial: { backgroundColor: "#C7D2FE", alignItems: "center", justifyContent: "center" },
  inicialTexto: { fontWeight: "700", color: "#3730A3" },
  borde: { borderWidth: 2, borderColor: "#fff" },
});
