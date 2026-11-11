-- Migración propuesta para D1. No ejecutar sin respaldo y revisión del esquema existente.
CREATE TABLE IF NOT EXISTS compras_pendientes_v2 (
 id TEXT PRIMARY KEY,
 owner_uid TEXT NOT NULL,
 external_id TEXT NOT NULL,
 comercio TEXT NOT NULL,
 monto_clp INTEGER NOT NULL CHECK(monto_clp > 0 AND monto_clp <= 1000000000),
 fecha TEXT NOT NULL,
 categoria TEXT,
 estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','confirmada','rechazada')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(owner_uid,external_id)
);
CREATE INDEX IF NOT EXISTS idx_compras_v2_owner_estado ON compras_pendientes_v2(owner_uid,estado,created_at);
