import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { configPorEstadoPostulacion } from '@/constants/estadoPostulacion';
import { paletaPublicacion } from '@/constants/origenPublicacion';
import { colors } from '@/theme/colors';
import type { Postulacion } from '@/types/Postulacion';
import type { Publicacion } from '@/types/Publicacion';

interface PostulacionCardProps {
  postulacion: Postulacion;
  // Publicación a la que se postuló (opcional). Sin ella, la tarjeta usa el título
  // que informa el backend (`tituloPublicacion`) o avisa que no está disponible.
  publicacion?: Publicacion;
}

function formatoPrecio(precio: number): string {
  return `$${String(precio).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} CLP`;
}

// Tarjeta superior de "Mi postulación": foto, título,
// ubicación, precio e insignia con el estado. Es solo lectura.
export const PostulacionCard: React.FC<PostulacionCardProps> = ({ postulacion, publicacion }) => {
  const estado = configPorEstadoPostulacion[postulacion.estado];

  return (
    <View style={styles.card}>
      {publicacion?.imagenPrincipalUrl ? (
        <Image
          source={{ uri: publicacion.imagenPrincipalUrl }}
          style={styles.imagen}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.imagen, styles.imagenVacia]}>
          <Ionicons name="image-outline" size={28} color={colors.primary} />
        </View>
      )}

      <View style={styles.info}>
        {publicacion || postulacion.tituloPublicacion ? (
          <>
            <Text style={styles.titulo} numberOfLines={2}>
              {publicacion?.titulo ?? postulacion.tituloPublicacion}
            </Text>
            {publicacion ? (
              <Text style={styles.detalle} numberOfLines={2}>
                {publicacion.ubicacion} · {formatoPrecio(publicacion.precio)}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.tituloNoDisponible}>Publicación no disponible</Text>
        )}
        <View style={[styles.insignia, { backgroundColor: estado.fondo }]}>
          <Text style={[styles.insigniaTexto, { color: estado.color }]}>{estado.etiqueta}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 14,
  },
  imagen: {
    width: 96,
    height: 100,
    borderRadius: 12,
  },
  imagenVacia: {
    backgroundColor: paletaPublicacion.fondoSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  titulo: {
    fontSize: 17,
    fontWeight: '700',
    color: paletaPublicacion.textoPrincipal,
  },
  tituloNoDisponible: {
    fontSize: 16,
    fontWeight: '600',
    color: paletaPublicacion.textoSecundario,
  },
  detalle: {
    fontSize: 14,
    color: paletaPublicacion.textoSecundario,
    marginTop: 4,
  },
  insignia: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginTop: 10,
  },
  insigniaTexto: {
    fontSize: 12,
    fontWeight: '700',
  },
});
