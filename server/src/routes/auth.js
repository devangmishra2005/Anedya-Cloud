const express = require('express');
const bcrypt = require('bcryptjs');
const { getUserWithAuth, getUserById, permissionsForRoleKey } = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email_and_password_required' });
  }
  const row = getUserWithAuth(email);
  if (!row || !row.active) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  const ok = bcrypt.compareSync(password, row.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  const user = getUserById(row.id);
  const permissions = permissionsForRoleKey(user.role_key);
  const token = signToken(user);
  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role_key,
      roleLabel: user.role_label,
      permissions,
    },
  });
});

router.get('/me', requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

/** Re-issue JWT from DB (e.g. after role/permission templates change). */
router.post('/refresh', requireAuth, (req, res) => {
  const user = getUserById(req.user.id);
  if (!user || !user.active) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const permissions = permissionsForRoleKey(user.role_key);
  const token = signToken(user);
  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role_key,
      roleLabel: user.role_label,
      permissions,
    },
  });
});

module.exports = router;
