-- Internal include. Checks the dedicated cluster and the empty target.
DO $check$
BEGIN
    IF EXISTS (
        SELECT FROM pg_roles WHERE rolname IN (
            'scrum101_owner', 'sql_auth_users', 'sql_listado_applications',
            'sql_match_conexion', 'sql_convivencia_mensajeria', 'sql_reportes'
        )
    ) THEN
        RAISE EXCEPTION 'SCRUM-101: ya existe un rol reservado; usar un clúster nuevo';
    END IF;
    IF EXISTS (
        SELECT FROM pg_database
        WHERE datname NOT IN ('template0', 'template1', 'postgres', current_database())
    ) THEN
        RAISE EXCEPTION 'SCRUM-101: se encontraron otras bases en el clúster';
    END IF;
    IF EXISTS (
        SELECT FROM pg_namespace
        WHERE nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'public')
    ) OR EXISTS (
        SELECT FROM pg_extension WHERE extname <> 'plpgsql'
    ) OR EXISTS (
        SELECT FROM pg_depend
        WHERE refclassid = 'pg_namespace'::regclass
          AND refobjid = 'public'::regnamespace
    ) OR EXISTS (
        SELECT FROM pg_event_trigger
    ) THEN
        RAISE EXCEPTION 'SCRUM-101: la base contiene esquemas, objetos o extensiones inesperados';
    END IF;
END;
$check$;
