// The analytics ping: which services it reports, and that it reports none
// before the integration has said what is set up.
import test from 'node:test';
import assert from 'node:assert';
import { makeCard } from './harness.js';

// Captures what _sendPing posts instead of letting it leave the process.
function capture(card) {
  const sent = [];
  const prev = globalThis.fetch;
  globalThis.fetch = (url, opts) => {
    sent.push(JSON.parse(opts.body));
    return Promise.resolve({ ok: true });
  };
  try { card._sendPing(); } finally { globalThis.fetch = prev; }
  return sent;
}

test('no service list before the capabilities have loaded', () => {
  const card = makeCard();
  card._capsLoaded = false;
  // The constructor defaults: true for qBittorrent and Bazarr, unknown for the
  // rest — exactly what used to be reported as installed.
  card._qbitConfigured = true;
  card._bazarrConfigured = true;
  card._overseerrConfigured = null;
  const [body] = capture(card);
  assert.ok(body, 'a ping is still sent');
  assert.ok(!('svcs' in body), 'but without services');
});

test('the service list rides along once they have', () => {
  const card = makeCard();
  card._capsLoaded = true;
  card._qbitConfigured = true;
  card._bazarrConfigured = false;
  const [body] = capture(card);
  assert.ok(Array.isArray(body.svcs));
  assert.ok(body.svcs.includes('qbit'));
  assert.ok(!body.svcs.includes('bazarr'));
});

test('an opted-out install sends nothing at all', () => {
  const card = makeCard();
  card._capsLoaded = true;
  card._metricsOptOut = true;
  assert.strictEqual(capture(card).length, 0);
});

test('activation is reported once, and says so', () => {
  const card = makeCard();
  // The harness silences activation for every other test; this one needs the
  // real method from the prototype.
  delete card._markActivated;
  card._capsLoaded = true;
  const sent = [];
  const prev = globalThis.fetch;
  globalThis.fetch = (url, opts) => { sent.push(JSON.parse(opts.body)); return Promise.resolve({ ok: true }); };
  try {
    card._markActivated();
    card._markActivated();
  } finally { globalThis.fetch = prev; }
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0].act, 1);
});

// Captures every ping sent while `run` does its work.
function captureAll(card, run) {
  const sent = [];
  const prev = globalThis.fetch;
  globalThis.fetch = (url, opts) => {
    sent.push(JSON.parse(opts.body));
    return Promise.resolve({ ok: true });
  };
  try { run(); } finally { globalThis.fetch = prev; }
  return sent;
}

test('a window that failed to load is reported once per window', () => {
  const card = makeCard();
  card._capsLoaded = true;
  const sent = captureAll(card, () => {
    card._reportChunkFailure('tracearr');
    card._reportChunkFailure('tracearr');
    card._reportChunkFailure('jellystat');
  });
  assert.deepEqual(sent.map(b => b.cf), ['tracearr', 'jellystat'],
    'the same window twice in one session is one ping');
  assert.ok(Array.isArray(sent[0].svcs),
    'and it is an ordinary ping otherwise, so the install is known by its services');
});

test('an opted-out install reports no failed window either', () => {
  const card = makeCard();
  card._capsLoaded = true;
  card._metricsOptOut = true;
  const sent = captureAll(card, () => card._reportChunkFailure('tracearr'));
  assert.deepEqual(sent, []);
});

// The install id: a hash the integration hands over, never anything derived
// from the address Home Assistant is reached at.
test('the integration\'s installation id is the sid', () => {
  const card = makeCard();
  card._iid = '0123456789abcdef';
  const [body] = capture(card);
  assert.equal(body.sid, '0123456789abcdef');
});

test('without it, a random id is kept in this browser', () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };
  const card = makeCard();
  card._iid = null;
  const [first] = capture(card);
  assert.match(first.sid, /^[0-9a-f]{16}$/);
  const again = makeCard();
  again._iid = null;
  const [second] = capture(again);
  assert.equal(second.sid, first.sid, 'the same browser keeps its id');
});

test('the sid never carries the hostname', () => {
  const card = makeCard();
  card._iid = null;
  const legacy = btoa(location.hostname).replace(/=/g, '').slice(0, 16);
  const [body] = capture(card);
  assert.notEqual(body.sid, legacy);
});

test('the old id goes once, so the history can follow, and then never again', () => {
  // The test page has no hostname at all; a real one always does
  const prevLoc = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Object.defineProperty(globalThis, 'location', { value: { hostname: 'homeassistant.local' }, configurable: true });
  const store = new Map();
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };
  const card = makeCard();
  card._iid = '0123456789abcdef';
  const [first] = capture(card);
  assert.ok(first.lsid, 'the first ping names the old id');
  const [second] = capture(card);
  assert.ok(!('lsid' in second), 'and only the first');
  const other = makeCard();
  other._iid = '0123456789abcdef';
  const [third] = capture(other);
  assert.ok(!('lsid' in third), 'not even after the page is reloaded');
  if (prevLoc) Object.defineProperty(globalThis, 'location', prevLoc);
});

test('a malformed id from the integration is not used', async () => {
  const card = makeCard();
  card._capsLoaded = false;
  card._callApi = async () => ({ iid: 'not-a-hash', metrics: true });
  await card._fetchCapabilities();
  assert.ok(!card._iid);
});
