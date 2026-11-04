-- Financia: esquema objetivo multiusuario (Cloudflare D1 / SQLite).
-- NO ejecutar sobre produccion sin migracion y respaldo verificados.
-- La tabla antigua compras(id, comercio, monto, fecha, hora, estado)
-- permanece intacta; no se copia ni se asigna a usuarios automaticamente.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS bank_accounts_v2 (
  id TEXT PRIMARY KEY,
  owner_uid TEXT NOT NULL,
  country_code TEXT NOT NULL,
  bank_code TEXT NOT NULL,
  display_name TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  provider TEXT,
  provider_account_ref TEXT,
  connection_status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK(connection_status IN ('disconnected','pending','connected','error','revoked')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_uid, id)
);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_v2_owner
  ON bank_accounts_v2(owner_uid);

CREATE TABLE IF NOT EXISTS bank_movements_v2 (
  id TEXT PRIMARY KEY,
  owner_uid TEXT NOT NULL,
  bank_account_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('bank_api','bank_email','manual','statement')),
  source_transaction_id TEXT NOT NULL,
  booked_at TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','approved','rejected')),
  category_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(owner_uid, bank_account_id)
    REFERENCES bank_accounts_v2(owner_uid, id),
  UNIQUE(owner_uid, bank_account_id, source, source_transaction_id)
);
CREATE INDEX IF NOT EXISTS idx_bank_movements_v2_owner_status
  ON bank_movements_v2(owner_uid, status, booked_at);

CREATE TABLE IF NOT EXISTS user_subscriptions_v2 (
  owner_uid TEXT PRIMARY KEY,
  plan TEXT NOT NULL DEFAULT 'free' CHECK(plan IN ('free','premium')),
  billing_provider TEXT,
  billing_customer_ref TEXT,
  billing_subscription_ref TEXT,
  billing_status TEXT NOT NULL DEFAULT 'inactive',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- OBLIGATORIO: cada endpoint valida en servidor el token de identidad.
-- owner_uid SIEMPRE proviene del token verificado, nunca del JSON cliente.
-- Todas las consultas y cambios deben filtrar owner_uid.
-- No se deben exponer tokens de conexion bancaria al navegador.
-- amount_minor es entero en unidades menores de la moneda; revisar
-- monedas sin decimales y reglas de redondeo por ISO 4217.
