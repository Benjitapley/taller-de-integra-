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

// Parámetros para navegar al paso siguiente.
export function armarParametrosBorrador(
  valores: FormularioPublicacionValores,
): Record<string, string> {
  return { ...valores };
}

// Devuelve null si la ruta se abrió sin pasar por el formulario o con datos que
// no pasan la validación; la pantalla muestra entonces un estado vacío en vez
// de dibujar una publicación con NaN o campos en blanco.
export function leerBorradorDesdeParams(
  params: ParametrosBorrador,
): FormularioPublicacionValores | null {
  const tipo = primero(params.tipo);
  if (!esOrigenValido(tipo)) return null;

  const valores: FormularioPublicacionValores = {
    tipo,
    titulo: primero(params.titulo),
    precio: primero(params.precio),
    ubicacion: primero(params.ubicacion),
    cupos: primero(params.cupos),
    descripcion: primero(params.descripcion),
    enlaceReferencia: primero(params.enlaceReferencia),
  };

  if (Object.keys(validarFormularioPublicacion(valores)).length > 0) return null;

  return valores;
}
