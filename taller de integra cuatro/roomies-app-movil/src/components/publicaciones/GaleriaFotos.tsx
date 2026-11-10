import React, { useState } from 'react';
import {
    Image,
    type LayoutChangeEvent,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface GaleriaFotosProps {
    urls: string[];
    altura?: number;
}

// Fotos deslizables con el contador "1 / 3" del mockup de vista previa.
export const GaleriaFotos: React.FC<GaleriaFotosProps> = ({ urls, altura = 160 }) => {
    const [ancho, setAncho] = useState(0);
    const [indice, setIndice] = useState(0);

    const alMedir = (e: LayoutChangeEvent) => setAncho(e.nativeEvent.layout.width);

    const alDeslizar = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (!ancho) return;
        const nuevo = Math.round(e.nativeEvent.contentOffset.x / ancho);
        setIndice(Math.min(Math.max(nuevo, 0), urls.length - 1));
    };

    return (
        <View style={[styles.contenedor, { height: altura }]} onLayout={alMedir}>
            {ancho > 0 ? (
                <ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onScroll={alDeslizar}
                    scrollEventThrottle={16}
                >
                    {urls.map((uri) => (
                        <Image
                            key={uri}
                            source={{ uri }}
                            style={{ width: ancho, height: altura }}
                            resizeMode="cover"
                        />
                    ))}
                </ScrollView>
            ) : null}

            <View style={styles.contador} pointerEvents="none">
                <Ionicons name="images-outline" size={13} color="#FFFFFF" />
                <Text style={styles.contadorTexto}>
                    {indice + 1} / {urls.length}
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    contenedor: {
        width: '100%',
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: '#F3F1FF',
    },
    contador: {
        position: 'absolute',
        bottom: 8,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    contadorTexto: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});
