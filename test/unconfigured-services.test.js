import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCard } from './harness.js';

function quiet(run) {
  const prev = console.error;
  console.error = () => {};
  return Promise.resolve(run()).finally(() => { console.error = prev; });
}

test('capabilities settle Emby and Kodi, and an old integration leaves them unknown', async () => {
  const card = makeCard();
  card._capsLoaded = false;
  card._callApi = async () => ({ emby: false, kodi: true });
  await card._fetchCapabilities();
  assert.equal(card._embyConfigured, false);
  assert.equal(card._kodiConfigured, true);

  const old = makeCard();
  old._capsLoaded = false;
  old._embyConfigured = null;
  old._kodiConfigured = null;
  old._callApi = async () => ({});
  await old._fetchCapabilities();
  assert.equal(old._embyConfigured, null);
  assert.equal(old._kodiConfigured, null);
});

test('Emby and Kodi known not to be set up are never asked', async () => {
  const card = makeCard();
  let asked = 0;
  card._callApi = async () => { asked++; return {}; };
  card._embyConfigured = false;
  card._kodiConfigured = false;
  card._embyLastFetch = 0;
  card._kodiLastFetch = 0;
  await card._fetchEmbySessions();
  await card._fetchKodiSessions();
  assert.equal(asked, 0);
});

test('without capabilities, the first answer settles Emby and Kodi', async () => {
  const card = makeCard();
  card._embyConfigured = null;
  card._kodiConfigured = null;
  card._embyLastFetch = 0;
  card._kodiLastFetch = 0;
  card._callApi = async (m, path) => path.includes('emby')
    ? { _notConfigured: true }
    : { sessions: [], known_ids: [] };
  await card._fetchEmbySessions();
  await card._fetchKodiSessions();
  assert.equal(card._embyConfigured, false);
  assert.equal(card._kodiConfigured, false);
});

test('a Kodi error on the integration side is asked again', async () => {
  const card = makeCard();
  card._kodiConfigured = null;
  card._kodiLastFetch = 0;
  card._callApi = async () => ({ sessions: [] });
  await card._fetchKodiSessions();
  assert.notEqual(card._kodiConfigured, false);
});

test('a Bazarr known not to be set up is never asked', async () => {
  const card = makeCard();
  let asked = 0;
  card._callApi = async () => { asked++; return { data: [] }; };
  card._bazarrConfigured = false;
  await card._fetchBazarr();
  assert.equal(asked, 0);
  assert.equal(card._bazarrConfigured, false, 'an empty answer does not turn it back on');
});

test('Bazarr is dropped on "not configured", kept on a connection error', async () => {
  const card = makeCard();
  const fail = (status, body) => { card._callApi = async () => { const e = new Error('nope'); e.status_code = status; e.body = body; throw e; }; };

  card._bazarrConfigured = true;
  fail(503, { error: 'Nelze se připojit: Cannot connect to host bazarr:6767' });
  await quiet(() => card._fetchBazarr());
  assert.equal(card._bazarrConfigured, true, 'a restart is not "not set up"');

  fail(503, { error: 'Bazarr not configured' });
  await quiet(() => card._fetchBazarr());
  assert.equal(card._bazarrConfigured, false);
});
