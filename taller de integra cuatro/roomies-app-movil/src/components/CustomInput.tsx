import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

interface CustomInputProps extends TextInputProps {
    etiqueta: string;
    icono: keyof typeof Ionicons.glyphMap;
    esContrasena?: boolean;
    error?: string;
}

export const CustomInput: React.FC<CustomInputProps> = ({
    etiqueta,
    icono,
    esContrasena = false,
    error,
    ...rest 
}) => {
    const [mostrarContrasena, setMostrarContrasena] = useState(false);

    return (
        <View style={styles.contenedor}>
            <Text style={styles.etiqueta}>{etiqueta}</Text>
            <View style={[styles.inputWrapper, error && styles.inputWrapperError]}>
                <Ionicons name={icono} size={18} color={colors.border} style={styles.icono} />
                <TextInput
                    style={styles.input}
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={esContrasena && !mostrarContrasena}
                    {...rest}
                />
                {esContrasena && (
                    <TouchableOpacity onPress={() => setMostrarContrasena(!mostrarContrasena)}>
                        <Ionicons
                            name={mostrarContrasena ? 'eye-off-outline' : 'eye-outline'}
                            size={18}
                            color={colors.border}
                        />
                    </TouchableOpacity>
                )}
            </View>
            {error && <Text style={styles.textoError}>{error}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    contenedor: {
        marginBottom: 16,
        width: '100%',
    },
    etiqueta: {
        fontSize: 13,
        fontWeight: '600',
        color: '#2D2D2D',
        marginBottom: 6,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 46,
        backgroundColor: colors.background,
    },
    inputWrapperError: {
        borderColor: colors.warning,
    },
    icono: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        fontSize: 14,
        color: '#2D2D2D',
    },
    textoError: {
        fontSize: 12,
        color: colors.warning,
        marginTop: 4,
    },
});