// The editor's Styles tab (#42)
import test from 'node:test';
import assert from 'node:assert/strict';
import { setStyle, stylesTabHtml } from '../src/editor-styles.js';

test('a key is written where it belongs, and removing it folds the empty group away', () => {
  let s = setStyle({ preset: 'ha' }, ['left'], 'text', '#fff');
  assert.deepEqual(s, { preset: 'ha', left: { text: '#fff' } });
  s = setStyle(s, ['left'], 'text', undefined);
  assert.deepEqual(s, { preset: 'ha' });
  s = setStyle(s, ['modalDay'], 'radius', 4);
  assert.deepEqual(s.modalDay, { radius: 4 });
});

test('the tab shows what is set, counts it on the group, and keeps groups open', () => {
  const ed = { _config: { styles: { preset: 'solid', text: '#e6e6e6', right: { radius: 8 }, modal: { background: 'linear-gradient(red, blue)' } } },
               _stOpen: new Set(['text', 'text.card']) };
  const html = stylesTabHtml(ed);
  assert.match(html, /<option value="solid" selected>/);
  assert.match(html, /data-st-group="text" open>/);
  assert.match(html, /data-st-group="text.card" open>/);
  assert.match(html, /data-st-path="" data-st-key="text" data-st-kind="color" value="#e6e6e6"/);
  assert.match(html, /data-st-path="right" data-st-key="radius" data-st-kind="px" min="0" step="1" value="8"/);
  // A gradient keeps its text and leaves the swatch at the default
  assert.match(html, /data-st-path="modal" data-st-key="background" data-st-kind="paint" value="#0a0a16"/);
  assert.match(html, /value="linear-gradient\(red, blue\)"/);
});

test('a value cannot break out of its attribute', () => {
  const html = stylesTabHtml({ _config: { styles: { border: '"><img src=x onerror=alert(1)>' } } });
  assert.ok(!html.includes('<img'));
});

test('transparency: sliders at 100 % until set, and a surface carries its opacity', () => {
  const html = stylesTabHtml({ _config: { styles: {
    boxOpacity: 40, background: 'rgba(18, 18, 22, 0.6)', left: { background: 'linear-gradient(red, blue)' },
  } } });
  assert.match(html, /data-st-path="" data-st-key="boxOpacity" data-st-kind="pct" min="0" max="200" step="5" value="40"/);
  assert.match(html, /data-st-path="" data-st-key="lineOpacity" data-st-kind="pct" min="0" max="200" step="5" value="100"/);
  assert.match(html, /data-st-key="tintOpacity" data-st-kind="pct" min="0" max="100"/);
  // rgba keeps its alpha on the slider; a gradient has none to change
  const whole = html.slice(html.indexOf('data-st-group="panels.card"'), html.indexOf('data-st-group="panels.left"'));
  assert.match(whole, /class="st-range st-alpha" min="0" max="100" step="1" value="60"/);
  const left = html.slice(html.indexOf('data-st-group="panels.left"'), html.indexOf('data-st-group="panels.right"'));
  assert.match(left, /class="st-range st-alpha"[^>]*value="100" disabled/);
});
