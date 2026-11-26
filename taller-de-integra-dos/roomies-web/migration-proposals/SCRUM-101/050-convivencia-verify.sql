\set ON_ERROR_STOP on
BEGIN TRANSACTION READ ONLY;
\ir checks/target.sql
\ir checks/provisioned.sql
\ir checks/auth-base.sql
\ir checks/auth-shape.sql
\ir checks/auth-permissions.sql
\ir checks/listado-shape.sql
\ir checks/listado-cut.sql
\ir checks/listado-permissions.sql
SET LOCAL scrum101.match_stage = 'verify';
\ir checks/match-base.sql
\ir checks/match-shape.sql
\ir checks/match-permissions.sql
\ir checks/convivencia-target.sql
SET LOCAL scrum101.convivencia_stage = '1';
\ir checks/convivencia-shape.sql
ROLLBACK;
