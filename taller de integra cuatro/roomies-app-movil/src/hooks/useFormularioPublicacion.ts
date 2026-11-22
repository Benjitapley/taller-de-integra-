import { useState } from "react";
import { ENVIAR_DETALLE_MASCOTAS } from "@/constants/camposPublicacion";
import { MAX_CARACTERES_CONDICIONES_MASCOTAS } from "@/constants/mascotas";
import {
  formularioPublicacionInicialConOrigen,
  type ErroresFormularioPublicacion,
  type FormularioPublicacionValores,
  type TipoPublicacion,
} from "@/types/Publicacion";

// Solo campos obligatorios y formato. Las reglas de negocio (el límite
// de cupos activo, etc.) son del backend y no se codifican en el frontend.

const SOLO_DIGITOS = /^\d+$/;
const ENLACE_HTTP = /^https?:\/\/[^\s/?#]+\.[^\s/?#]+([/?#]\S*)?$/i;

export function validarFormularioPublicacion(valores: FormularioPublicacionValores): ErroresFormularioPublicacion {
  const errores: ErroresFormularioPublicacion = {};

  if (!valores.titulo.trim()) {
    errores.titulo = "Ingresa un título.";
  }

  const precio = valores.precio.trim();
  if (!precio) {
    errores.precio = "Ingresa el precio mensual.";
  } else if (!SOLO_DIGITOS.test(precio) || Number(precio) <= 0) {
    errores.precio = "Ingresa un precio mayor a 0.";
  }

  if (!valores.ubicacion.trim()) {
    errores.ubicacion = "Ingresa la comuna o sector.";
  }

  if (!valores.tipoVivienda) {
    errores.tipoVivienda = "Elige el tipo de vivienda.";
  }

  const cupos = valores.cupos.trim();
  if (!cupos) {
    errores.cupos = "Ingresa los cupos disponibles.";
  } else if (!SOLO_DIGITOS.test(cupos) || Number(cupos) < 1) {
    errores.cupos = "Ingresa al menos 1 cupo.";
  }

  if (!valores.descripcion.trim()) {
    errores.descripcion = "Agrega una descripción.";
  }

  // El enlace es opcional y solo existe en Compartida: si se escribe, debe tener
  // el formato de un enlace, si está vacío no da error.
  const enlace = valores.enlaceReferencia.trim();
  if (valores.tipo === "Compartida" && enlace && !ENLACE_HTTP.test(enlace)) {
    errores.enlaceReferencia =
      "Ingresa un enlace válido que empiece con http:// o https://.";
  }

  // Preferencias de mascotas: solo se revisan si se aceptan. Son las mismas
  // exigencias de la API (al menos un tipo; "otro" pide aclarar cuál).
  // Si el detalle está oculto (ENVIAR_DETALLE_MASCOTAS en false), no se exige: la
  // persona no tiene cómo llenarlo.
  if (valores.aceptaMascotas && ENVIAR_DETALLE_MASCOTAS) {
    if (valores.tiposMascotas.length === 0) {
      errores.tiposMascotas = "Elige al menos un tipo de mascota.";
    } else if (
      valores.tiposMascotas.includes("otro") &&
      !valores.condicionesMascotas.trim()
    ) {
      errores.condicionesMascotas = "Indica qué otro animal se acepta.";
    }
    if (valores.condicionesMascotas.length > MAX_CARACTERES_CONDICIONES_MASCOTAS) {
      errores.condicionesMascotas = `Máximo ${MAX_CARACTERES_CONDICIONES_MASCOTAS} caracteres.`;
    }
  }

  return errores;
}

export function useFormularioPublicacion(tipo: TipoPublicacion) {
  const [valores, setValores] = useState<FormularioPublicacionValores>(() =>
    formularioPublicacionInicialConOrigen(tipo),
  );
  
  const [errores, setErrores] = useState<ErroresFormularioPublicacion>({});

  function cambiarCampo<K extends keyof FormularioPublicacionValores>(
    campo: K,
    valor: FormularioPublicacionValores[K],
  ) {
    setValores((anterior) => ({ ...anterior, [campo]: valor }));
    // Al editar un campo se limpia su error, y el de los campos que dependen de él.
    setErrores((anterior) => ({
      ...anterior,
      [campo]: undefined,
      ...(campo === "aceptaMascotas"
        ? { tiposMascotas: undefined, condicionesMascotas: undefined }
        : {}),
      ...(campo === "tiposMascotas" ? { condicionesMascotas: undefined } : {}),
    }));
  }

  // Devuelve true si el formulario es válido; si no, deja los errores en pantalla.
  function validarFormulario(): boolean {
    const nuevos = validarFormularioPublicacion(valores);
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  }

  return { valores, errores, cambiarCampo, validarFormulario };
}
