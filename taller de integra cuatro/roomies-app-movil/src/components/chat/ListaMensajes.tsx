import { StyleSheet, Text } from "react-native";
import MensajeBurbuja from "@/components/chat/MensajeBurbuja";
import type { MensajeConvivencia } from "@/types/Convivencia";


type Props = {
  mensajes: MensajeConvivencia[];
};

export default function ListaMensajes({ mensajes }: Props) {
  return (
    <>
      <Text style={styles.divisorFecha}>Hoy</Text>
      {mensajes.map((mensaje) => (
        <MensajeBurbuja key={mensaje.id} mensaje={mensaje} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  divisorFecha: {
    alignSelf: "center",
    fontSize: 12,
    color: "#9CA3AF",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 6,
  },
});
