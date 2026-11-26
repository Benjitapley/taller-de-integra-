-- A is the observing administrator for this statement only. RESET ROLE preserves its row locks.
\set ON_ERROR_STOP on
RESET ROLE;
SELECT pg_stat_clear_snapshot();
WITH registered AS (
    SELECT :'run_nonce' AS nonce, :'scenario' AS scenario,
           :'pid_a'::integer AS pid_a, :'start_a'::timestamptz AS start_a,
           :'pid_b'::integer AS pid_b, :'start_b'::timestamptz AS start_b
)
SELECT EXISTS (
    SELECT FROM registered r
    JOIN pg_stat_activity a ON a.pid = r.pid_a AND a.backend_start = r.start_a
    JOIN pg_stat_activity b ON b.pid = r.pid_b AND b.backend_start = r.start_b
    WHERE r.nonce ~ '^[a-f0-9]{32}$' AND r.scenario IN ('1','2','3','4')
      AND r.pid_a = pg_backend_pid() AND r.pid_a <> r.pid_b
      AND current_database() = 'roomies_scrum101_disposable' AND current_user = 'scrum101_admin'
      AND a.datname = current_database() AND b.datname = current_database()
      AND a.backend_type = 'client backend' AND b.backend_type = 'client backend'
      AND a.usename = 'scrum101_admin' AND b.usename = 'scrum101_admin'
      AND a.client_addr IS NULL AND b.client_addr IS NULL
      AND a.application_name = 'c053-' || r.nonce || '-' || r.scenario || '-A-' ||
          CASE WHEN r.scenario = '2' THEN 'o' ELSE 'r' END
      AND b.application_name = 'c053-' || r.nonce || '-' || r.scenario || '-B-' ||
          CASE WHEN r.scenario = '1' THEN 'o' ELSE 'r' END
      AND b.xact_start IS NOT NULL
      AND (
          (r.scenario IN ('1','2','3') AND b.state = 'active' AND b.wait_event_type = 'Lock'
             AND pg_blocking_pids(b.pid) = ARRAY[a.pid])
          OR (r.scenario = '4' AND b.state = 'idle in transaction'
             AND pg_blocking_pids(b.pid) = ARRAY[]::integer[])
      )
) AS gate_ok, (:'scenario' IN ('1','2','3')) AS commit_a \gset
\if :gate_ok
    \if :commit_a
        COMMIT;
        \echo COMMIT de A tras comprobar identidad y bloqueo de B
    \else
        ROLLBACK;
        \echo ROLLBACK de A tras comprobar identidad y ausencia de espera en B
    \endif
\else
    ROLLBACK;
    \echo FALLO: sesión sustituida, espera ajena o resultado inesperado
    \quit
\endif
