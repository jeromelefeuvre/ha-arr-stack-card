import { styleDeclarations } from './tokens.js';

class _ThemeMethods {

  _hexToRgb(hex) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const n = parseInt(hex, 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  }

  // Parse hex or rgb/rgba string → "R, G, B" (strips alpha)
  _parseColorRgb(str) {
    if (!str) return null;
    const s = str.trim();
    if (s.startsWith('#')) {
      let hex = s.slice(1);
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
      hex = hex.slice(0, 6);
      if (hex.length !== 6) return null;
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
      return `${r}, ${g}, ${b}`;
    }
    const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) return `${m[1]}, ${m[2]}, ${m[3]}`;
    return null;
  }

  // Inject theme CSS custom properties derived from config into shadow DOM
  _applyTheme() {
    if (!this.shadowRoot) return;
    const cfg = (this._config || {}).styles || {};
    const c = k => this._parseColorRgb(cfg[k]);
    const rules = [];

    // The keys from before the design tokens (#42), each set as the token that
    // took over its job. Paging buttons live on the right and the download
    // buttons on the left, so their two text colours became the button text of
    // one column each.
    const props = [];
    const propMap = [
      ['headingTextColor',           '--arr-heading-rgb'],
      ['headingColor',               '--arr-heading-line-rgb'],
      ['primaryTextColor',           '--arr-text-rgb'],
      // Before the tokens it coloured mostly the titles on posters
      ['primaryTextColor',           '--arr-poster-text-rgb'],
      ['secondaryTextColor',         '--arr-text-secondary-rgb'],
      ['pagingButtonTextColor',      '--arr-right-button-text-rgb'],
      ['downloadButtonTextColor',    '--arr-left-button-text-rgb'],
      ['tagPillTextColor',           '--arr-pill-text-rgb'],
      ['pagingButtonBackgroundColor','--arr-button-rgb'],
      ['pagingDotColor',             '--arr-dot-rgb'],
      ['pagingDotActiveColor',       '--arr-dot-active-rgb'],
    ];
    for (const [key, prop] of propMap) {
      const rgb = c(key);
      if (rgb) props.push(`${prop}: ${rgb};`);
    }
    // The modal keys from before the tokens. They applied by day and by night
    // alike, so each sets both palettes.
    const modalMap = [
      ['modalHeadingTextColor',   'text-rgb'],
      ['modalPrimaryTextColor',   'text-secondary-rgb'],
      ['modalSecondaryTextColor', 'text-muted-rgb'],
    ];
    const legacyModal = [];
    for (const [key, token] of modalMap) {
      const rgb = c(key);
      if (rgb) legacyModal.push(`--arr-modal-${token}: ${rgb};`, `--arr-modal-day-${token}: ${rgb};`);
    }
    const mb = c('modalBackgroundColor');
    if (mb) legacyModal.push(`--arr-modal-background: rgba(${mb}, 0.30);`, `--arr-modal-day-background: rgba(${mb}, 0.30);`);
    const mov = c('modalOverlayColor');
    if (mov) legacyModal.push(`--arr-modal-overlay: rgba(${mov}, 0.65);`, `--arr-modal-day-overlay: rgba(${mov}, 0.65);`);
    props.push(...legacyModal);

    // The design tokens by name, and the preset they start from. Written after
    // the old keys, so where both set one token the new key wins.
    const { decls, bad } = styleDeclarations(cfg);
    props.push(...decls);
    const badKey = bad.join(', ');
    if (badKey && badKey !== this._styleWarned) {
      this._styleWarned = badKey;
      console.warn(`[arr-card] styles: could not read ${badKey} — colours take a hex value, rgb() or "r, g, b"`);
    }
    if (props.length) rules.push(`:host { ${props.join(' ')} }`);

    const mci = c('modalCloseButtonIconColor');
    if (mci) rules.push(`.popup-close { color: rgba(${mci}, 1) !important; }`);

    const mcb = c('modalCloseButtonBackgroundColor');
    if (mcb) rules.push(`.popup-close { background: rgba(${mcb}, 1) !important; box-shadow: none !important; }`);

    const mbt = c('modalButtonTextColor');
    if (mbt) rules.push(`.popup-overlay .is-open-btn { color: rgba(${mbt}, 1) !important; }`);

    const mbb = c('modalButtonBackgroundColor');
    if (mbb) rules.push(`.popup-overlay .is-open-btn:not(.remove-lib-btn):not(.remove-disc-btn) { background: rgba(${mbb}, 0.20) !important; border-color: rgba(${mbb}, 0.40) !important; }`);

    const mrb = c('modalRemoveButtonBackgroundColor');
    if (mrb) rules.push(`.popup-overlay .is-open-btn[data-action="remove-confirm"] { background: rgba(${mrb}, 0.20) !important; border-color: rgba(${mrb}, 0.40) !important; }`);

    const uiScale = parseFloat(cfg['uiScale']);
    if (uiScale && uiScale !== 1 && !isNaN(uiScale)) {
      rules.push(`@media (min-width: 601px) { .card-body { zoom: ${uiScale}; } }`);
    }

    const leftPct = parseFloat(cfg['leftPanelWidth']);
    if (!isNaN(leftPct) && leftPct > 0 && leftPct !== 40) {
      const l = Math.round(leftPct);
      const r = 100 - l;
      rules.push(`@media (min-width: 601px) { .card-body { grid-template-columns: ${l}fr ${r}fr !important; } }`);
      rules.push(`@media (min-width: 601px) { .card-body.swap-sides { grid-template-columns: ${r}fr ${l}fr !important; } }`);
    }

    let el = this.shadowRoot.getElementById('arr-theme');
    if (!el) {
      el = document.createElement('style');
      el.id = 'arr-theme';
      this.shadowRoot.appendChild(el);
    }
    el.textContent = rules.join('\n');
  }
}

export const themeMixin = _ThemeMethods.prototype;
