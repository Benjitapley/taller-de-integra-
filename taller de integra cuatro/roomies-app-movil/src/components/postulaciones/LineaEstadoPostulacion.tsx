import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { pasosPorEstadoPostulacion, type MarcadorPaso } from '@/constants/estadoPostulacion';
import { paletaPublicacion } from '@/constants/origenPublicacion';
import { colors } from '@/theme/colors';
import type { EstadoPostulacion } from '@/types/Postulacion';

interface LineaEstadoPostulacionProps {
  estado: EstadoPostulacion;
}

const TEXTO_MARCADOR: Record<MarcadorPaso, string> = {
  hecho: 'completado',
  actual: 'en curso',
  inactivo: 'pendiente',
  rechazado: 'no seleccionada',
  cancelado: 'cancelada',
};

function Marcador({ tipo }: { tipo: MarcadorPaso }) {
  if (tipo === 'hecho') {
    return (
      <View style={[styles.marcador, styles.marcadorHecho]}>
        <Ionicons name="checkmark" size={20} color="#FFFFFF" />
      </View>
    );
  }
  if (tipo === 'rechazado') {
    return (
      <View style={[styles.marcador, styles.marcadorRechazado]}>
        <Ionicons name="close" size={20} color="#B91C1C" />
      </View>
    );
  }
  if (tipo === 'cancelado') {
    return (
      <View style={[styles.marcador, styles.marcadorCancelado]}>
        <Ionicons name="close" size={20} color="#4B5563" />
      </View>
    );
  }
  return (
    <View style={[styles.marcador, styles.marcadorClaro]}>
      <View style={tipo === 'actual' ? styles.anillo : styles.puntoTenue} />
    </View>
  );
}

// Línea de estado de la postulación. Solo muestra el estado que
// recibe, no hay ningún control que lo cambie.
export const LineaEstadoPostulacion: React.FC<LineaEstadoPostulacionProps> = ({ estado }) => (
  <View style={styles.contenedor}>
    {pasosPorEstadoPostulacion[estado].map((paso, indice) => (
      <View
        key={paso.titulo}
        style={[styles.fila, indice > 0 && styles.filaSiguiente]}
        accessible
        accessibilityLabel={`Paso ${indice + 1}, ${paso.titulo}, ${TEXTO_MARCADOR[paso.marcador]}. ${paso.descripcion}`}
      >
        <Marcador tipo={paso.marcador} />
        <View style={styles.textos}>
          <Text style={styles.titulo}>{paso.titulo}</Text>
          <Text style={styles.descripcion}>{paso.descripcion}</Text>
        </View>
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  contenedor: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filaSiguiente: {
    marginTop: 26,
  },
  marcador: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  marcadorHecho: {
    backgroundColor: colors.primary,
  },
  marcadorRechazado: {
    backgroundColor: '#FEE2E2',
  },
  marcadorCancelado: {
    backgroundColor: '#E5E7EB',
  },
  marcadorClaro: {
    backgroundColor: paletaPublicacion.fondoSuave,
  },
  anillo: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  puntoTenue: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#B9B2F0',
  },
  textos: {
    flex: 1,
  },
  titulo: {
    fontSize: 16,
    fontWeight: '700',
    color: paletaPublicacion.textoPrincipal,
  },
  descripcion: {
    fontSize: 14,
    color: paletaPublicacion.textoSecundario,
    marginTop: 2,
  },
});
