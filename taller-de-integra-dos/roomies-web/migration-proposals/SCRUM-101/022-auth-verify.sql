\set ON_ERROR_STOP on
BEGIN TRANSACTION READ ONLY;
\ir checks/target.sql
\ir checks/provisioned.sql
\ir checks/auth-base.sql
\ir checks/auth-shape.sql
\ir checks/auth-permissions.sql
ROLLBACK;
