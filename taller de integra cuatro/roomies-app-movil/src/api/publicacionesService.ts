import { apiClient } from "./apiClient";
import { Publicacion } from '../data/mockPublications';


export const publicacionesService = {
    obtenerTodas: async (): Promise<Publicacion[]> => {
        try {
            const response = await apiClient.get<Publicacion[]>('/publicaciones');
            return response.data;
        } catch (error) {
            console.error('Error al obtener las publicaciones:', error);
            throw error;
        }
    },

    crear: async (nuevaPublicacion: Partial<Publicacion>) => {
        const response = await apiClient.post('/publicaciones', nuevaPublicacion);
        return response.data;
    }
};