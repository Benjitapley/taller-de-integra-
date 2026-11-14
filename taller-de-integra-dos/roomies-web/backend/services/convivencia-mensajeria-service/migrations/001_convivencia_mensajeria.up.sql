-- Aplicar como migrador autorizado; la app usa sql_convivencia_mensajeria.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_roles r
        WHERE r.rolname='sql_convivencia_mensajeria'
          AND r.rolcanlogin AND NOT r.rolsuper AND NOT r.rolinherit
          AND NOT r.rolcreatedb AND NOT r.rolcreaterole
          AND NOT r.rolreplication AND NOT r.rolbypassrls
          AND NOT EXISTS (
              SELECT 1 FROM pg_auth_members m
              WHERE m.member=r.oid OR m.roleid=r.oid
          )
    ) THEN
        RAISE EXCEPTION 'sql_convivencia_mensajeria debe ser un login aislado sin privilegios heredados';
    END IF;
END
$$;

CREATE SCHEMA convivencia_mensajeria;
REVOKE ALL ON SCHEMA convivencia_mensajeria FROM PUBLIC;

CREATE TABLE convivencia_mensajeria.arriendo (
    id_arriendo BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_publicacion BIGINT NOT NULL UNIQUE CHECK (id_publicacion>0),
    id_arrendador BIGINT NOT NULL CHECK (id_arrendador>0),
    capacidad INTEGER NOT NULL CHECK (capacidad>0),
    id_responsable BIGINT NULL CHECK (id_responsable>0),
    estado VARCHAR(12) NOT NULL DEFAULT 'Activo'
        CHECK (estado IN ('Activo','Finalizado')),
    version_ocupacion BIGINT NOT NULL DEFAULT 0 CHECK (version_ocupacion>=0),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    finalizado_en TIMESTAMPTZ NULL
);

CREATE TABLE convivencia_mensajeria.pertenencia (
    id_pertenencia BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_arriendo BIGINT NOT NULL REFERENCES convivencia_mensajeria.arriendo(id_arriendo),
    id_usuario BIGINT NOT NULL CHECK (id_usuario>0),
    rol VARCHAR(12) NOT NULL CHECK (rol IN ('Responsable','Integrante')),
    estado VARCHAR(10) NOT NULL DEFAULT 'Activa'
        CHECK (estado IN ('Activa','Retirada')),
    ingreso_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    salida_en TIMESTAMPTZ NULL,
    id_retirado_por BIGINT NULL CHECK (id_retirado_por>0),
    motivo_retiro VARCHAR(1000) NULL,
    CHECK ((estado='Activa' AND salida_en IS NULL) OR
           (estado='Retirada' AND salida_en IS NOT NULL))
);
CREATE UNIQUE INDEX pertenencia_usuario_activa
    ON convivencia_mensajeria.pertenencia(id_usuario) WHERE estado='Activa';
CREATE UNIQUE INDEX pertenencia_arriendo_usuario_activa
    ON convivencia_mensajeria.pertenencia(id_arriendo,id_usuario) WHERE estado='Activa';
CREATE INDEX pertenencia_arriendo_activa
    ON convivencia_mensajeria.pertenencia(id_arriendo,ingreso_en,id_pertenencia)
    WHERE estado='Activa';

CREATE TABLE convivencia_mensajeria.conversacion (
    id_conversacion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_arriendo BIGINT NOT NULL UNIQUE
        REFERENCES convivencia_mensajeria.arriendo(id_arriendo),
    creada_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE convivencia_mensajeria.mensaje (
    id_mensaje BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_conversacion BIGINT NOT NULL
        REFERENCES convivencia_mensajeria.conversacion(id_conversacion),
    id_usuario BIGINT NOT NULL CHECK (id_usuario>0),
    id_cliente UUID NOT NULL,
    contenido VARCHAR(2000) NOT NULL CHECK (length(btrim(contenido))>0),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(id_conversacion,id_usuario,id_cliente)
);
CREATE INDEX mensaje_cursor
    ON convivencia_mensajeria.mensaje(id_conversacion,creado_en DESC,id_mensaje DESC);

CREATE TABLE convivencia_mensajeria.tarea (
    id_tarea BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_arriendo BIGINT NOT NULL REFERENCES convivencia_mensajeria.arriendo(id_arriendo),
    titulo VARCHAR(200) NOT NULL CHECK (length(btrim(titulo))>0),
    descripcion VARCHAR(1000) NULL,
    id_creador BIGINT NOT NULL CHECK (id_creador>0),
    id_asignado BIGINT NULL CHECK (id_asignado>0),
    estado VARCHAR(12) NOT NULL DEFAULT 'Pendiente'
        CHECK (estado IN ('Pendiente','Completada')),
    creada_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX tarea_asignada_pendiente
    ON convivencia_mensajeria.tarea(id_arriendo,id_asignado)
    WHERE estado='Pendiente';

CREATE TABLE convivencia_mensajeria.expulsion (
    id_expulsion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_arriendo BIGINT NOT NULL REFERENCES convivencia_mensajeria.arriendo(id_arriendo),
    id_usuario BIGINT NOT NULL CHECK (id_usuario>0),
    id_actor BIGINT NOT NULL CHECK (id_actor>0),
    motivo VARCHAR(1000) NOT NULL CHECK (length(btrim(motivo))>0),
    clave VARCHAR(160) NOT NULL UNIQUE,
    ejecutada_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE convivencia_mensajeria.comando (
    clave VARCHAR(160) PRIMARY KEY,
    huella CHAR(64) NOT NULL,
    respuesta JSONB NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE convivencia_mensajeria.outbox (
    id_evento BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    clave VARCHAR(200) NOT NULL UNIQUE,
    payload JSONB NOT NULL,
    intentos INTEGER NOT NULL DEFAULT 0 CHECK (intentos>=0),
    reintentar_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    reclamado_hasta TIMESTAMPTZ NULL,
    entregado_en TIMESTAMPTZ NULL,
    error VARCHAR(80) NULL
);
CREATE INDEX outbox_pendiente
    ON convivencia_mensajeria.outbox(reintentar_en,id_evento)
    WHERE entregado_en IS NULL;

REVOKE ALL ON ALL TABLES IN SCHEMA convivencia_mensajeria FROM PUBLIC;
GRANT USAGE ON SCHEMA convivencia_mensajeria TO sql_convivencia_mensajeria;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA convivencia_mensajeria
    TO sql_convivencia_mensajeria;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA convivencia_mensajeria
    TO sql_convivencia_mensajeria;

DO $$
DECLARE item record;
BEGIN
    FOR item IN
        SELECT tablename FROM pg_tables WHERE schemaname='convivencia_mensajeria'
    LOOP
        EXECUTE format('ALTER TABLE convivencia_mensajeria.%I ENABLE ROW LEVEL SECURITY',
                       item.tablename);
        EXECUTE format(
            'CREATE POLICY runtime_role_access ON convivencia_mensajeria.%I TO sql_convivencia_mensajeria USING (true) WITH CHECK (true)',
            item.tablename
        );
    END LOOP;
END
$$;
