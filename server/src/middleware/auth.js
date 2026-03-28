const jwt = require('jsonwebtoken');
const { getUserById, permissionsForRoleKey } = require('../db');

function signToken(userRow) {
  const secret = process.env.JWT_SECRET || 'dev-only-secret';
  const permissions = permissionsForRoleKey(userRow.role_key);
  return jwt.sign(
    {
      sub: userRow.id,
      email: userRow.email,
      role: userRow.role_key,
      permissions,
    },
    secret,
    { expiresIn: '8h' },
  );
}

function verifyToken(token) {
  const secret = process.env.JWT_SECRET || 'dev-only-secret';
  return jwt.verify(token, secret);
}

function attachUserMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    const payload = verifyToken(token);
    const row = getUserById(payload.sub);
    if (!row || !row.active) {
      req.user = null;
      return next();
    }
    const permissions = permissionsForRoleKey(row.role_key);
    req.user = {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role_key,
      roleLabel: row.role_label,
      permissions,
    };
  } catch {
    req.user = null;
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

function requirePermission(key) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    if (!req.user.permissions.includes(key)) {
      return res.status(403).json({ error: 'forbidden', required: key });
    }
    next();
  };
}

module.exports = {
  signToken,
  verifyToken,
  attachUserMiddleware,
  requireAuth,
  requirePermission,
};
