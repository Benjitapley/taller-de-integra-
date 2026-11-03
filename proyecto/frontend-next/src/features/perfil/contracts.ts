/** Public web shape. Identity always comes from the server session. */
export type Profile = {
  nombre: string;
  edad: number | null;
  ocupacion: string | null;
  ciudad: string | null;
  breve_descripcion: string | null;
  sobre_mi: string | null;
  foto_perfil: string | null;
  total_publicaciones: number;
  verificado: boolean | null;
};
