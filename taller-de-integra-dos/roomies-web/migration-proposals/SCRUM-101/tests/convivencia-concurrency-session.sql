-- Run inside A or B's guarded transaction, as the selected effective role.
\set ON_ERROR_STOP on
SELECT current_setting('transaction_isolation') = 'read committed'
   AND :'run_nonce' ~ '^[a-f0-9]{32}$' AND :'slot' IN ('A','B')
   AND :'scenario' IN ('1','2','3','4')
   AND current_database() = 'roomies_scrum101_disposable'
   AND session_user = 'scrum101_admin' AND inet_server_addr() IS NULL
   AND current_user::text = CASE
       WHEN (:'scenario', :'slot') IN (('1','B'),('2','A')) THEN 'scrum101_owner'
       ELSE 'sql_convivencia_mensajeria' END AS session_ok \gset
\if :session_ok
    SELECT set_config('application_name', 'c053-' || :'run_nonce' || '-' || :'scenario' || '-' || :'slot' ||
           CASE WHEN current_user = 'scrum101_owner' THEN '-o' ELSE '-r' END, true) AS scenario_marker,
           pg_backend_pid() AS scenario_pid \gset
    \echo SESION :scenario_pid :scenario_marker
\else
    ROLLBACK;
    \echo FALLO: identidad o rol de sesión incorrectos
    \quit
\endif
