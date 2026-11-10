import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/Card';
import { configPorOrigen, paletaPublicacion } from '@/constants/origenPublicacion';
import type { TipoPublicacion } from '@/types/Publicacion';

interface TipoPublicacionCardProps {
    tipo: TipoPublicacion;
    titulo: string;
    descripcion: string;
    onPress: () => void;
}

export const TipoPublicacionCard: React.FC<TipoPublicacionCardProps> = ({
    tipo,
    titulo,
    descripcion,
    onPress,
}) => {
    
    const { icono, color } = configPorOrigen[tipo];

    return (
        <Card onPress={onPress} style={styles.card}>
            <View
                style={styles.fila}
                accessible
                accessibilityRole="button"
                accessibilityLabel={`${titulo}. ${descripcion}`}
            >
                <View style={[styles.icono, { backgroundColor: color }]}>
                    <Ionicons name={icono} size={24} color="#FFFFFF" />
                </View>

                <View style={styles.textos}>
                    <Text style={styles.titulo}>{titulo}</Text>
                    <Text style={styles.descripcion}>{descripcion}</Text>
                </View>

                <Ionicons name="chevron-forward" size={22} color={paletaPublicacion.textoSecundario} />
            </View>
        </Card>
    );
};

const styles = StyleSheet.create({
    card: { padding: 18 },
    fila: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    icono: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textos: { flex: 1, gap: 4 },
    titulo: { fontSize: 17, fontWeight: '700', color: paletaPublicacion.textoPrincipal },
    descripcion: { fontSize: 14, lineHeight: 20, color: paletaPublicacion.textoSecundario },
});
