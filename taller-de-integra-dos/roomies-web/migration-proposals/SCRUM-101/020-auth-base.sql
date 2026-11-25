\set ON_ERROR_STOP on
BEGIN;
SELECT pg_catalog.pg_advisory_xact_lock(101, 10);
\ir checks/target.sql
\ir checks/provisioned.sql
DO $guard$
BEGIN
    IF to_regnamespace('auth_users') IS NOT NULL THEN
        RAISE EXCEPTION 'SCRUM-101: auth_users ya existe';
    END IF;
    IF encode(sha256(convert_to(replace(convert_from(
        pg_read_binary_file('/scrum101/upstream/001_auth_users_schema.up.sql'),
        'UTF8'), E'\r\n', E'\n'), 'UTF8')), 'hex')
       <> 'fa716fc618dd00ffb0366f4bbdcb95c3a45006fc3fe0bfef8430002068d4a9b3' THEN
        RAISE EXCEPTION 'SCRUM-101: huella inesperada del Auth 001';
    END IF;
END;
$guard$;
SET LOCAL ROLE scrum101_owner;
\ir upstream/001_auth_users_schema.up.sql
COMMIT;
