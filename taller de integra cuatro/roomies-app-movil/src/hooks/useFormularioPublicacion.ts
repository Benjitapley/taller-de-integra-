import { useEffect, useRef, useState } from "react";
import {
  MAX_CARACTERES_DESCRIPCION,
  MAX_CARACTERES_REGLA,
  MAX_CARACTERES_TITULO,
  MAX_CUPOS_TOTALES,
  MAX_REGLAS_ARRENDADOR,
  PRECIO_MAXIMO,
} from "@/constants/contratoPublicacion";
import { useAuth } from "@/hooks/useAuth";
import {
  descartarBorradorPersistido,
  guardarValoresBorrador,
  leerBorradorPersistido,
} from "@/utils/borradorPersistente";
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
  } else if (valores.titulo.trim().length > MAX_CARACTERES_TITULO || valores.titulo.includes("\0")) {
    errores.titulo = `El título puede tener hasta ${MAX_CARACTERES_TITULO} caracteres.`;
  }

  // Contrato: CLP entero de 0 a 999.999.999.999 (el 0 es válido).
  const precio = valores.precio.trim();
  if (!precio) {
    errores.precio = "Ingresa el precio mensual.";
  } else if (!SOLO_DIGITOS.test(precio) || Number(precio) > PRECIO_MAXIMO) {
    errores.precio = "Ingresa un precio entre 0 y 999.999.999.999.";
  }

  if (!valores.idRegion) {
    errores.idRegion = "Elige la región.";
  }
  if (!valores.idComuna) {
    errores.idComuna = "Elige la comuna.";
  }

  if (!valores.tipoVivienda) {
    errores.tipoVivienda = "Elige el tipo de vivienda.";
  }

  const cupos = valores.cupos.trim();
  if (!cupos) {
    errores.cupos = "Ingresa los cupos totales.";
  } else if (!SOLO_DIGITOS.test(cupos) || Number(cupos) < 1 || Number(cupos) > MAX_CUPOS_TOTALES) {
    errores.cupos = `Ingresa un entero entre 1 y ${MAX_CUPOS_TOTALES.toLocaleString("es-CL")}.`;
  }

  if (!valores.descripcion.trim()) {
    errores.descripcion = "Agrega una descripción.";
  } else if (valores.descripcion.trim().length > MAX_CARACTERES_DESCRIPCION) {
    errores.descripcion = `La descripción puede tener hasta ${MAX_CARACTERES_DESCRIPCION} caracteres.`;
  }

  // El enlace es opcional y solo existe en Compartida: si se escribe, debe tener
  // el formato de un enlace, si está vacío no da error.
  const enlace = valores.enlaceReferencia.trim();
  if (valores.tipo === "Compartida" && enlace && !ENLACE_HTTP.test(enlace)) {
    errores.enlaceReferencia =
      "Ingresa un enlace válido que empiece con http:// o https://.";
  }

  // Reglas del arrendador (opcionales): hasta 20 textos de máximo 300 caracteres.
  if (valores.tipo === "Arrendador") {
    const reglas = valores.reglas.map((r) => r.trim()).filter(Boolean);
    if (reglas.length > MAX_REGLAS_ARRENDADOR) {
      errores.reglas = `Máximo ${MAX_REGLAS_ARRENDADOR} reglas.`;
    } else if (reglas.some((r) => r.length > MAX_CARACTERES_REGLA)) {
      errores.reglas = `Cada regla puede tener máximo ${MAX_CARACTERES_REGLA} caracteres.`;
    }
  }

  return errores;
}

// `valoresIniciales` activa el modo edición (M4S3-C02): el formulario parte de los datos
// de la publicación y NO lee ni guarda el borrador de creación (sin usuario, el
// borrador queda desactivado y el formulario se considera listo desde el inicio).
export function useFormularioPublicacion(
  tipo: TipoPublicacion,
  valoresIniciales?: FormularioPublicacionValores,
) {
  const { sesion } = useAuth();
  const enEdicion = valoresIniciales !== undefined;
  const idUsuario = enEdicion ? null : (sesion?.user.id ?? null);

  const [valores, setValores] = useState<FormularioPublicacionValores>(
    () => valoresIniciales ?? formularioPublicacionInicialConOrigen(tipo),
  );
  const [errores, setErrores] = useState<ErroresFormularioPublicacion>({});
  // El borrador guardado se aplica una sola vez y, hasta entonces, no se guarda nada
  // para no pisarlo con un formulario vacío. Sin sesión no hay borrador que esperar.
  const [borradorLeido, setBorradorLeido] = useState(false);
  const borradorListo = !idUsuario || borradorLeido;
  const [borradorRecuperado, setBorradorRecuperado] = useState(false);
  const huboCambios = useRef(false);

  useEffect(() => {
    if (!idUsuario) return;
    let vigente = true;
    leerBorradorPersistido(idUsuario).then((guardado) => {
      if (!vigente) return;
      // Solo se recupera si es del mismo origen y la persona no empezó a escribir.
      if (guardado && guardado.valores.tipo === tipo && !huboCambios.current) {
        setValores(guardado.valores);
        setBorradorRecuperado(true);
      }
      setBorradorLeido(true);
    });
    return () => {
      vigente = false;
    };
  }, [idUsuario, tipo]);

  // Guarda el borrador (con una pequeña espera) mientras se edita.
  useEffect(() => {
    if (!borradorListo || !idUsuario || !huboCambios.current) return;
    const espera = setTimeout(() => {
      guardarValoresBorrador(idUsuario, valores);
    }, 400);
    return () => clearTimeout(espera);
  }, [valores, borradorListo, idUsuario]);

  function cambiarCampo<K extends keyof FormularioPublicacionValores>(
    campo: K,
    valor: FormularioPublicacionValores[K],
  ) {
    huboCambios.current = true;
    setValores((anterior) => ({ ...anterior, [campo]: valor }));
    // Al editar un campo se limpia su error.
    setErrores((anterior) => ({ ...anterior, [campo]: undefined }));
  }

  // Cambia varios campos a la vez (región y comuna van juntas con sus nombres).
  // `automatico`: lo fija la app (región inicial) y no cuenta como edición de la
  // persona, así no se guarda un borrador que ella nunca escribió.
  function cambiarCampos(cambios: Partial<FormularioPublicacionValores>, automatico = false) {
    if (!automatico) huboCambios.current = true;
    setValores((anterior) => ({ ...anterior, ...cambios }));
    setErrores((anterior) => {
      const siguiente = { ...anterior };
      for (const campo of Object.keys(cambios) as (keyof FormularioPublicacionValores)[]) {
        siguiente[campo] = undefined;
      }
      return siguiente;
    });
  }

  // Descarta el borrador guardado y deja el formulario vacío.
  async function descartarBorrador() {
    if (idUsuario) await descartarBorradorPersistido(idUsuario);
    huboCambios.current = false;
    setValores(valoresIniciales ?? formularioPublicacionInicialConOrigen(tipo));
    setErrores({});
    setBorradorRecuperado(false);
  }

  // Devuelve true si el formulario es válido; si no, deja los errores en pantalla.
  function validarFormulario(): boolean {
    const nuevos = validarFormularioPublicacion(valores);
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  }

  return {
    valores,
    errores,
    cambiarCampo,
    cambiarCampos,
    validarFormulario,
    borradorListo,
    borradorRecuperado,
    descartarBorrador,
  };
}
