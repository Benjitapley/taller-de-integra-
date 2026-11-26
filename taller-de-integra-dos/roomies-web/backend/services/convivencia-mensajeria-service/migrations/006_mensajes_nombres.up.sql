-- Nombres canónicos; conserva IDs, filas y la restricción única existente.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE convivencia_mensajeria.mensaje RENAME TO mensajes;
ALTER TABLE convivencia_mensajeria.mensajes RENAME COLUMN id_remitente TO id_emisor;
-- Compatibilidad de lectura/escritura simple para herramientas anteriores.
CREATE VIEW convivencia_mensajeria.mensaje AS
 SELECT id_mensaje,id_conversacion,id_emisor AS id_remitente,nombre_remitente,
        contenido,id_cliente,fecha_envio FROM convivencia_mensajeria.mensajes;
GRANT SELECT,INSERT ON convivencia_mensajeria.mensaje TO sql_convivencia_mensajeria;
COMMIT;
