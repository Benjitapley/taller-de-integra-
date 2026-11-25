-- Internal include. Call inside the transaction of a phase entry point.
SET LOCAL search_path = pg_catalog;

DO $check$
BEGIN
    IF current_setting('server_version_num')::integer <> 170006 THEN
        RAISE EXCEPTION 'SCRUM-101: se requiere PostgreSQL 17.6';
    END IF;
    IF current_database() <> 'roomies_scrum101_disposable' THEN
        RAISE EXCEPTION 'SCRUM-101: nombre de base desechable inesperado';
    END IF;
    IF shobj_description(
        (SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_database'
    ) IS DISTINCT FROM 'SCRUM-101 disposable private-v1' THEN
        RAISE EXCEPTION 'SCRUM-101: falta la marca explícita de ensayo';
    END IF;
    IF inet_server_addr() IS NOT NULL OR pg_is_in_recovery() THEN
        RAISE EXCEPTION 'SCRUM-101: se requiere servidor primario por socket Unix';
    END IF;
    IF current_user <> session_user OR NOT EXISTS (
        SELECT FROM pg_roles WHERE rolname = session_user AND rolsuper AND rolcanlogin
    ) THEN
        RAISE EXCEPTION 'SCRUM-101: se requiere el login administrador del clúster aislado, sin SET ROLE';
    END IF;
END;
$check$;

SELECT current_database() AS database_name, session_user AS executor,
       current_setting('server_version') AS server_version;
