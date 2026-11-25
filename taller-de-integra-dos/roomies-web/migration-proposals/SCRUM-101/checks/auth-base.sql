DO $check$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_namespace
        WHERE nspname = 'auth_users' AND nspowner = 'scrum101_owner'::regrole
    ) OR NOT EXISTS (
        SELECT FROM pg_class
        WHERE oid = to_regclass('auth_users.usuario')
          AND relkind = 'r' AND relowner = 'scrum101_owner'::regrole
    ) THEN
        RAISE EXCEPTION 'SCRUM-101: falta la base Auth bajo scrum101_owner';
    END IF;
END;
$check$;
