\set ON_ERROR_STOP on
BEGIN TRANSACTION READ ONLY;
\ir checks/reportes-prior.sql
SET LOCAL scrum101.reportes_stage = '62';
\ir checks/reportes-catalog.sql
ROLLBACK;
