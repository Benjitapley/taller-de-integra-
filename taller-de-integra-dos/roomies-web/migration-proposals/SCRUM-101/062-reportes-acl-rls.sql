\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
\ir checks/reportes-prior.sql
SELECT pg_catalog.pg_advisory_xact_lock(101, 11);
SET LOCAL scrum101.reportes_stage = '61';
\ir checks/reportes-catalog.sql
SET LOCAL ROLE scrum101_owner;
GRANT USAGE ON SCHEMA reportes TO sql_reportes;
GRANT USAGE ON SEQUENCE reportes.reporte_id_reporte_seq, reportes.reporte_historial_id_actuacion_seq TO sql_reportes;
GRANT SELECT (id_reporte,id_denunciante,id_usuario_reportado,id_publicacion_reportada,tipo,categoria,descripcion,estado,fecha) ON reportes.reporte TO sql_reportes;
CREATE POLICY runtime_select ON reportes.reporte FOR SELECT TO sql_reportes USING (true);
GRANT INSERT (id_denunciante,id_usuario_reportado,id_publicacion_reportada,categoria,descripcion) ON reportes.reporte TO sql_reportes;
CREATE POLICY runtime_insert ON reportes.reporte FOR INSERT TO sql_reportes WITH CHECK (true);
GRANT UPDATE (estado) ON reportes.reporte TO sql_reportes;
CREATE POLICY runtime_update ON reportes.reporte FOR UPDATE TO sql_reportes USING (true) WITH CHECK (true);
GRANT SELECT (id_actuacion,id_reporte,id_administrador,estado_anterior,estado_nuevo,nota_interna,fecha) ON reportes.reporte_historial TO sql_reportes;
CREATE POLICY runtime_select ON reportes.reporte_historial FOR SELECT TO sql_reportes USING (true);
GRANT INSERT (id_reporte,id_administrador,estado_anterior,estado_nuevo,nota_interna) ON reportes.reporte_historial TO sql_reportes;
CREATE POLICY runtime_insert ON reportes.reporte_historial FOR INSERT TO sql_reportes WITH CHECK (true);
GRANT SELECT (id_actuacion,proximo_intento,entregado_en) ON reportes.outbox TO sql_reportes;
CREATE POLICY runtime_select ON reportes.outbox FOR SELECT TO sql_reportes USING (true);
GRANT INSERT (id_actuacion) ON reportes.outbox TO sql_reportes;
CREATE POLICY runtime_insert ON reportes.outbox FOR INSERT TO sql_reportes WITH CHECK (true);
GRANT UPDATE (proximo_intento,entregado_en) ON reportes.outbox TO sql_reportes;
CREATE POLICY runtime_update ON reportes.outbox FOR UPDATE TO sql_reportes USING (true) WITH CHECK (true);
GRANT SELECT (id_denunciante,clave,huella,respuesta) ON reportes.operacion_envio TO sql_reportes;
CREATE POLICY runtime_select ON reportes.operacion_envio FOR SELECT TO sql_reportes USING (true);
GRANT INSERT (id_denunciante,clave,huella,respuesta) ON reportes.operacion_envio TO sql_reportes;
CREATE POLICY runtime_insert ON reportes.operacion_envio FOR INSERT TO sql_reportes WITH CHECK (true);
RESET ROLE;
SET LOCAL scrum101.reportes_stage = '62';
\ir checks/reportes-catalog.sql
COMMIT;
