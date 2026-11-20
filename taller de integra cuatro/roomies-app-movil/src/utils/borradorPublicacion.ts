import { esTipoVivienda } from '@/constants/tipoVivienda';
import { validarFormularioPublicacion } from '@/hooks/useFormularioPublicacion';
import type {
  FormularioPublicacionValores,
  TipoPublicacion,
} from '@/types/Publicacion';

// El flujo Formulario → Fotos → Vista previa pasa los datos del formulario por
// parámetros de ruta (siempre llegan como texto). Este módulo es el único lugar
// que arma y lee esos parámetros, para que las tres pantallas no se desincronicen.
// Las fotos NO viajan por la ruta: ver utils/fotosBorrador.ts.

type ValorParametro = string | string[] | undefined;
export type ParametrosBorrador = Record<string, ValorParametro>;

const primero = (valor: ValorParametro): string =>
  (Array.isArray(valor) ? valor[0] : valor) ?? '';

const esOrigenValido = (tipo: string): tipo is TipoPublicacion =>
  tipo === 'Arrendador' || tipo === 'Compartida';

// Los parámetros de ruta son texto: los sí/no viajan como 'si'/'no'.

// Las reglas viajan como JSON; un valor roto equivale a "sin reglas".
function leerReglas(texto: string): string[] {
  if (!texto) return [];
  try {
    const lista: unknown = JSON.parse(texto);
    return Array.isArray(lista) ? lista.filter((r): r is string => typeof r === 'string') : [];
  } catch {
    return [];
  }
}

// Parámetros para navegar al paso siguiente.
export function armarParametrosBorrador(
  valores: FormularioPublicacionValores,
): Record<string, string> {
  return {
    tipo: valores.tipo,
    titulo: valores.titulo,
    precio: valores.precio,
    idRegion: valores.idRegion,
    idComuna: valores.idComuna,
    nombreRegion: valores.nombreRegion,
    nombreComuna: valores.nombreComuna,
    tipoVivienda: valores.tipoVivienda,
    cupos: valores.cupos,
    descripcion: valores.descripcion,
    enlaceReferencia: valores.enlaceReferencia,
    aceptaMascotas: valores.aceptaMascotas ? 'si' : 'no',
    permitirComentarios: valores.permitirComentarios ? 'si' : 'no',
    reglas: JSON.stringify(valores.reglas),
  };
}

// Devuelve null si la ruta se abrió sin pasar por el formulario o con datos que
// no pasan la validación; la pantalla muestra entonces un estado vacío en vez
// de dibujar una publicación con NaN o campos en blanco.
export function leerBorradorDesdeParams(
  params: ParametrosBorrador,
): FormularioPublicacionValores | null {
  const tipo = primero(params.tipo);
  if (!esOrigenValido(tipo)) return null;

  // Un valor desconocido se trata como "sin elegir": la validación lo rechaza.
  const tipoVivienda = primero(params.tipoVivienda);

  const valores: FormularioPublicacionValores = {
    tipo,
    titulo: primero(params.titulo),
    precio: primero(params.precio),
    idRegion: primero(params.idRegion),
    idComuna: primero(params.idComuna),
    nombreRegion: primero(params.nombreRegion),
    nombreComuna: primero(params.nombreComuna),
    tipoVivienda: esTipoVivienda(tipoVivienda) ? tipoVivienda : '',
    cupos: primero(params.cupos),
    descripcion: primero(params.descripcion),
    enlaceReferencia: primero(params.enlaceReferencia),
    aceptaMascotas: primero(params.aceptaMascotas) === 'si',
    permitirComentarios: primero(params.permitirComentarios) === 'si',
    reglas: leerReglas(primero(params.reglas)),
  };

  if (Object.keys(validarFormularioPublicacion(valores)).length > 0) return null;

  return valores;
}
