// The playback line on a Now Playing tile: from what, how, to what, and the
// rate — read from each server's own session, and shown only when switched on.
import test from 'node:test';
import assert from 'node:assert';
import { makeCard } from './harness.js';
import { resLabel, jfTech, plexTech, fmtRate } from '../src/shared/playback.js';

test('a resolution is named by its width first', () => {
  assert.equal(resLabel(1920, 800), '1080p', 'a scope film is still 1080p');
  assert.equal(resLabel(3840, 1600), '4K');
  assert.equal(resLabel(1280, 720), '720p');
  assert.equal(resLabel(720, 576), 'SD');
  assert.equal(resLabel(0, 0, '1080'), '1080p', 'Plex words it for us');
  assert.equal(resLabel(0, 0, 'sd'), 'SD');
  assert.equal(resLabel(0, 0, '4k'), '4K');
  assert.equal(resLabel(), '');
});

test('a rate reads in megabits, or kilobits below one', () => {
  assert.equal(fmtRate(8200), '8.2 Mbps');
  assert.equal(fmtRate(24300), '24 Mbps');
  assert.equal(fmtRate(320), '320 kbps');
  assert.equal(fmtRate(0), '');
});

const JF_VIDEO = [
  { Type: 'Video', Width: 1920, Height: 1080, BitRate: 9000000 },
  { Type: 'Audio', Index: 1, BitRate: 640000, IsDefault: true },
];

test('Jellyfin: direct play keeps the source both ends', () => {
  const t = jfTech({ NowPlayingItem: { MediaStreams: JF_VIDEO }, PlayState: { PlayMethod: 'DirectPlay', AudioStreamIndex: 1 } });
  assert.deepEqual(t, { from: '1080p', method: 'direct', to: '1080p', kbps: 9640 });
});

test('Jellyfin: a transcode names what it sends', () => {
  const t = jfTech({
    NowPlayingItem: { MediaStreams: JF_VIDEO },
    PlayState: { PlayMethod: 'Transcode' },
    TranscodingInfo: { Width: 1280, Height: 720, Bitrate: 4000000, IsVideoDirect: false },
  });
  assert.deepEqual(t, { from: '1080p', method: 'transcode', to: '720p', kbps: 4000 });
});

test('Jellyfin: a remux with the picture untouched is a direct stream', () => {
  const t = jfTech({
    NowPlayingItem: { MediaStreams: JF_VIDEO },
    PlayState: { PlayMethod: 'Transcode' },
    TranscodingInfo: { Bitrate: 9300000, IsVideoDirect: true },
  });
  assert.equal(t.method, 'stream');
  assert.equal(t.to, '1080p');
});

test('Jellyfin: a track is named by its codec', () => {
  const t = jfTech({
    NowPlayingItem: { MediaStreams: [{ Type: 'Audio', Codec: 'flac', BitRate: 1000000 }] },
    PlayState: { PlayMethod: 'Transcode' },
    TranscodingInfo: { AudioCodec: 'mp3', Bitrate: 320000 },
  });
  assert.deepEqual(t, { from: 'FLAC', method: 'transcode', to: 'MP3', kbps: 320 });
});

test('Jellyfin: no play method, nothing to say', () => {
  assert.equal(jfTech({ NowPlayingItem: {}, PlayState: {} }), null);
});

test('Plex: no transcode session is direct play', () => {
  const t = plexTech({ type: 'movie', Media: [{ videoResolution: 'sd', bitrate: 2100, Part: [{}] }] });
  assert.deepEqual(t, { from: 'SD', method: 'direct', to: 'SD', kbps: 2100 });
});

test('Plex: a transcode starts from the library item', () => {
  const s = {
    type: 'movie',
    Media: [{ videoResolution: '720', bitrate: 4000, Part: [{ decision: 'transcode' }] }],
    TranscodeSession: { videoDecision: 'transcode', width: 1280, height: 720 },
  };
  assert.equal(plexTech(s).from, '', 'the start is unknown until the item is read');
  const t = plexTech(s, { Media: [{ width: 3840, height: 2160 }] });
  assert.deepEqual(t, { from: '4K', method: 'transcode', to: '720p', kbps: 4000 });
});

test('Plex: a copied picture is a direct stream', () => {
  const t = plexTech({
    type: 'episode',
    Media: [{ videoResolution: '1080', bitrate: 8000, Part: [{ decision: 'transcode' }] }],
    TranscodeSession: { videoDecision: 'copy', audioDecision: 'transcode' },
  });
  assert.equal(t.method, 'stream');
  assert.equal(t.from, '1080p');
});

