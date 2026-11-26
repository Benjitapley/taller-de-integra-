-- Complements the shared disposable PostgreSQL identity guard.
-- scrum101_system_id must come from the prior approved record, never the live session.
SELECT set_config('scrum101.expected_system_id', :'scrum101_system_id', true) AS expected_system_id \gset
DO $check$
BEGIN
    IF session_user <> 'scrum101_admin'
       OR current_setting('scrum101.expected_system_id') !~ '^[0-9]{16,20}$'
       OR (SELECT system_identifier::text FROM pg_control_system())
           IS DISTINCT FROM current_setting('scrum101.expected_system_id')
    THEN
        RAISE EXCEPTION 'SCRUM-101: administrador o identificador de clúster inesperados';
    END IF;
END;
$check$;
