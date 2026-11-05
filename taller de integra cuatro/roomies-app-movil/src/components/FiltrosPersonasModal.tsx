import React, { useState } from 'react';
import { Modal, View, Text, TextInput, Switch, StyleSheet, TouchableOpacity } from 'react-native';
import type { FiltrosPersona } from '../types/Usuario';
import { colors } from '../theme/colors';

interface Props {
    visible: boolean;
    onClose: () => void;
    filtrosActuales: FiltrosPersona;
    onAplicar: (filtros: FiltrosPersona) => void;
}

export default function FiltrosPersonasModal({ visible, onClose, filtrosActuales, onAplicar }: Props) {
    const [filtros, setFiltros] = useState<FiltrosPersona>(filtrosActuales);

    const aplicar = () => {
        onAplicar(filtros);
        onClose();
    };

  return (
        <Modal visible={visible} animationType="slide" transparent={true}>
            <View style={styles.overlay}>
                <View style={styles.modalBody}>
                    <Text style={styles.titulo}>Filtros de Búsqueda</Text>

                    <Text style={styles.label}>Zona de interés</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Ej. Providencia"
                        value={filtros.zonaInteres || ''}
                        onChangeText={(text) => setFiltros({ ...filtros, zonaInteres: text })}
                    />

                    <Text style={styles.label}>Presupuesto Máximo (CLP)</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Ej. 300000"
                        keyboardType="numeric"
                        value={filtros.presupuestoMaximo?.toString() || ''}
                        onChangeText={(text) => setFiltros({ ...filtros, presupuestoMaximo: Number(text) || undefined })}
                    />

                    <View style={styles.filaSwitch}>
                        <Text style={styles.labelSwitch}>Solo cuentas verificadas</Text>
                        <Switch
                            value={filtros.soloVerificados || false}
                            onValueChange={(val) => setFiltros({ ...filtros, soloVerificados: val })}
                            trackColor={{ true: colors.success }}
                        />
                    </View>

                    <View style={styles.footerBotones}>
                        <TouchableOpacity onPress={onClose} style={styles.botonCancelar}>
                            <Text style={styles.textoCancelar}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={aplicar} style={styles.botonAplicar}>
                            <Text style={styles.textoAplicar}>Aplicar Filtros</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalBody: { backgroundColor: 'white', padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
    titulo: { fontSize: 20, fontWeight: '700', marginBottom: 20 },
    label: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 16 },
    input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
    filaSwitch: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 24 },
    labelSwitch: { fontSize: 16, fontWeight: '500' },
    footerBotones: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
    botonCancelar: { padding: 14, flex: 1, alignItems: 'center' },
    textoCancelar: { color: '#666', fontWeight: '600', fontSize: 16 },
    botonAplicar: { padding: 14, flex: 1, backgroundColor: '#007AFF', borderRadius: 8, alignItems: 'center' },
    textoAplicar: { color: 'white', fontWeight: '600', fontSize: 16 }
});