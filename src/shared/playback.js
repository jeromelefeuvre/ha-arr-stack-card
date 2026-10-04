// How a stream reaches its player: what the file is, what the server does to
// it on the way, and what arrives — "1080p › Transcode › 720p · 4 Mbps".
//
// Each server says this its own way, so each is reduced here to one shape the
// card draws the same whatever played it:
//   { from, method, to, kbps }
// `from` and `to` are a resolution for video and a codec for music, `method`
// is direct | stream | transcode, and `kbps` is what goes over the wire.

// A picture's resolution, as people say it. Width decides first: a 2.39:1
// film in 1080p is only some 800 lines tall and would otherwise read as 720p.
export function resLabel(width, height, plexRes) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  if (w || h) {
    if (w >= 3200 || h >= 2000) return '4K';
    if (w >= 1800 || h >= 1000) return '1080p';
    if (w >= 1200 || h >= 700)  return '720p';
    return 'SD';
  }
  const r = String(plexRes || '').toLowerCase();
  if (!r) return '';
  if (r === '4k') return '4K';
  if (r === 'sd') return 'SD';
  const n = parseInt(r, 10);
  if (!n) return '';
  if (n >= 2000) return '4K';
  if (n >= 1000) return '1080p';
  if (n >= 700)  return '720p';
  return 'SD';
}

const codec = c => String(c || '').toUpperCase();

// Jellyfin and Emby share the session shape: the play method on PlayState and,
// while the server works on the stream, what it sends in TranscodingInfo.
export function jfTech(s) {
  const np = s?.NowPlayingItem || {};
  const ps = s?.PlayState || {};
  const ti = s?.TranscodingInfo || null;
  const streams = np.MediaStreams || [];
  const video = streams.find(x => x?.Type === 'Video');
  const audio = (ps.AudioStreamIndex != null && streams.find(x => x?.Type === 'Audio' && x.Index === ps.AudioStreamIndex))
    || streams.find(x => x?.Type === 'Audio' && x.IsDefault)
    || streams.find(x => x?.Type === 'Audio');
  const pm = String(ps.PlayMethod || '').toLowerCase();
  if (!pm && !ti) return null;

  let method = pm === 'transcode' ? 'transcode' : pm === 'directstream' ? 'stream' : 'direct';
  // Jellyfin calls a remux with its picture untouched a transcode too; the
  // picture is what costs the server, so that counts as a direct stream.
  if (method === 'transcode' && video && ti?.IsVideoDirect) method = 'stream';

  const from = video ? resLabel(video.Width, video.Height) : codec(audio?.Codec);
  let to = from;
  if (ti && method !== 'direct') {
    if (video) { if (!ti.IsVideoDirect && (ti.Width || ti.Height)) to = resLabel(ti.Width, ti.Height); }
    else if (ti.AudioCodec) to = codec(ti.AudioCodec);
  }

  const srcBps = (video?.BitRate || 0) + (audio?.BitRate || 0);
  const bps = (method !== 'direct' && ti?.Bitrate) || srcBps;
  return { from, method, to, kbps: Math.round(bps / 1000) };
}

// Plex says what it sends: the session's Media is the stream as it leaves the
// server, and TranscodeSession is there whenever the server touches it. What
// the file itself is comes from the library item, `source`, when the picture
// is being re-encoded — without it the starting point is unknown.
export function plexTech(s, source = null) {
  const media = (s?.Media || []).find(m => m?.selected) || s?.Media?.[0];
  if (!media) return null;
  const part = media.Part?.[0] || {};
  const ts = s.TranscodeSession || null;
  const isVideo = s.type !== 'track';
  const decision = String((isVideo ? ts?.videoDecision : ts?.audioDecision) || part.decision || '').toLowerCase();

  const method = decision === 'transcode' ? 'transcode'
    : decision === 'copy' ? 'stream'
    : decision === 'directplay' ? 'direct'
    : ts ? 'stream' : 'direct';

  const outLabel = isVideo
    ? resLabel(ts?.width, ts?.height, media.videoResolution) || resLabel(media.width, media.height)
    : codec(ts?.audioCodec || media.audioCodec);
  const src = (source?.Media || [])[0];
  const srcLabel = src
    ? (isVideo ? resLabel(src.width, src.height, src.videoResolution) : codec(src.audioCodec))
    : '';
  const from = srcLabel || (method === 'transcode' ? '' : outLabel);
  const kbps = Number(media.bitrate) || Number(s.Session?.bandwidth) || 0;
  return { from, method, to: outLabel, kbps };
}

// "8.2 Mbps", "24 Mbps", "320 kbps" — a track rarely reaches a megabit.
export function fmtRate(kbps) {
  const k = Number(kbps) || 0;
  if (!k) return '';
  if (k < 1000) return `${k} kbps`;
  const m = k / 1000;
  return `${m < 10 ? m.toFixed(1) : Math.round(m)} Mbps`;
}
