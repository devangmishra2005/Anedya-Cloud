const express = require('express');
const { requireAuth, requirePermission } = require('../middleware/auth');
const {
  listUsers,
  createUser,
  updateUser,
  permissionsForRoleKey,
} = require('../db');

const router = express.Router();

function formatUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    active: Boolean(u.active),
    role: u.role_key,
    roleLabel: u.role_label,
    permissions: permissionsForRoleKey(u.role_key),
  };
}

router.use(requireAuth, requirePermission('manage_users'));

router.get('/', (req, res) => {
  const users = listUsers().map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    active: Boolean(u.active),
    createdAt: u.created_at,
    role: u.role_key,
    roleLabel: u.role_label,
    permissions: permissionsForRoleKey(u.role_key),
  }));
  res.json({ users });
});

router.post('/', (req, res) => {
  const { email, password, name, role } = req.body || {};
  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'missing_fields' });
  }
  const out = createUser({ email, password, name, roleKey: role });
  if (out.error === 'email_taken') {
    return res.status(409).json({ error: 'email_taken' });
  }
  if (out.error === 'invalid_role') {
    return res.status(400).json({ error: 'invalid_role' });
  }
  res.status(201).json({ user: formatUser(out.user) });
});

router.patch('/:id', (req, res) => {
  const { id } = req.params;
  if (id === req.user.id && req.body && req.body.active === false) {
    return res.status(400).json({ error: 'cannot_deactivate_self' });
  }
  const { name, role, active } = req.body || {};
  const out = updateUser(id, {
    name,
    roleKey: role,
    active,
  });
  if (out.error === 'not_found') return res.status(404).json({ error: 'not_found' });
  if (out.error === 'invalid_role') return res.status(400).json({ error: 'invalid_role' });
  res.json({ user: formatUser(out.user) });
});

module.exports = router;
