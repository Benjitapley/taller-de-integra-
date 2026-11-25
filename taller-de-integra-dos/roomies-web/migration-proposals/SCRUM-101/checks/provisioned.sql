-- Internal include. Callable before COMMIT and from the read-only verifier.
DO $check$
DECLARE
    expected_name name;
    role_row pg_roles%ROWTYPE;
    is_owner boolean;
    target_oid oid;
BEGIN
    SELECT oid INTO STRICT target_oid FROM pg_database WHERE datname = current_database();

    FOREACH expected_name IN ARRAY ARRAY[
        'scrum101_owner', 'sql_auth_users', 'sql_listado_applications',
        'sql_match_conexion', 'sql_convivencia_mensajeria', 'sql_reportes'
    ]::name[] LOOP
        is_owner := expected_name = 'scrum101_owner';
        SELECT * INTO role_row FROM pg_roles WHERE rolname = expected_name;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'SCRUM-101: falta el rol %', expected_name;
        END IF;
        IF role_row.rolcanlogin IS DISTINCT FROM (NOT is_owner)
           OR role_row.rolinherit OR role_row.rolsuper OR role_row.rolcreatedb
           OR role_row.rolcreaterole OR role_row.rolreplication OR role_row.rolbypassrls
           OR EXISTS (
               SELECT FROM pg_auth_members
               WHERE role_row.oid IN (member, roleid)
           )
           OR EXISTS (
               SELECT FROM pg_database WHERE datdba = role_row.oid
           ) THEN
            RAISE EXCEPTION 'SCRUM-101: atributos, membresías o propiedad de base inesperados para %', expected_name;
        END IF;
        IF NOT has_database_privilege(role_row.oid, target_oid, 'CONNECT')
           OR has_database_privilege(role_row.oid, target_oid, 'CREATE') IS DISTINCT FROM is_owner
           OR has_database_privilege(role_row.oid, target_oid, 'TEMP')
           OR has_database_privilege(role_row.oid, target_oid, 'CONNECT WITH GRANT OPTION')
           OR has_database_privilege(role_row.oid, target_oid, 'CREATE WITH GRANT OPTION')
           OR has_schema_privilege(role_row.oid, 'public', 'USAGE')
           OR has_schema_privilege(role_row.oid, 'public', 'CREATE') THEN
            RAISE EXCEPTION 'SCRUM-101: permisos efectivos inesperados para %', expected_name;
        END IF;
    END LOOP;

    IF EXISTS (
        SELECT FROM pg_database db,
             LATERAL aclexplode(coalesce(db.datacl, acldefault('d', db.datdba))) acl
        WHERE db.oid = target_oid AND acl.grantee = 0
    ) OR EXISTS (
        SELECT FROM pg_namespace ns,
             LATERAL aclexplode(coalesce(ns.nspacl, acldefault('n', ns.nspowner))) acl
        WHERE ns.nspname = 'public' AND acl.grantee = 0
    ) THEN
        RAISE EXCEPTION 'SCRUM-101: PUBLIC conserva permisos en la base o esquema public';
    END IF;

    IF (SELECT count(*) FROM pg_default_acl
        WHERE defaclrole = 'scrum101_owner'::regrole AND defaclnamespace = 0
          AND defaclobjtype IN ('f', 'T')) <> 2
       OR EXISTS (
           SELECT FROM pg_default_acl d, LATERAL aclexplode(d.defaclacl) acl
           WHERE d.defaclrole = 'scrum101_owner'::regrole AND acl.grantee = 0
       ) THEN
        RAISE EXCEPTION 'SCRUM-101: privilegios predeterminados del propietario inesperados';
    END IF;
END;
$check$;
