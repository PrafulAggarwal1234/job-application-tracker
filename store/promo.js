// Renders the Chrome Web Store promo tiles.
// Both must be JPEG or 24-bit PNG with no alpha, so the page paints an opaque
// background and Chrome writes colour-type 2.
//
//   node store/promo.js
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'store', 'promo');

function chromePath() {
  const found = [
    process.env.CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean).find((p) => fs.existsSync(p));
  if (!found) throw new Error('Chrome not found. Set CHROME=/path/to/chrome');
  return found;
}

const TILES = [
  { name: 'small-promo-440x280', w: 440, h: 280, icon: 76, title: 25, tag: 13.5, pad: 30, align: 'center' },
  { name: 'marquee-1400x560', w: 1400, h: 560, icon: 150, title: 62, tag: 27, pad: 96, align: 'center' },
];

const page = (t) => `<!doctype html><meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 0; width: ${t.w}px; height: ${t.h}px; overflow: hidden; }
  body {
    background: linear-gradient(135deg, #1e4fd0 0%, #2f6bf0 48%, #1b3ea8 100%);
    color: #fff;
    display: flex; flex-direction: column;
    align-items: ${t.align === 'center' ? 'center' : 'flex-start'};
    justify-content: center;
    text-align: ${t.align};
    padding: 0 ${t.pad}px;
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    position: relative;
  }
  /* soft highlight so the flat gradient does not look dead */
  body::after {
    content: ''; position: absolute; inset: 0;
    background: radial-gradient(60% 90% at ${t.align === 'center' ? '50% -10%' : '88% 12%'},
                rgba(255,255,255,.20), rgba(255,255,255,0) 60%);
  }
  .inner { position: relative; z-index: 1; }
  img { width: ${t.icon}px; height: ${t.icon}px; display: block;
        margin: ${t.align === 'center' ? '0 auto' : '0'} 0 ${t.icon * 0.22}px;
        filter: drop-shadow(0 8px 20px rgba(6,18,54,.42)); }
  h1 { margin: 0 0 ${t.title * 0.34}px; font-size: ${t.title}px; letter-spacing: -.6px; line-height: 1.1; }
  p { margin: 0; font-size: ${t.tag}px; line-height: 1.45; color: rgba(255,255,255,.86);
      white-space: nowrap; }
</style>
<div class="inner">
  <img src="icons/icon128.png">
  <h1>Job Application Tracker</h1>
  <p>Save any job posting with one click.<br>Nothing ever leaves your browser.</p>
</div>`;

fs.mkdirSync(OUT, { recursive: true });

for (const t of TILES) {
  const tmp = path.join(ROOT, `_promo_${t.name}.html`);
  const out = path.join(OUT, `${t.name}.png`);
  fs.writeFileSync(tmp, page(t));
  try {
    execFileSync(chromePath(), [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      '--force-device-scale-factor=1', `--window-size=${t.w},${t.h}`,
      '--virtual-time-budget=3000', `--screenshot=${out}`, `file://${tmp}`,
    ], { stdio: ['ignore', 'ignore', 'ignore'] });
  } finally {
    fs.unlinkSync(tmp);
  }
}

// Verify the store's hard requirement rather than trusting it.
const { execSync } = require('child_process');
for (const t of TILES) {
  const f = path.join(OUT, `${t.name}.png`);
  const d = fs.readFileSync(f).subarray(0, 26);
  const w = d.readUInt32BE(16), h = d.readUInt32BE(20), ctype = d[25];
  const ok = w === t.w && h === t.h && ctype === 2;
  console.log(`${ok ? 'OK  ' : 'BAD '} ${t.name}.png  ${w}x${h}  colour_type=${ctype}${ctype === 2 ? ' (24-bit, no alpha)' : ' (HAS ALPHA)'}`);
}