function tile(cfg, tech) {
  const c = makeCard();
  c._config = { ...(c._config || {}), ...cfg };
  return c._renderStreamCard({ id: 'jellyfin:s1', state: 'playing', attr: { media_content_type: 'movie', media_title: 'Film', _tech: tech } });
}

const TECH = { from: 'SD', method: 'direct', to: 'SD', kbps: 8200 };

test('the line stays off unless the card asks for it', () => {
  assert.doesNotMatch(tile({}, TECH), /stream-tech/);
  assert.doesNotMatch(tile({ streams: { showTechInfo: false } }, TECH), /stream-tech/);
});

test('switched on, the tile says how the stream travels', () => {
  const html = tile({ streams: { showTechInfo: true } }, TECH);
  assert.match(html, /class="stream-tech-tag stream-tech-direct/);
  assert.match(html, /<span class="stream-tech-m">Direct Play<\/span><span class="stream-tech-rate">SD · 8\.2 Mbps<\/span>/,
    'how on top; the picture once, then the rate');
});

test('a transcode names both ends', () => {
  const html = tile({ streams: { showTechInfo: true } }, { from: '4K', method: 'transcode', to: '720p', kbps: 4000 });
  assert.match(html, /stream-tech-transcode/);
  assert.match(html, /<span class="stream-tech-m">Transcode<\/span><span class="stream-tech-rate">4K→720p · 4\.0 Mbps/);
});

test('each method is told apart by what it costs the server', () => {
  const on = { streams: { showTechInfo: true } };
  assert.match(tile(on, { from: '4K', method: 'direct', to: '4K', kbps: 1 }), /stream-tech-direct/);
  assert.match(tile(on, { from: '4K', method: 'stream', to: '4K', kbps: 1 }), /stream-tech-stream/);
  assert.match(tile(on, { from: '4K', method: 'transcode', to: '1080p', kbps: 1 }), /stream-tech-transcode/);
});

test('it sits under the person watching, or where that tag would be', () => {
  const c = makeCard();
  const on = { streams: { showTechInfo: true } };
  c._config = { ...(c._config || {}), ...on };
  const alone = c._renderStreamCard({ id: 'jellyfin:s1', state: 'playing', attr: { media_content_type: 'movie', media_title: 'Film', _tech: TECH } });
  assert.match(alone, /stream-tech-tag stream-tech-direct stream-tech-up/, 'no user tag: it moves up into its place');
  const withUser = c._renderStreamCard({ id: 'jellyfin:s1', state: 'playing', attr: { media_content_type: 'movie', media_title: 'Film', _jfUser: 'argi', _tech: TECH } });
  assert.match(withUser, /stream-user-tag/);
  assert.match(withUser, /class="stream-tech-tag stream-tech-direct"/, 'with one: underneath it');
});

test('switched on with nothing known, the tile is unchanged', () => {
  assert.doesNotMatch(tile({ streams: { showTechInfo: true } }, undefined), /stream-tech/);
});

// A Plex player in Home Assistant and the session behind it are the same item,
// and the item is what pairs them — the names fall out of step the moment a
// track changes.
test('a Plex player is paired with its session by the item, not the name', () => {
  const c = makeCard();
  c._plexSessions = [
    { id: 'plex:a', _plexRatingKey: '111', attr: { media_title: 'Old track', _tech: { method: 'direct' } } },
    { id: 'plex:b', _plexRatingKey: '222', attr: { media_title: 'Something else', _tech: { method: 'transcode' } } },
  ];
  const hit = c._streamPlexSession('media_player.plex_plexamp', { media_content_id: 222, media_title: 'New track' });
  assert.equal(hit?.id, 'plex:b');
});

test('without an item id the name still pairs them', () => {
  const c = makeCard();
  c._plexSessions = [{ id: 'plex:a', attr: { media_title: 'Film', media_series_title: '' } }];
  assert.equal(c._streamPlexSession('media_player.plex_tv', { media_title: 'Film' })?.id, 'plex:a');
});

test('a session that moved on reads differently, an unchanged one the same', () => {
  const c = makeCard();
  c._plexSessions = [{ id: 'plex:a', _plexRatingKey: '1', attr: { _tech: { method: 'direct', kbps: 1000 } } }];
  const before = c._streamSessionSig();
  assert.equal(c._streamSessionSig(), before, 'nothing changed, nothing to redraw');
  c._plexSessions = [{ id: 'plex:a', _plexRatingKey: '2', attr: { _tech: { method: 'direct', kbps: 1000 } } }];
  assert.notEqual(c._streamSessionSig(), before, 'the next track');
  const next = c._streamSessionSig();
  c._plexSessions[0].attr._tech = { method: 'transcode', kbps: 4000 };
  assert.notEqual(c._streamSessionSig(), next, 'or the same one, now transcoded');
});
