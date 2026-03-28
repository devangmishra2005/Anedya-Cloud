/**
 * Anedya Platform API client + deterministic demo fallback.
 * Configure ANEDYA_* env vars; when ANEDYA_API_KEY is empty, mock data is used.
 *
 * Real endpoints follow docs.anedya.io (paths may include a version prefix depending on account).
 * Adjust ANEDYA_BASE_URL to match your dashboard/API base if requests fail.
 */

function env(name, fallback = '') {
  const v = process.env[name];
  return v == null || v === '' ? fallback : v;
}

const MOCK_SEED = 42;

/** In mock mode, relay toggles persist in-process for realistic control UX. */
let mockRelayOverride = null;

function pseudoRandom(t) {
  const x = Math.sin(MOCK_SEED + t) * 10000;
  return x - Math.floor(x);
}

function mockSnapshot() {
  const t = Date.now() / 1000;
  const temp = 22 + 6 * Math.sin(t / 120) + (pseudoRandom(t) - 0.5) * 0.8;
  const humidity = 45 + 15 * Math.cos(t / 200) + (pseudoRandom(t + 1) - 0.5) * 2;
  const relayOn =
    mockRelayOverride !== null ? mockRelayOverride : Math.sin(t / 300) > 0;
  const online = pseudoRandom(t + 2) > 0.05;
  return {
    source: 'mock',
    deviceId: 'demo-device',
    online,
    temperatureC: Math.round(temp * 10) / 10,
    humidityPct: Math.round(humidity * 10) / 10,
    relayOn,
    updatedAt: Math.floor(t),
  };
}

function mockHistory(metric, fromSec, toSec) {
  const step = Math.max(60, Math.floor((toSec - fromSec) / 80));
  const points = [];
  for (let ts = fromSec; ts <= toSec; ts += step) {
    if (metric === 'humidity') {
      const v = 45 + 15 * Math.cos(ts / 200) + (pseudoRandom(ts) - 0.5) * 3;
      points.push({ ts, value: Math.round(v * 10) / 10 });
    } else {
      const v = 22 + 6 * Math.sin(ts / 120) + (pseudoRandom(ts + 0.5) - 0.5) * 1.2;
      points.push({ ts, value: Math.round(v * 10) / 10 });
    }
  }
  return { source: 'mock', metric, points };
}

function isConfigured() {
  return Boolean(env('ANEDYA_API_KEY'));
}

async function anedyaFetch(path, body) {
  const base = env('ANEDYA_BASE_URL', 'https://api.ap-in-1.anedya.io').replace(/\/$/, '');
  const key = env('ANEDYA_API_KEY');
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`Anedya HTTP ${res.status}`);
    err.details = json;
    throw err;
  }
  return json;
}

/**
 * Maps Anedya getData-style response to { points: { ts, value }[] }.
 * Customize parsing once you confirm your project's response shape.
 */
function normalizeHistoryResponse(metric, apiJson) {
  if (!apiJson) return { metric, points: [] };
  const rows =
    apiJson.data ||
    apiJson.values ||
    apiJson.points ||
    apiJson.result ||
    apiJson.series ||
    [];
  if (!Array.isArray(rows)) return { metric, points: [] };
  const points = rows
    .map((row) => {
      const ts = row.ts ?? row.timestamp ?? row.time ?? row.t;
      const value = row.value ?? row.val ?? row.data ?? row.float ?? row.number;
      if (ts == null || value == null) return null;
      const n = typeof value === 'object' && value !== null ? value.value ?? value.v : value;
      return { ts: Number(ts), value: Number(n) };
    })
    .filter(Boolean);
  return { metric, points };
}

async function fetchLatestFromVariable(variableId) {
  const now = Math.floor(Date.now() / 1000);
  const body = {
    variableId,
    fromTs: now - 3600,
    toTs: now,
    limit: 1,
    sort: 'desc',
  };
  try {
    const json = await anedyaFetch('/data/getData', body);
    const { points } = normalizeHistoryResponse('x', {
      data: json.data || json.records || json,
    });
    const last = points.length ? points[points.length - 1] : null;
    return last ? last.value : null;
  } catch {
    return null;
  }
}

async function fetchRealSnapshot() {
  const nodeId = env('ANEDYA_NODE_ID');
  const tempVar = env('ANEDYA_VARIABLE_TEMP_ID');
  const humVar = env('ANEDYA_VARIABLE_HUMIDITY_ID');

  let temperatureC = null;
  let humidityPct = null;
  if (tempVar) temperatureC = await fetchLatestFromVariable(tempVar);
  if (humVar) humidityPct = await fetchLatestFromVariable(humVar);

  let online = true;
  let relayOn = false;
  try {
    if (nodeId) {
      const status = await anedyaFetch('/node/status', { nodeId });
      if (typeof status?.online === 'boolean') online = status.online;
      if (typeof status?.connected === 'boolean') online = status.connected;
    }
  } catch {
    online = false;
  }

  return {
    source: 'anedya',
    deviceId: nodeId || 'configured-node',
    online,
    temperatureC: temperatureC ?? mockSnapshot().temperatureC,
    humidityPct: humidityPct ?? mockSnapshot().humidityPct,
    relayOn,
    updatedAt: Math.floor(Date.now() / 1000),
  };
}

async function getSnapshot() {
  if (!isConfigured()) return mockSnapshot();
  try {
    return await fetchRealSnapshot();
  } catch {
    const m = mockSnapshot();
    return { ...m, source: 'mock', deviceId: 'fallback', note: 'Anedya error; showing mock' };
  }
}

async function getHistory(metric, fromSec, toSec) {
  if (!isConfigured()) return mockHistory(metric, fromSec, toSec);
  const varId =
    metric === 'humidity' ? env('ANEDYA_VARIABLE_HUMIDITY_ID') : env('ANEDYA_VARIABLE_TEMP_ID');
  if (!varId) return mockHistory(metric, fromSec, toSec);
  try {
    const json = await anedyaFetch('/data/getData', {
      variableId: varId,
      fromTs: fromSec,
      toTs: toSec,
      limit: 500,
      sort: 'asc',
    });
    return normalizeHistoryResponse(metric, json);
  } catch {
    return mockHistory(metric, fromSec, toSec);
  }
}

async function sendRelayCommand(state) {
  if (!isConfigured()) {
    mockRelayOverride = Boolean(state);
    return { ok: true, source: 'mock', queued: false, state: mockRelayOverride };
  }
  const nodeId = env('ANEDYA_NODE_ID');
  const cmdKey = env('ANEDYA_RELAY_COMMAND_KEY', 'relay_set');
  const onVal = env('ANEDYA_RELAY_ON_VALUE', '1');
  const offVal = env('ANEDYA_RELAY_OFF_VALUE', '0');
  const value = state ? onVal : offVal;
  const body = {
    nodeId,
    command: cmdKey,
    payload: { value, state: state ? 'on' : 'off' },
  };
  return anedyaFetch('/commands/send', body);
}

module.exports = {
  getSnapshot,
  getHistory,
  sendRelayCommand,
  isConfigured,
};
