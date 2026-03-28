const express = require('express');
const { requireAuth, requirePermission } = require('../middleware/auth');
const {
  listRolesWithPermissions,
  allPermissionKeys,
  setRolePermissions,
} = require('../db');

const router = express.Router();

router.use(requireAuth, requirePermission('manage_users'));

router.get('/', (req, res) => {
  res.json({
    roles: listRolesWithPermissions(),
    allPermissions: allPermissionKeys(),
  });
});

router.patch('/:roleKey/permissions', (req, res) => {
  const { roleKey } = req.params;
  const { permissionKeys } = req.body || {};
  if (!Array.isArray(permissionKeys)) {
    return res.status(400).json({ error: 'permissionKeys_must_be_array' });
  }
  if (roleKey === 'admin' && !permissionKeys.includes('manage_users')) {
    return res.status(400).json({ error: 'admin_must_retain_manage_users' });
  }
  try {
    const ok = setRolePermissions(roleKey, permissionKeys);
    if (!ok) return res.status(404).json({ error: 'role_not_found' });
    const roles = listRolesWithPermissions();
    const updated = roles.find((r) => r.key === roleKey);
    res.json({ role: updated });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
