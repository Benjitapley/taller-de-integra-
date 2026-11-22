BEGIN;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_roles r WHERE rolname='sql_reportes'
            AND rolcanlogin AND NOT rolsuper AND NOT rolcreaterole AND NOT rolcreatedb
            AND NOT rolreplication AND NOT rolbypassrls AND NOT rolinherit
            AND NOT EXISTS (SELECT FROM pg_auth_members m WHERE r.oid IN (m.member,m.roleid))
    ) THEN
        RAISE EXCEPTION 'Falta el rol dedicado sql_reportes';
    END IF;
END $$;

CREATE SCHEMA reportes;
REVOKE ALL ON SCHEMA reportes FROM PUBLIC;
CREATE TABLE reportes.reporte (
    id_reporte BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_denunciante BIGINT NOT NULL CHECK (id_denunciante > 0),
    id_usuario_reportado BIGINT CHECK (id_usuario_reportado > 0 AND id_usuario_reportado <> id_denunciante),
    id_publicacion_reportada BIGINT CHECK (id_publicacion_reportada > 0),
    tipo TEXT GENERATED ALWAYS AS (
        CASE WHEN id_usuario_reportado IS NULL THEN 'Publicacion' ELSE 'Usuario' END
    ) STORED,
    categoria TEXT NOT NULL CHECK (char_length(btrim(categoria)) BETWEEN 1 AND 80),
    descripcion TEXT NOT NULL CHECK (char_length(btrim(descripcion)) BETWEEN 1 AND 1000),
    estado TEXT NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente','En_Revision','Resuelto','Descartado')),
    fecha TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CHECK (num_nonnulls(id_usuario_reportado,id_publicacion_reportada) = 1)
);
CREATE INDEX reporte_denunciante_fecha ON reportes.reporte(id_denunciante,fecha DESC,id_reporte DESC);
REVOKE ALL ON reportes.reporte FROM PUBLIC;
ALTER TABLE reportes.reporte ENABLE ROW LEVEL SECURITY;
CREATE POLICY reportes_runtime_access ON reportes.reporte TO sql_reportes USING (true) WITH CHECK (true);
GRANT USAGE ON SCHEMA reportes TO sql_reportes;
GRANT SELECT ON reportes.reporte TO sql_reportes;
GRANT INSERT(id_denunciante,id_usuario_reportado,id_publicacion_reportada,categoria,descripcion)
    ON reportes.reporte TO sql_reportes;
GRANT USAGE ON SEQUENCE reportes.reporte_id_reporte_seq TO sql_reportes;
COMMIT;
