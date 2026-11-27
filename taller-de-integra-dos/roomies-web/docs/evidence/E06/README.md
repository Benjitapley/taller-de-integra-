# Evidencia E06 · 27/11/2026

Estado: las tres correcciones técnicas solicitadas están implementadas y verificadas en Kubero TEST y Expo web. La aceptación TI4 en teléfono físico y B06 siguen pendientes.

- [Diagnóstico inicial](hosted-readonly.json): conserva el 503 anterior y la conversación sin cursor.
- [Consulta posterior](hosted-after.json): contratos públicos/privados contra Gateway real.
- [Versiones y digests](images.json), [pods y configuración por nombres](deployed.json) y [migraciones](migrations.json): sin credenciales. Los digests se resolvieron en GHCR y se verificó la etiqueta OCI de revisión; la API de pods no expone imageID.
- [Conexiones reales](expo-web-conexiones-live.json): solicitud y aceptación entre dos cuentas; perfil de la contraparte correcto para receptor y emisor.
- [Recorrido HTTP integrado](integrated-live.json): incorporación real, chat idempotente, tareas, reporte de publicación/persona, aislamiento y revocación con los tokens previos al retiro.
- [Recorrido del dueño en Expo web](expo-web-owner-live.json) y [cierre final](expo-web-cierre.png): selector web multipart, edición, reporte, cierre y retiro; la lectura final se repitió tras un timeout.
- [Expo web real](expo-web-live.json) y [captura de reportes](expo-web-reportes.png): SDK 57 exportado, Chromium 390×844, HTTP real hacia Kubero, persistencia comprobada tras recargar. No teléfono ni build nativo.
- [Ejemplos de laboratorio](convivencia-executed.json) y [OpenAPI](convivencia.openapi.json): PostgreSQL efímero, identidad/puertos externos inyectados; no confundir con la evidencia desplegada.
- [Huellas de fuentes](sources-sha256.json) y [resultados](validation.json): alcance e historial de validación por categoría.

El [guion TI2/TI4](../../qa/S3R-E06-aceptacion.md) conserva las pruebas físicas y las actas que requieren responsables reales. Las cuentas de integración y sus credenciales permanecen fuera del repositorio.
