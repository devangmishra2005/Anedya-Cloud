const express = require('express');
const { requireAuth, requirePermission } = require('../middleware/auth');
const anedya = require('../services/anedya');

const router = express.Router();

router.use(requireAuth);

router.get(
  '/snapshot',
  requirePermission('view_dashboard'),
  async (req, res, next) => {
    try {
      const snapshot = await anedya.getSnapshot();
      res.json(snapshot);
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  '/history',
  requirePermission('view_analytics'),
  async (req, res, next) => {
    try {
      const metric = req.query.metric === 'humidity' ? 'humidity' : 'temperature';
      const now = Math.floor(Date.now() / 1000);
      const from = Number(req.query.from) || now - 24 * 3600;
      const to = Number(req.query.to) || now;
      const history = await anedya.getHistory(metric, from, to);
      res.json(history);
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/relay',
  requirePermission('control_relay'),
  async (req, res, next) => {
    try {
      const on = req.body?.state === true || req.body?.state === 'on';
      const result = await anedya.sendRelayCommand(on);
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

router.get('/status', requireAuth, (req, res) => {
  res.json({
    anedyaConfigured: anedya.isConfigured(),
  });
});

module.exports = router;
