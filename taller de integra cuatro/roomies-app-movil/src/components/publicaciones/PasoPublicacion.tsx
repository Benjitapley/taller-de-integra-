import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';

interface PasoPublicacionProps {
    paso: number;
    etiqueta: string;
    total?: number;
    // El mockup muestra la barra de avance en los pasos 1 y 2, y solo el texto en la vista previa.
    mostrarBarra?: boolean;
}

// "Paso 1 de 3 · Información" + barra de avance, como en m_form_compartida.
export const PasoPublicacion: React.FC<PasoPublicacionProps> = ({
    paso,
    etiqueta,
    total = 3,
    mostrarBarra = true,
}) => (
    <View>
        <Text style={styles.texto}>
            Paso {paso} de {total} · {etiqueta}
        </Text>
        {mostrarBarra ? (
            <View style={styles.pista}>
                <View style={[styles.relleno, { width: `${(paso / total) * 100}%` }]} />
            </View>
        ) : null}
    </View>
);

const styles = StyleSheet.create({
    texto: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.primary,
    },
    pista: {
        height: 6,
        marginTop: 10,
        borderRadius: 3,
        backgroundColor: '#EEEBFF',
        overflow: 'hidden',
    },
    relleno: {
        height: '100%',
        borderRadius: 3,
        backgroundColor: colors.primary,
    },
});
