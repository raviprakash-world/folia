/*
 * Paste this whole file into the browser console (or run it via the Claude
 * browser tool's javascript_tool) on ANY page of a running Folia dev server.
 * It prints two things for the current viewport + theme:
 *
 *   1. contrast   - text below WCAG AA (4.5:1, or 3:1 for large text),
 *                   measured on the rendered page, not from the CSS.
 *   2. layout     - horizontal page overflow, and any element sticking out
 *                   past the right edge of the viewport.
 *
 * See docs/UI_VERIFICATION.md for when and how to run it.
 * Limits: text over images/gradients is skipped (can't be measured here),
 * and colours mid-transition read wrong - wait ~2s after a theme change.
 */
(function foliaUiAudit() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const parse = (c) => {
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = '#000';
    cx.fillStyle = c; // resolves rgb(), oklab(), color-mix() etc.
    cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const over = (t, b) => {
    const a = t[3] + b[3] * (1 - t[3]);
    if (a === 0) return [0, 0, 0, 0];
    return [0, 1, 2].map((i) => (t[i] * t[3] + b[i] * b[3] * (1 - t[3])) / a).concat([a]);
  };
  const bgOf = (el) => {
    const layers = [];
    let e = el;
    let unknown = false;
    while (e) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') unknown = true;
      const c = parse(cs.backgroundColor);
      if (c[3] > 0) {
        layers.push(c);
        if (c[3] >= 1) break;
      }
      e = e.parentElement;
    }
    let acc = [0, 0, 0, 0];
    for (let i = layers.length - 1; i >= 0; i--) acc = over(layers[i], acc);
    if (acc[3] < 1) acc = over(acc, parse(getComputedStyle(document.body).backgroundColor).slice(0, 3).concat([1]));
    return { c: acc, unknown };
  };
  const lum = (c) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };

  const contrast = {};
  for (const el of document.querySelectorAll('body *')) {
    const tn = el.tagName.toUpperCase();
    if (['SCRIPT', 'STYLE', 'SVG', 'PATH', 'IMG', 'OPTION'].includes(tn)) continue;
    const txt = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
    if (!txt) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    let op = 1;
    for (let e = el; e; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity);
    if (el.parentElement && el.parentElement.querySelector(':scope > img[class*="absolute"]')) continue; // text laid over a photo can't be measured here
    if (op === 0 || el.closest(':disabled, [aria-disabled="true"]')) continue; // disabled controls are exempt
    const { c: bg, unknown } = bgOf(el);
    if (unknown) continue;
    let fg = parse(cs.color);
    fg = over([fg[0], fg[1], fg[2], fg[3] * op], [bg[0], bg[1], bg[2], 1]);
    const L1 = lum(fg);
    const L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
    if (ratio < need) {
      const key = tn.toLowerCase() + '.' + String(el.className).split(/\s+/).slice(0, 5).join('.');
      (contrast[key] ??= []).push({ text: txt.slice(0, 30), ratio: +ratio.toFixed(2) });
    }
  }

  const W = innerWidth;
  const sticksOut = [...document.querySelectorAll('body *')]
    .filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.right > W + 1 && !e.closest('.swiper, [class*="overflow-x"], [class*="overflow-hidden"]');
    })
    .slice(0, 8)
    .map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 50)} right=${Math.round(e.getBoundingClientRect().right)}`);

  const report = {
    viewport: W,
    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    contrastFailures: Object.entries(contrast).map(([k, v]) => `${v.length}x ${k} "${v[0].text}" ${v[0].ratio}:1`),
    pageOverflowsHorizontally: document.documentElement.scrollWidth > W + 1,
    elementsPastRightEdge: sticksOut,
  };
  console.log(report);
  return report;
})();
