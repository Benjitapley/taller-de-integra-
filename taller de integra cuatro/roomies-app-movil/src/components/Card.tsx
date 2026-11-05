import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';

interface CardProps {
    children: React.ReactNode;
    onPress?: () => void;
    style?: ViewStyle;
}

export const Card: React.FC<CardProps> = ({ children, onPress, style }) => {
    const contenido = (
        <View style={[styles.base, style]}>
            {children}
        </View>
    );
    
    if (onPress) {
        return (
            <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
                {contenido}
            </TouchableOpacity>
        )
    }

    return contenido;
};

const styles = StyleSheet.create({
    base: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,

    },
});