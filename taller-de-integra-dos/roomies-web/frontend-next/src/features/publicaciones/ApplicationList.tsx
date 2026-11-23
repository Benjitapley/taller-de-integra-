export { useCursorList } from "../lists/useCursorList";
import type { Application } from "./application-contract";
export const applicationId = (application: Application) => application.id_postulacion;
