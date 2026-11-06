#!/usr/bin/env python3
"""Pruebas de integridad de esquema D1 v2 con SQLite en memoria."""
import sqlite3
from pathlib import Path

schema = Path(__file__).resolve().parents[1] / "schema-multiusuario-v2.sql"
db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
db.executescript(schema.read_text(encoding="utf-8"))

accounts = [
    ("cuenta-a", "usuario-a", "CL", "banco-a", "Cuenta A", "CLP"),
    ("cuenta-b", "usuario-b", "US", "banco-b", "Account B", "USD"),
]
db.executemany(
    """INSERT INTO bank_accounts_v2
    (id, owner_uid, country_code, bank_code, display_name, currency_code)
    VALUES (?,?,?,?,?,?)""", accounts
)

def add(mid, uid, account, txn):
    db.execute("""INSERT INTO bank_movements_v2
        (id, owner_uid, bank_account_id, source, source_transaction_id,
         booked_at, description, amount_minor, currency_code)
        VALUES (?, ?, ?, 'bank_api', ?, '2026-11-04', 'Compra de prueba', -1250, 'CLP')""",
        (mid, uid, account, txn))

add("mov-a", "usuario-a", "cuenta-a", "txn-1")
add("mov-b", "usuario-b", "cuenta-b", "txn-1")

# La base de datos impide vincular un movimiento con cuenta de otro usuario.
try:
    add("intruso", "usuario-a", "cuenta-b", "txn-2")
    raise AssertionError("Se acepto una cuenta de otro usuario")
except sqlite3.IntegrityError:
    pass

# No se admiten duplicados de la misma fuente/cuenta/transaccion.
try:
    add("duplicado", "usuario-a", "cuenta-a", "txn-1")
    raise AssertionError("Se acepto un movimiento duplicado")
except sqlite3.IntegrityError:
    pass

# El usuario A no puede aprobar el movimiento de B.
result = db.execute("""UPDATE bank_movements_v2 SET status='approved'
    WHERE id=? AND owner_uid=? AND status='pending'""",
    ("mov-b", "usuario-a"))
assert result.rowcount == 0

# El propietario puede aprobar una sola vez.
result = db.execute("""UPDATE bank_movements_v2 SET status='approved'
    WHERE id=? AND owner_uid=? AND status='pending'""",
    ("mov-a", "usuario-a"))
assert result.rowcount == 1
result = db.execute("""UPDATE bank_movements_v2 SET status='rejected'
    WHERE id=? AND owner_uid=? AND status='pending'""",
    ("mov-a", "usuario-a"))
assert result.rowcount == 0

assert db.execute("SELECT status FROM bank_movements_v2 WHERE id='mov-a'").fetchone()[0] == "approved"
assert db.execute("SELECT status FROM bank_movements_v2 WHERE id='mov-b'").fetchone()[0] == "pending"

# La suscripcion tiene un solo registro por usuario.
db.execute("INSERT INTO user_subscriptions_v2(owner_uid, plan) VALUES('usuario-a','free')")
try:
    db.execute("INSERT INTO user_subscriptions_v2(owner_uid, plan) VALUES('usuario-a','premium')")
    raise AssertionError("Se acepto una suscripcion duplicada")
except sqlite3.IntegrityError:
    pass

print("OK: esquema D1 v2, aislamiento, duplicados, aprobaciones y suscripciones")

# Ejercitar SQL de la API, no solo restricciones abstractas.
insert_sql = (
    "INSERT OR IGNORE INTO bank_movements_v2 "
    "(id,owner_uid,bank_account_id,source,source_transaction_id,booked_at,"
    "description,amount_minor,currency_code,status) "
    "SELECT ?,owner_uid,id,?,?,?,?,?, ?,? FROM bank_accounts_v2 "
    "WHERE id=? AND owner_uid=? AND currency_code=?"
)
def insert_manual(mid, account, owner, currency, transaction):
    return db.execute(insert_sql, (mid, "manual", transaction, "2026-11-04",
        "Movimiento manual", -1500, currency, "pending", account, owner, currency)).rowcount

assert insert_manual("api-a", "cuenta-a", "usuario-a", "CLP", "api-txn-1") == 1
assert insert_manual("api-intruso", "cuenta-b", "usuario-a", "USD", "api-txn-2") == 0
assert insert_manual("api-moneda", "cuenta-a", "usuario-a", "USD", "api-txn-3") == 0
assert insert_manual("api-duplicado", "cuenta-a", "usuario-a", "CLP", "api-txn-1") == 0

pending_sql = (
    "SELECT id, bank_account_id, source, booked_at, description, "
    "amount_minor, currency_code, status FROM bank_movements_v2 "
    "WHERE owner_uid = ? AND status = ? ORDER BY booked_at DESC LIMIT 100"
)
pending_a = db.execute(pending_sql, ("usuario-a", "pending")).fetchall()
pending_b = db.execute(pending_sql, ("usuario-b", "pending")).fetchall()
assert any(row[0] == "api-a" for row in pending_a)
assert all(row[0] != "mov-b" for row in pending_a)
assert all(row[0] != "api-a" for row in pending_b)
assert any(row[0] == "mov-b" for row in pending_b)

account_sql = (
    "SELECT id,display_name,country_code,bank_code,currency_code,connection_status "
    "FROM bank_accounts_v2 WHERE owner_uid = ? ORDER BY created_at DESC LIMIT 100"
)
assert [row[0] for row in db.execute(account_sql, ("usuario-a",))] == ["cuenta-a"]
assert [row[0] for row in db.execute(account_sql, ("usuario-b",))] == ["cuenta-b"]
print("OK: SQL de insercion y listados reales aislados por usuario")

# La configuración de despliegue debe ser TOML válido.
import tomllib
wrangler = Path(__file__).resolve().parents[2] / 'worker' / 'wrangler.toml'
with wrangler.open('rb') as config_file:
    config = tomllib.load(config_file)
assert config['name'] == 'financia-api-v2-staging'
assert config['main'] == 'index.js'
print('OK: configuración Wrangler staging válida')
