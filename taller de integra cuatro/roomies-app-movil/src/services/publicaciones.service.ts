import { adaptarListaPublicaciones } from '@/adapters/publicacionAdapter';
import { publicacionesMock } from '@/mocks/publicaciones';

export async function obtenerPublicaciones() {
  // TODO: Descomentar esto cuando el backend confirme la ruta exacta
  /*
  try {
    const respuesta = await fetch('https://roomies-scrum83-api-gateway.onrender.com/LA_RUTA_FALTANTE');
    const datosCrudos = await respuesta.json();
    return adaptarListaPublicaciones(datosCrudos);
  } catch (error) {
    console.error('Error:', error);
    return [];
  }
  */

  // MOCK DATA: Datos simulados para avanzar con la tarea M4-B08
  return publicacionesMock;
}