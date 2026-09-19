/*
 * Drives a real Chrome over the DevTools protocol and, for every route at
 * every viewport width, measures the things that break phone layouts:
 *   - horizontal page overflow (and which element causes it)
 *   - visible buttons/links/inputs smaller than 40px in either direction
 *   - text under 12px
 *   - images with no width/height (layout-shift risk), and images that are
 *     decoded much larger than they are shown (wasted bytes on mobile)
 * and optionally saves a screenshot of each page.
 *
 *   node scripts/viewport-audit.mjs                       # all routes, all widths
 *   node scripts/viewport-audit.mjs --widths 360,390 --routes / /shop --shots out/ [--full] [--dark]
 *
 * Needs the dev server running (default http://localhost:5173) and Chrome
 * (CHROME_PATH to override the macOS default). See docs/UI_VERIFICATION.md.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const out = [];
  for (let j = i + 1; j < process.argv.length && !process.argv[j].startsWith('--'); j++) out.push(process.argv[j]);
  return out.join(',');
};
const BASE = process.env.BASE_URL || 'http://localhost:5173';
const WIDTHS = arg('widths', '320,360,375,390,393,412,480,768,1024,1280,1440').split(',').map(Number);
const ROUTES = arg('routes', '/,/shop,/collections,/collections/pet-friendly,/product/monstera-deliciosa,/search,/cart,/wishlist,/offers,/services,/services/gardening,/corporate-gifting,/blog,/account/login,/sellers,/sellers/greenleaf-nursery').split(',');
const SHOTS = arg('shots', '');
const DARK = process.argv.includes('--dark');
const FULL = process.argv.includes('--full');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9400 + Math.floor(Math.random() * 100);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(tmpdir() + '/audit-')}`, '--hide-scrollbars', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
let tabs;
for (let i = 0; i < 40; i++) {
  try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); break; } catch { await sleep(250); }
}
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m.error); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const MEASURE = `(() => {
  const vw = Math.min(innerWidth, document.documentElement.clientWidth);
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const inert = (el) => !!el.closest('[inert], [aria-hidden="true"]');
  const name = (el) => (el.getAttribute('aria-label') || el.textContent || el.getAttribute('href') || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 30);
  const overflowEls = [...document.querySelectorAll('body *')].filter((el) => { if (!vis(el) || el.closest('.announce, .swiper, [data-allow-overflow]')) return false; const r = el.getBoundingClientRect(); return r.right > vw + 1 && !el.closest('[style*="overflow"], .overflow-x-auto'); }).slice(0, 4).map((el) => el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0] + ' ' + Math.round(el.getBoundingClientRect().right));
  const small = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button]')].filter((el) => vis(el) && !inert(el) && !el.closest('.skip-link, .announce-group[inert]')).filter((el) => { const r = el.getBoundingClientRect(); const inline = el.tagName === 'A' && getComputedStyle(el).display === 'inline' && !el.className.toString().match(/p[xy]?-/); return !inline && (r.width < 40 || r.height < 40); }).map((el) => name(el) + ' ' + Math.round(el.getBoundingClientRect().width) + 'x' + Math.round(el.getBoundingClientRect().height));
  const tiny = [...document.querySelectorAll('body *')].filter((el) => vis(el) && !inert(el) && el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(el).fontSize) < 12).length;
  const imgs = [...document.querySelectorAll('img')].filter(vis);
  const noSize = imgs.filter((i) => !(i.getAttribute('width') && i.getAttribute('height')) && !/aspect|h-|absolute|inset/.test(i.className + i.parentElement.className)).length;
  const oversize = imgs.filter((i) => i.naturalWidth > 0 && i.naturalWidth > i.getBoundingClientRect().width * devicePixelRatio * 2).map((i) => (i.currentSrc || i.src).split('/').pop() + ' ' + i.naturalWidth + 'px for ' + Math.round(i.getBoundingClientRect().width)).slice(0, 3);
  return { innerW: innerWidth, clientW: document.documentElement.clientWidth, docScrollW: document.documentElement.scrollWidth, bodyScrollW: document.body.scrollWidth, overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > vw + 1, overflowEls, small: small.length, smallEx: small.slice(0, 4), tinyText: tiny, imgs: imgs.length, imgNoSize: noSize, oversize };
})()`;

const rows = [];
for (const route of ROUTES) {
  for (const w of WIDTHS) {
    const mobile = w < 768;
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: mobile ? 800 : 900, deviceScaleFactor: mobile ? 2 : 1, mobile });
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: DARK ? 'dark' : 'light' }] });
    await send('Page.navigate', { url: BASE + route });
    for (let i = 0; i < 40; i++) { await sleep(400); if (await ev(`!!document.querySelector('h1, h2')`)) break; }
    await ev(`document.querySelectorAll('img').forEach(i => i.loading = 'eager'); 1`);
    await sleep(900);
    const m = await ev(MEASURE);
    rows.push({ route, w, ...m });
    if (SHOTS && (arg('shotwidths', '360,390,412,1440').split(',').map(Number).includes(w))) {
      let shotParams = { format: 'png' };
      if (FULL) {
        const lm = await send('Page.getLayoutMetrics');
        const h = Math.ceil(lm.cssContentSize?.height ?? lm.contentSize.height);
        shotParams = { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: Math.min(h, 12000), scale: 1 } };
      }
      const r = await send('Page.captureScreenshot', shotParams);
      writeFileSync(`${SHOTS}/${route.replace(/\W+/g, '_') || 'home'}-${w}${DARK ? '-dark' : ''}.png`, Buffer.from(r.data, 'base64'));
    }
    const flag = (m.overflowX ? ` OVERFLOW(${m.docScrollW}/${m.bodyScrollW} > ${m.clientW})` : '') + (!m.overflowX && m.overflowEls.length ? ' CLIPPED' : '') + (m.small ? ` small:${m.small}` : '') + (m.tinyText ? ` tiny:${m.tinyText}` : '') + (m.imgNoSize ? ` unsized:${m.imgNoSize}/${m.imgs}` : '');
    console.log(`${route.padEnd(34)} ${String(w).padStart(4)}${flag}${m.overflowEls.length ? '  ' + m.overflowEls.join(' ; ') : ''}`);
  }
}
if (arg('json', '')) writeFileSync(arg('json', ''), JSON.stringify(rows, null, 1));
ws.close(); proc.kill(); process.exit(0);
