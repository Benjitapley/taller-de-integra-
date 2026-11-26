BEGIN;
CREATE TABLE convivencia_mensajeria.expulsion (
 id_expulsion UUID PRIMARY KEY,
 id_arriendo BIGINT NOT NULL REFERENCES convivencia_mensajeria.arriendo(id_arriendo),
 id_usuario BIGINT NOT NULL,
 id_actor BIGINT NOT NULL,
 motivo VARCHAR(500) NOT NULL CHECK (length(btrim(motivo)) BETWEEN 1 AND 500),
 respuesta JSONB NOT NULL,
 creada_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id_arriendo,id_usuario)
);
CREATE TABLE convivencia_mensajeria.expulsion_outbox (
 id_expulsion UUID PRIMARY KEY REFERENCES convivencia_mensajeria.expulsion(id_expulsion),
 id_publicacion BIGINT NOT NULL,
 proyeccion JSONB NOT NULL,
 enviado BOOLEAN NOT NULL DEFAULT false
);
REVOKE ALL ON convivencia_mensajeria.expulsion,convivencia_mensajeria.expulsion_outbox FROM PUBLIC;
GRANT SELECT,INSERT ON convivencia_mensajeria.expulsion TO sql_convivencia_mensajeria;
GRANT SELECT,INSERT,UPDATE ON convivencia_mensajeria.expulsion_outbox TO sql_convivencia_mensajeria;
COMMIT;
