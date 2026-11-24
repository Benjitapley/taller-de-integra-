-- Chat privado por arriendo. Ejecutar como migrador, nunca al iniciar la API.
BEGIN;

CREATE TABLE convivencia_mensajeria.conversacion (
  id_conversacion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_arriendo BIGINT NOT NULL UNIQUE REFERENCES convivencia_mensajeria.arriendo(id_arriendo),
  creada_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE convivencia_mensajeria.mensaje (
  id_mensaje BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_conversacion BIGINT NOT NULL REFERENCES convivencia_mensajeria.conversacion(id_conversacion),
  id_remitente BIGINT NOT NULL CHECK (id_remitente > 0),
  nombre_remitente TEXT NOT NULL CHECK (length(btrim(nombre_remitente)) BETWEEN 1 AND 200),
  contenido VARCHAR(2000) NOT NULL CHECK (length(btrim(contenido)) BETWEEN 1 AND 2000),
  id_cliente UUID NOT NULL,
  fecha_envio TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(id_conversacion,id_remitente,id_cliente)
);
CREATE INDEX mensajes_historial ON convivencia_mensajeria.mensaje(id_conversacion,id_mensaje DESC);

INSERT INTO convivencia_mensajeria.conversacion(id_arriendo)
SELECT id_arriendo FROM convivencia_mensajeria.arriendo
ON CONFLICT(id_arriendo) DO NOTHING;

REVOKE ALL ON convivencia_mensajeria.conversacion,convivencia_mensajeria.mensaje FROM PUBLIC;
GRANT SELECT,INSERT ON convivencia_mensajeria.conversacion,convivencia_mensajeria.mensaje TO sql_convivencia_mensajeria;
GRANT USAGE,SELECT ON SEQUENCE convivencia_mensajeria.conversacion_id_conversacion_seq,
  convivencia_mensajeria.mensaje_id_mensaje_seq TO sql_convivencia_mensajeria;
-- Permite bloquear la fila mientras se lee o envía; la aplicación solo modifica pertenencias
-- por las operaciones de dominio ya autorizadas.
GRANT UPDATE(estado) ON convivencia_mensajeria.pertenencia TO sql_convivencia_mensajeria;

COMMIT;
