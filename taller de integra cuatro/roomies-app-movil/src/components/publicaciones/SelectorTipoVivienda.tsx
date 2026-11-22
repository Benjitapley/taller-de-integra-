import React from "react";
import { SelectorOpciones } from "@/components/publicaciones/SelectorOpciones";
import { OPCIONES_TIPO_VIVIENDA } from "@/constants/tipoVivienda";
import type { TipoVivienda } from "@/types/Publicacion";

interface SelectorTipoViviendaProps {
  valor: TipoVivienda | "";
  onCambiar: (valor: TipoVivienda) => void;
  error?: string;
}

export const SelectorTipoVivienda: React.FC<SelectorTipoViviendaProps> = (props) => (
  <SelectorOpciones
    etiqueta="Tipo de vivienda"
    iconoEtiqueta="business-outline"
    opciones={OPCIONES_TIPO_VIVIENDA}
    {...props}
  />
);
