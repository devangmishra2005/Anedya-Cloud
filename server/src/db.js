const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const dbPath = process.env.SQLITE_PATH || path.join(__dirname, '..', 'data.sqlite');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS permissions (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permission_id)
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, role_id)
    );
  `);
}

const PERMISSION_DEFS = [
  { key: 'view_dashboard', label: 'View assigned device dashboard data' },
  { key: 'control_relay', label: 'Control relay devices' },
  { key: 'view_analytics', label: 'Access historical analytics' },
  { key: 'manage_users', label: 'Manage users and roles' },
];

const ROLE_DEFS = [
  { key: 'admin', label: 'Administrator' },
  { key: 'operator', label: 'Operator' },
  { key: 'viewer', label: 'Viewer' },
];

function seedIfEmpty() {
  const permCount = db.prepare('SELECT COUNT(*) AS c FROM permissions').get().c;
  if (permCount > 0) return;

  const insertPerm = db.prepare(
    'INSERT INTO permissions (id, key, label) VALUES (?, ?, ?)',
  );
  const permIds = {};
  for (const p of PERMISSION_DEFS) {
    const id = uuidv4();
    permIds[p.key] = id;
    insertPerm.run(id, p.key, p.label);
  }

  const insertRole = db.prepare('INSERT INTO roles (id, key, label) VALUES (?, ?, ?)');
  const roleIds = {};
  for (const r of ROLE_DEFS) {
    const id = uuidv4();
    roleIds[r.key] = id;
    insertRole.run(id, r.key, r.label);
  }

  const link = db.prepare(
    'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
  );
  const allPerms = Object.values(permIds);
  for (const pk of allPerms) {
    link.run(roleIds.admin, pk);
  }
  for (const k of ['view_dashboard', 'control_relay', 'view_analytics']) {
    link.run(roleIds.operator, permIds[k]);
  }
  for (const k of ['view_dashboard', 'view_analytics']) {
    link.run(roleIds.viewer, permIds[k]);
  }

  const now = Math.floor(Date.now() / 1000);
  const insertUser = db.prepare(
    `INSERT INTO users (id, email, password_hash, name, active, created_at)
     VALUES (?, ?, ?, ?, 1, ?)`,
  );
  const linkUserRole = db.prepare(
    'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
  );

  const demoUsers = [
    { email: 'admin@demo.local', password: 'Admin123!', name: 'Admin User', role: 'admin' },
    { email: 'operator@demo.local', password: 'Operator123!', name: 'Operator User', role: 'operator' },
    { email: 'viewer@demo.local', password: 'Viewer123!', name: 'Viewer User', role: 'viewer' },
  ];

  for (const u of demoUsers) {
    const uid = uuidv4();
    const hash = bcrypt.hashSync(u.password, 10);
    insertUser.run(uid, u.email, hash, u.name, now);
    linkUserRole.run(uid, roleIds[u.role]);
  }
}

initSchema();
seedIfEmpty();

function getUserWithAuth(email) {
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.active, u.password_hash, r.key AS role_key, r.label AS role_label
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       WHERE LOWER(u.email) = LOWER(?)`,
    )
    .get(email);
  return row || null;
}

function getUserById(id) {
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.active, r.key AS role_key, r.label AS role_label
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       WHERE u.id = ?`,
    )
    .get(id);
  return row || null;
}

function permissionsForRoleKey(roleKey) {
  return db
    .prepare(
      `SELECT p.key
       FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       JOIN roles r ON r.id = rp.role_id
       WHERE r.key = ?
       ORDER BY p.key`,
    )
    .all(roleKey)
    .map((x) => x.key);
}

function listUsers() {
  return db
    .prepare(
      `SELECT u.id, u.email, u.name, u.active, u.created_at, r.key AS role_key, r.label AS role_label
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       ORDER BY u.email`,
    )
    .all();
}

function listRolesWithPermissions() {
  const roles = db.prepare('SELECT id, key, label FROM roles ORDER BY key').all();
  const permRows = db
    .prepare(
      `SELECT r.key AS role_key, p.key AS permission_key
       FROM role_permissions rp
       JOIN roles r ON r.id = rp.role_id
       JOIN permissions p ON p.id = rp.permission_id`,
    )
    .all();
  const map = {};
  for (const r of roles) {
    map[r.key] = { ...r, permissions: [] };
  }
  for (const pr of permRows) {
    map[pr.role_key].permissions.push(pr.permission_key);
  }
  return Object.values(map);
}

function allPermissionKeys() {
  return db.prepare('SELECT key, label FROM permissions ORDER BY key').all();
}

function setRolePermissions(roleKey, permissionKeys) {
  const role = db.prepare('SELECT id FROM roles WHERE key = ?').get(roleKey);
  if (!role) return false;
  const valid = new Set(
    db
      .prepare('SELECT key FROM permissions')
      .all()
      .map((x) => x.key),
  );
  for (const k of permissionKeys) {
    if (!valid.has(k)) throw new Error(`Unknown permission: ${k}`);
  }
  const del = db.prepare('DELETE FROM role_permissions WHERE role_id = ?');
  const ins = db.prepare(
    'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
  );
  const permIds = db.prepare('SELECT id, key FROM permissions').all();
  const idByKey = Object.fromEntries(permIds.map((p) => [p.key, p.id]));

  const tx = db.transaction(() => {
    del.run(role.id);
    for (const k of permissionKeys) {
      ins.run(role.id, idByKey[k]);
    }
  });
  tx();
  return true;
}

function createUser({ email, password, name, roleKey }) {
  const role = db.prepare('SELECT id FROM roles WHERE key = ?').get(roleKey);
  if (!role) return { error: 'invalid_role' };
  const exists = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  if (exists) return { error: 'email_taken' };
  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  const now = Math.floor(Date.now() / 1000);
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO users (id, email, password_hash, name, active, created_at)
       VALUES (?, ?, ?, ?, 1, ?)`,
    ).run(id, email.trim().toLowerCase(), hash, name.trim(), now);
    db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').run(id, role.id);
  });
  tx();
  return { user: getUserById(id) };
}

function updateUser(userId, { name, roleKey, active }) {
  const u = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!u) return { error: 'not_found' };
  if (name != null) {
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), userId);
  }
  if (active !== undefined) {
    db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, userId);
  }
  if (roleKey) {
    const role = db.prepare('SELECT id FROM roles WHERE key = ?').get(roleKey);
    if (!role) return { error: 'invalid_role' };
    db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(userId);
    db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').run(userId, role.id);
  }
  return { user: getUserById(userId) };
}

module.exports = {
  db,
  getUserWithAuth,
  getUserById,
  permissionsForRoleKey,
  listUsers,
  listRolesWithPermissions,
  allPermissionKeys,
  setRolePermissions,
  createUser,
  updateUser,
};
