/** Read-only web shape. No identity parameter, credentials or editing contract. */
export type Profile = {
  nombre: string;
  edad: number | null;
  ocupacion: string | null;
  ciudad: string | null;
  breve_descripcion: string | null;
  sobre_mi: string | null;
  foto_perfil: string | null;
  total_publicaciones: number;
};
