// The torrent queues open in the order the card is set to, and a sort picked
// with the buttons is not undone by an unrelated edit in the card editor.
import test from 'node:test';
import assert from 'node:assert';
import { makeCard } from './harness.js';

const SORTS = ['_sort', '_sortDeluge', '_sortRtorrent', '_sortTransmission'];

test('the queues open in the configured order', () => {
  const card = makeCard({ _pages: {} });
  card.setConfig({ downloads: { defaultSort: 'added_desc' } });
  for (const k of SORTS) assert.equal(card[k], 'added_desc', k);
});

test('without the setting, or with a value it does not know, it is progress first', () => {
  const card = makeCard({ _pages: {} });
  card.setConfig({});
  for (const k of SORTS) assert.equal(card[k], 'progress_desc', k);
  const other = makeCard({ _pages: {} });
  other.setConfig({ downloads: { defaultSort: 'name_asc' } });
  for (const k of SORTS) assert.equal(other[k], 'progress_desc', k);
});

test('a sort picked with the buttons survives an unrelated edit', () => {
  const card = makeCard({ _pages: {} });
  card.setConfig({ downloads: { defaultSort: 'speed_desc' } });
  card._sort = 'added_asc';
  card.setConfig({ downloads: { defaultSort: 'speed_desc', torrentItems: 5 } });
  assert.equal(card._sort, 'added_asc');
});

test('changing the setting takes over, back to the first page', () => {
  const card = makeCard({ _pages: { qbit: 2, deluge: 1 } });
  card.setConfig({ downloads: { defaultSort: 'speed_desc' } });
  card._sort = 'added_asc';
  card._pages.qbit = 2;
  card.setConfig({ downloads: { defaultSort: 'progress_asc' } });
  for (const k of SORTS) assert.equal(card[k], 'progress_asc', k);
  assert.equal(card._pages.qbit, 0);
  assert.equal(card._pages.deluge, 0);
});
