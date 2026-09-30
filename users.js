const bcrypt = require("bcrypt");
const pool = require("./db");

async function ensureUsersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      subscription BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function createUser(email, password) {
  await ensureUsersTable();

  const normalizedEmail = email.toLowerCase();

  const exists = await pool.query(
    "SELECT id FROM users WHERE email = $1",
    [normalizedEmail]
  );

  if (exists.rows.length > 0) {
    throw new Error("هذا البريد مسجل بالفعل");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const id = Date.now().toString();

  const result = await pool.query(
    `INSERT INTO users
      (id, email, password_hash, subscription)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, subscription, created_at`,
    [id, normalizedEmail, passwordHash, false]
  );

  return {
    id: result.rows[0].id,
    email: result.rows[0].email,
    passwordHash,
    subscription: result.rows[0].subscription,
    createdAt: result.rows[0].created_at
  };
}

async function verifyUser(email, password) {
  await ensureUsersTable();

  const normalizedEmail = email.toLowerCase();

  const result = await pool.query(
    `SELECT id, email, password_hash, subscription, created_at
     FROM users
     WHERE email = $1`,
    [normalizedEmail]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];

  const valid = await bcrypt.compare(password, row.password_hash);

  if (!valid) return null;

  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    subscription: row.subscription,
    createdAt: row.created_at
  };
}

module.exports = {
  createUser,
  verifyUser
};

async function getUserById(id) {
  await ensureUsersTable();

  const result = await pool.query(
    `SELECT id, email, password_hash, subscription, created_at
     FROM users
     WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];

  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    subscription: row.subscription,
    createdAt: row.created_at
  };
}

async function setSubscription(id, subscription = true) {
  await ensureUsersTable();

  const result = await pool.query(
    `UPDATE users
     SET subscription = $1
     WHERE id = $2
     RETURNING id, email, password_hash, subscription, created_at`,
    [subscription, id]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];

  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    subscription: row.subscription,
    createdAt: row.created_at
  };
}

module.exports = {
  createUser,
  verifyUser,
  getUserById,
  setSubscription
};
