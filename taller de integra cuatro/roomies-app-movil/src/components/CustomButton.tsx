import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '../theme/colors';

interface CustomButtonProps {
    titulo: string;
    onPress: () => void;
    variante?: 'solido' | 'contorno';
    cargando?: boolean;
    deshabilitado?: boolean;
}

export const CustomButton: React.FC<CustomButtonProps> = ({
    titulo,
    onPress,
    variante = 'solido',
    cargando = false,
    deshabilitado = false,
}) => {
    const esSolido = variante === 'solido';
    return (
        <TouchableOpacity
            style={[
                styles.base,
                esSolido ? styles.solido : styles.contorno,
                deshabilitado && styles.deshabilitado,
            ]}
            onPress={onPress}
            disabled={deshabilitado || cargando}
            activeOpacity={0.8}
        >
            {cargando ? (
                <ActivityIndicator color={esSolido? colors.background : colors.primary} />
            ) : (
                <Text style={[styles.texto, esSolido ? styles.textoSolido : styles.textoContorno]}>
                    {titulo}
                </Text>

            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    base: {
        height: 48,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        width: '100%',
    },
    solido: {
        backgroundColor: colors.primary
    },
    contorno: {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
    },
    deshabilitado: {
        opacity: 0.5,
    },
    texto: {
        fontSize: 16,
        fontWeight: 600,
    },
    textoSolido: {
        color: colors.background,
    },
    textoContorno: {
        color: colors.primary,
    },
});