-- Capacidad versionada y reservas internas. Aplicar como migrador de Listado.
DO $$
DECLARE
    target_schema text;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_roles r
        WHERE r.rolname='sql_listado_applications' AND r.rolcanlogin
          AND NOT r.rolsuper AND NOT r.rolinherit AND NOT r.rolcreatedb
          AND NOT r.rolcreaterole AND NOT r.rolreplication AND NOT r.rolbypassrls
    ) THEN
        RAISE EXCEPTION 'sql_listado_applications debe ser un rol de runtime aislado';
    END IF;
    target_schema := CASE
        WHEN to_regclass('haycupo.publicacion') IS NOT NULL THEN 'haycupo'
        ELSE 'listado_applications'
    END;
    EXECUTE format('CREATE TABLE %I.publicacion_ocupacion (
        id_publicacion BIGINT PRIMARY KEY,
        version_ocupacion BIGINT NOT NULL CHECK (version_ocupacion>=0),
        cupos_ocupados INTEGER NOT NULL CHECK (cupos_ocupados>=0),
        estado VARCHAR(8) NOT NULL CHECK (estado IN (''Activa'',''Cerrada'')),
        event_key VARCHAR(200) NOT NULL,
        actualizado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
    )',target_schema);
    EXECUTE format('CREATE TABLE %I.reserva_cupo (
        id_reserva BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        event_key VARCHAR(100) NOT NULL UNIQUE,
        id_publicacion BIGINT NOT NULL,
        id_postulacion BIGINT NOT NULL UNIQUE,
        id_usuario BIGINT NOT NULL CHECK (id_usuario>0),
        version_capacidad BIGINT NOT NULL CHECK (version_capacidad>=0),
        estado VARCHAR(10) NOT NULL DEFAULT ''Reservada''
            CHECK (estado IN (''Reservada'',''Confirmada'',''Liberada'')),
        creada_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
        expira_en TIMESTAMPTZ NOT NULL
    )',target_schema);
    EXECUTE format('CREATE INDEX reserva_cupo_vigente
        ON %I.reserva_cupo(id_publicacion,expira_en)
        WHERE estado=''Reservada''',target_schema);
    EXECUTE format('REVOKE ALL ON TABLE %I.publicacion_ocupacion,%I.reserva_cupo FROM PUBLIC',
                   target_schema,target_schema);
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO sql_listado_applications',target_schema);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE
        %I.publicacion_ocupacion,%I.reserva_cupo TO sql_listado_applications',
        target_schema,target_schema);
    EXECUTE format('GRANT USAGE ON SEQUENCE %I.reserva_cupo_id_reserva_seq
        TO sql_listado_applications',target_schema);
    EXECUTE format('ALTER TABLE %I.publicacion_ocupacion ENABLE ROW LEVEL SECURITY',
                   target_schema);
    EXECUTE format('ALTER TABLE %I.reserva_cupo ENABLE ROW LEVEL SECURITY',
                   target_schema);
    EXECUTE format('CREATE POLICY runtime_role_access ON %I.publicacion_ocupacion
        TO sql_listado_applications USING (true) WITH CHECK (true)',target_schema);
    EXECUTE format('CREATE POLICY runtime_role_access ON %I.reserva_cupo
        TO sql_listado_applications USING (true) WITH CHECK (true)',target_schema);
END
$$;
