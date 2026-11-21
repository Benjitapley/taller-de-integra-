/** Public web shape. Identity always comes from the server session. */
export type Profile = {
  edad_calculada?: boolean;
  contrato_perfil?: "v1";
  genero?: string | null;
  id_region_interes?: number | null;
  id_comuna_interes?: number | null;
  nombre: string;
  edad: number | null;
  ocupacion: string | null;
  ciudad: string | null;
  breve_descripcion: string | null;
  sobre_mi: string | null;
  foto_perfil: string | null;
  total_publicaciones: number | null;
  verificado: boolean | null;
};
