\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
\ir checks/target.sql
\ir checks/provisioned.sql
\ir checks/auth-base.sql
\ir checks/auth-shape.sql
\ir checks/auth-permissions.sql
\ir checks/listado-shape.sql
\ir checks/listado-cut.sql
\ir checks/listado-permissions.sql
SET LOCAL scrum101.match_stage = 'verify';
\ir checks/match-base.sql
\ir checks/match-shape.sql
\ir checks/match-permissions.sql
\ir checks/convivencia-target.sql
SELECT pg_catalog.pg_advisory_xact_lock(101, 10);
SET LOCAL scrum101.convivencia_stage = '3';
\ir checks/convivencia-shape.sql
SET LOCAL ROLE scrum101_owner;

GRANT USAGE ON SCHEMA convivencia_mensajeria TO sql_convivencia_mensajeria;

ALTER TABLE convivencia_mensajeria.incorporacion ENABLE ROW LEVEL SECURITY;
GRANT SELECT (id_operacion, payload, etapa, estado, http_status, respuesta, creada_en, ultimo_intento),
      INSERT (id_operacion, payload),
      UPDATE (etapa, estado, http_status, respuesta, ultimo_intento)
ON convivencia_mensajeria.incorporacion TO sql_convivencia_mensajeria;
CREATE POLICY runtime_select ON convivencia_mensajeria.incorporacion FOR SELECT TO sql_convivencia_mensajeria USING (true);
CREATE POLICY runtime_insert ON convivencia_mensajeria.incorporacion FOR INSERT TO sql_convivencia_mensajeria
    WITH CHECK (true);
CREATE POLICY runtime_update ON convivencia_mensajeria.incorporacion FOR UPDATE TO sql_convivencia_mensajeria
    USING (true) WITH CHECK (true);

ALTER TABLE convivencia_mensajeria.arriendo ENABLE ROW LEVEL SECURITY;
GRANT SELECT (id_arriendo, id_publicacion, cupos_totales, version_capacidad, creado_en, version_ocupacion),
      INSERT (id_publicacion, cupos_totales, version_capacidad),
      UPDATE (version_ocupacion)
ON convivencia_mensajeria.arriendo TO sql_convivencia_mensajeria;
CREATE POLICY runtime_select ON convivencia_mensajeria.arriendo FOR SELECT TO sql_convivencia_mensajeria USING (true);
CREATE POLICY runtime_insert ON convivencia_mensajeria.arriendo FOR INSERT TO sql_convivencia_mensajeria
    WITH CHECK (true);
CREATE POLICY runtime_update ON convivencia_mensajeria.arriendo FOR UPDATE TO sql_convivencia_mensajeria
    USING (true) WITH CHECK (true);

ALTER TABLE convivencia_mensajeria.pertenencia ENABLE ROW LEVEL SECURITY;
GRANT SELECT (id_pertenencia, id_arriendo, id_usuario, id_postulacion, id_operacion, estado, creada_en, terminada_en),
      INSERT (id_arriendo, id_usuario, id_postulacion, id_operacion),
      UPDATE (estado)
ON convivencia_mensajeria.pertenencia TO sql_convivencia_mensajeria;
CREATE POLICY runtime_select ON convivencia_mensajeria.pertenencia FOR SELECT TO sql_convivencia_mensajeria USING (true);
CREATE POLICY runtime_insert ON convivencia_mensajeria.pertenencia FOR INSERT TO sql_convivencia_mensajeria
    WITH CHECK (estado = 'Activa' AND terminada_en IS NULL);
CREATE POLICY runtime_update ON convivencia_mensajeria.pertenencia FOR UPDATE TO sql_convivencia_mensajeria
    USING (estado = 'Activa') WITH CHECK (false);

ALTER TABLE convivencia_mensajeria.outbox ENABLE ROW LEVEL SECURITY;
GRANT SELECT (id_outbox, id_operacion, accion, reserva, enviado, ultimo_intento),
      INSERT (id_operacion, accion, reserva),
      UPDATE (ultimo_intento, reserva, enviado)
ON convivencia_mensajeria.outbox TO sql_convivencia_mensajeria;
CREATE POLICY runtime_select ON convivencia_mensajeria.outbox FOR SELECT TO sql_convivencia_mensajeria USING (true);
CREATE POLICY runtime_insert ON convivencia_mensajeria.outbox FOR INSERT TO sql_convivencia_mensajeria
    WITH CHECK (true);
CREATE POLICY runtime_update ON convivencia_mensajeria.outbox FOR UPDATE TO sql_convivencia_mensajeria
    USING (true) WITH CHECK (true);

ALTER TABLE convivencia_mensajeria.conversacion ENABLE ROW LEVEL SECURITY;
GRANT SELECT (id_conversacion, id_arriendo, creada_en),
      INSERT (id_arriendo)
ON convivencia_mensajeria.conversacion TO sql_convivencia_mensajeria;
CREATE POLICY runtime_select ON convivencia_mensajeria.conversacion FOR SELECT TO sql_convivencia_mensajeria USING (true);
CREATE POLICY runtime_insert ON convivencia_mensajeria.conversacion FOR INSERT TO sql_convivencia_mensajeria
    WITH CHECK (true);

ALTER TABLE convivencia_mensajeria.mensaje ENABLE ROW LEVEL SECURITY;
GRANT SELECT (id_mensaje, id_conversacion, id_remitente, nombre_remitente, contenido, id_cliente, fecha_envio),
      INSERT (id_conversacion, id_remitente, nombre_remitente, contenido, id_cliente)
ON convivencia_mensajeria.mensaje TO sql_convivencia_mensajeria;
CREATE POLICY runtime_select ON convivencia_mensajeria.mensaje FOR SELECT TO sql_convivencia_mensajeria USING (true);
CREATE POLICY runtime_insert ON convivencia_mensajeria.mensaje FOR INSERT TO sql_convivencia_mensajeria
    WITH CHECK (true);

RESET ROLE;
\ir checks/convivencia-permissions.sql
COMMIT;
