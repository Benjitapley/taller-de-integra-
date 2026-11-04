import { adaptarListaPublicaciones } from "@/adapters/publicacionAdapter";
import { publicacionesMock } from '@/mocks/publicaciones'; // Asegúrate de que esta ruta sea correcta
import type { Publicacion } from "@/types/Publicacion";

export interface FiltrosArriendo {
  precioMin?: number;
  precioMax?: number;
  comuna?: string;
  habitaciones?: number;
}

export async function obtenerPublicaciones(filtros?: FiltrosArriendo) {
  const baseUrl = 'https://roomies-scrum83-api-gateway.onrender.com';
  const queryParams = new URLSearchParams();

  // Construimos los query parameters si vienen filtros
  if (filtros) {
    if (filtros.precioMin) queryParams.append('precioMin', filtros.precioMin.toString());
    if (filtros.precioMax) queryParams.append('precioMax', filtros.precioMax.toString());
    if (filtros.comuna) queryParams.append('comuna', filtros.comuna);
    if (filtros.habitaciones) queryParams.append('habitaciones', filtros.habitaciones.toString());
  }

  const stringParams = queryParams.toString();
  const urlFinal = stringParams ? `${baseUrl}?${stringParams}` : baseUrl;

  // ==========================================
  // 1. CÓDIGO REAL (Comentado hasta que la API esté lista con los filtros)
  // ==========================================
  /*
  try {
    const respuesta = await fetch(urlFinal);
    const datosCrudos = await respuesta.json();
    
    const datosLimpios = adaptarListaPublicaciones(datosCrudos);
    return datosLimpios;
  } catch (error) {
    console.error('Error al obtener publicaciones:', error);
    return [];
  }
  */

  // ==========================================
  // 2. MOCK TEMPORAL 
  // ==========================================
  let resultados = [...publicacionesMock];

  if (filtros) {
    if (filtros.precioMin) resultados = resultados.filter(p => p.precio >= filtros.precioMin!);
    if (filtros.precioMax) resultados = resultados.filter(p => p.precio <= filtros.precioMax!);
    if (filtros.comuna) {
      resultados = resultados.filter(p => 
        p.ubicacion?.toLowerCase().includes(filtros.comuna!.toLowerCase())
      );
    }
  }

  return resultados;
}


export async function obtenerPublicacionPorId(id: string | number): Promise<Publicacion | null> {
  // 1. CÓDIGO REAL (Comentado hasta integración del endpoint real)
  /*
  try {
    const baseUrl = 'https://roomies-scrum83-api-gateway.onrender.com';
    const respuesta = await fetch(`${baseUrl}/publicaciones/${id}`);
    
    if (!respuesta.ok) return null;
    
    const datosCrudos = await respuesta.json();
    return adaptarPublicacion(datosCrudos);
  } catch (error) {
    console.error(`Error al obtener la publicación ${id}:`, error);
    return null;
  }
  */

  // 2. MOCK TEMPORAL (Activo mientras se habilita el backend)
  const idNumerico = Number(id);
  const encontrada = publicacionesMock.find((p) => p.idPublicacion === idNumerico);
  
  return encontrada || null;
}