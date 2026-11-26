import type { PublicationError } from "./validation";
import styles from "./publicaciones.module.css";

const labels: Record<string, string> = {
  titulo: "Título", descripcion: "Descripción", precio: "Precio (CLP)", id_region: "Región",
  id_comuna: "Comuna", cupos_totales: "Capacidad total", imagenes: "Fotografías",
  imagenes_conservar: "Fotografías conservadas", reglas_arrendador: "Reglas del arrendador",
};

export default function PublicationErrorNotice({ error }: { error: PublicationError | null }) {
  return error && <div className={styles.formError} role="alert" data-error-code={error.codigo}>
    <p>{error.mensaje}</p>
    {!!error.detalles?.length && <ul>{error.detalles.map((detail, index) =>
      <li key={index}><strong>{labels[detail.campo] ?? detail.campo}:</strong> {detail.mensaje}</li>)}</ul>}
  </div>;
}
