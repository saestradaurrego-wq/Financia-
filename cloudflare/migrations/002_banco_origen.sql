-- Ejecutar DESPUÉS de 001_compras_pendientes_v2.sql.
-- Identificar la institución emisora sin mezclar transacciones de bancos diferentes.
ALTER TABLE compras_pendientes_v2 ADD COLUMN banco TEXT NOT NULL DEFAULT 'no_identificado';
CREATE INDEX IF NOT EXISTS idx_compras_banco_owner ON compras_pendientes_v2(owner_uid, banco, created_at);
