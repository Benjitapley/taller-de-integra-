import { adaptarListaPublicaciones } from "@/adapters/publicacionAdapter";

export async function obtenerPublicaciones() {
  try {
    const respuesta = await fetch('https://roomies-scrum83-api-gateway.onrender.com');
    const datosCrudos = await respuesta.json();
    
    
    const datosLimpios = adaptarListaPublicaciones(datosCrudos);
    
    return datosLimpios;
  } catch (error) {
    console.error('Error al obtener publicaciones:', error);
    return [];
  }
}