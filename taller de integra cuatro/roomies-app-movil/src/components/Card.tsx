import React from 'react';
import { View, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';

interface CardProps {
    children: React.ReactNode;
    onPress?: () => void;
    style?: StyleProp<ViewStyle>;
}

export const Card: React.FC<CardProps> = ({ children, onPress, style }) => {
    if (onPress) {
        return (
            <TouchableOpacity 
                onPress={onPress} 
                activeOpacity={0.85}
                style={[styles.base, style]}
            >
                {children}
            </TouchableOpacity>
        );
    }

    return <View style={[styles.base, style]}>{children}</View>;
};

const styles = StyleSheet.create({
    base: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
});