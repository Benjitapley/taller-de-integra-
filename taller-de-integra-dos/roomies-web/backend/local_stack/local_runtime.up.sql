-- Campos usados por el contrato común, ausentes en la migración inicial Auth.
ALTER TABLE auth_users.usuario
 ADD COLUMN IF NOT EXISTS presupuesto INTEGER CHECK (presupuesto >= 0),
 ADD COLUMN IF NOT EXISTS zona_interes VARCHAR(250);
