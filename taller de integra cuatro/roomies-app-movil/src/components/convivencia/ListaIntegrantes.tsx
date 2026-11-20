import { StyleSheet, Text, View } from "react-native";
import AvatarIntegrante from "@/components/convivencia/AvatarIntegrante";
import type { IntegranteArriendoVista } from "@/types/Arriendo";

// Integrantes activos del arriendo y ocupación de cupos, según la API.

type Props = {
  /** null = la API todavía no entrega la lista de integrantes (distinto de una lista vacía). */
  integrantes: IntegranteArriendoVista[] | null;
  /** Integrantes activos y cupos totales informados por el arriendo. */
  integrantesActivos: number;
  cuposTotales: number;
  /** La lista quedó incompleta por el tope de páginas. */
  parcial?: boolean;
};

function etiquetaAccesible(integrante: IntegranteArriendoVista): string {
  const partes = [integrante.nombre];
  if (integrante.esResponsable) partes.push("responsable");
  if (integrante.esPropio) partes.push("tú");
  return partes.join(", ");
}

export default function ListaIntegrantes({ integrantes, integrantesActivos, cuposTotales, parcial = false }: Props) {
  return (
    <View style={styles.tarjeta}>
      <View style={styles.encabezado}>
        <Text style={styles.titulo}>Integrantes</Text>
        <Text style={styles.contador}>{integrantesActivos} de {cuposTotales}</Text>
      </View>

      {integrantes === null ? (
        <Text style={styles.vacio}>La lista de integrantes todavía no está disponible.</Text>
      ) : integrantes.length === 0 ? (
        <Text style={styles.vacio}>No hay integrantes para mostrar.</Text>
      ) : (
        integrantes.map((integrante) => (
          <View
            key={integrante.idUsuario}
            style={styles.fila}
            accessible
            accessibilityLabel={etiquetaAccesible(integrante)}
          >
            <AvatarIntegrante nombre={integrante.nombre} fotoUrl={integrante.fotoUrl} tamano={36} />
            <Text style={styles.nombre} numberOfLines={1}>{integrante.nombre}</Text>
            {integrante.esPropio ? (
              <View style={styles.chipPropio}><Text style={styles.chipPropioTexto}>Tú</Text></View>
            ) : null}
            {integrante.esResponsable ? (
              <View style={styles.chipRol}><Text style={styles.chipRolTexto}>Responsable</Text></View>
            ) : null}
          </View>
        ))
      )}

      {parcial && integrantes !== null ? (
        <Text style={styles.nota}>Mostrando los primeros {integrantes.length} integrantes.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    gap: 8,
  },
  encabezado: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  titulo: { fontSize: 15, fontWeight: "700", color: "#111827" },
  contador: { fontSize: 12, color: "#6B7280", fontWeight: "600" },
  vacio: { fontSize: 13, color: "#9CA3AF" },
  fila: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  nombre: { flex: 1, fontSize: 14, fontWeight: "600", color: "#111827" },
  chipPropio: { backgroundColor: "#ECFDF5", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  chipPropioTexto: { fontSize: 11, color: "#047857", fontWeight: "700" },
  chipRol: { backgroundColor: "#EEF2FF", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  chipRolTexto: { fontSize: 11, color: "#4F46E5", fontWeight: "700" },
  nota: { fontSize: 12, color: "#9CA3AF" },
});
