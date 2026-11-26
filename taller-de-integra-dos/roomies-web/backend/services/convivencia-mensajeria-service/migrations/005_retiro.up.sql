BEGIN;
ALTER TABLE convivencia_mensajeria.arriendo ADD COLUMN estado TEXT NOT NULL DEFAULT 'Activo' CHECK (estado IN ('Activo','Finalizado'));
CREATE TABLE convivencia_mensajeria.retiro (
 id_retiro UUID PRIMARY KEY, id_arriendo BIGINT NOT NULL REFERENCES convivencia_mensajeria.arriendo,
 id_usuario BIGINT NOT NULL, id_actor BIGINT NOT NULL, motivo TEXT NOT NULL CHECK(length(trim(motivo)) BETWEEN 1 AND 500),
 fecha TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(), respuesta JSONB NOT NULL,
 UNIQUE(id_arriendo,id_usuario)
);
CREATE TABLE convivencia_mensajeria.retiro_outbox (
 id_retiro UUID NOT NULL REFERENCES convivencia_mensajeria.retiro,
 accion TEXT NOT NULL CHECK(accion IN ('Ocupacion','Notificar')), payload JSONB NOT NULL,
 enviado BOOLEAN NOT NULL DEFAULT false, ultimo_intento TIMESTAMPTZ, PRIMARY KEY(id_retiro,accion)
);
GRANT SELECT,INSERT ON convivencia_mensajeria.retiro TO sql_convivencia_mensajeria;
GRANT SELECT,INSERT,UPDATE ON convivencia_mensajeria.retiro_outbox TO sql_convivencia_mensajeria;
GRANT UPDATE(estado) ON convivencia_mensajeria.arriendo TO sql_convivencia_mensajeria;
GRANT UPDATE(estado,terminada_en) ON convivencia_mensajeria.pertenencia TO sql_convivencia_mensajeria;
COMMIT;
