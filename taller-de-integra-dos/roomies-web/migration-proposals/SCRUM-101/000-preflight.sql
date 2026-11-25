\set ON_ERROR_STOP on
BEGIN TRANSACTION READ ONLY;
\ir checks/target.sql
\ir checks/pristine.sql
ROLLBACK;
