BEGIN;

CREATE TABLE convivencia_mensajeria.expulsion (
  id_expulsion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_arriendo BIGINT NOT NULL REFERENCES convivencia_mensajeria.arriendo(id_arriendo),
  id_pertenencia BIGINT NOT NULL UNIQUE REFERENCES convivencia_mensajeria.pertenencia(id_pertenencia),
  id_usuario BIGINT NOT NULL CHECK (id_usuario > 0),
  id_ejecutor BIGINT NOT NULL CHECK (id_ejecutor > 0),
  motivo TEXT NOT NULL CHECK (length(motivo) BETWEEN 1 AND 500),
  creada_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX expulsion_arriendo_fecha
  ON convivencia_mensajeria.expulsion(id_arriendo, creada_en DESC);

REVOKE ALL ON convivencia_mensajeria.expulsion FROM PUBLIC;
GRANT SELECT,INSERT ON convivencia_mensajeria.expulsion TO sql_convivencia_mensajeria;
GRANT USAGE,SELECT ON SEQUENCE convivencia_mensajeria.expulsion_id_expulsion_seq TO sql_convivencia_mensajeria;

COMMIT;
