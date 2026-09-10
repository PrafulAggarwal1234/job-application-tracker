// Generates Chrome Web Store screenshots (1280x800) from the real popup, so the
// listing can never drift from what the extension actually looks like.
//
//   node store/screenshots.js          # renders the current working tree
//   CHROME=/path/to/chrome node store/screenshots.js
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'store', 'screenshots');

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

// Plausible applications with every status represented.
const APPS = [
  { id: '1', company: 'Razorpay', role: 'Backend Engineer II', url: 'https://razorpay.com/jobs/1', date: '2026-09-08', status: 'Interviewing', createdAt: 8 },
  { id: '2', company: 'Zerodha', role: 'Site Reliability Engineer', url: 'https://zerodha.com/careers/2', date: '2026-09-05', status: 'Applied', createdAt: 7 },
  { id: '3', company: 'CRED', role: 'Frontend Engineer', url: 'https://cred.club/careers/3', date: '2026-09-02', status: 'Offer', createdAt: 6 },
  { id: '4', company: 'Flipkart', role: 'Software Engineer', url: 'https://flipkart.com/careers/4', date: '2026-08-21', status: 'Rejected', createdAt: 5 },
];

const SHOTS = [
  {
    name: '1-list',
    headline: 'Every application in one place',
    sub: 'Company, role, date and status — updated as things move.',
    driver: '',
  },
  {
    name: '2-one-click',
    headline: 'One click on any job page',
    sub: 'It reads the company and role off the page. Every field stays editable.',
    driver: `
      const n = document.getElementById('notice');
      n.hidden = false;
      n.textContent = 'Saved. Fix the company or role below if the guess was off.';
      const first = document.querySelector('#list input.company');
      if (first) first.focus();
    `,
  },
  {
    name: '3-private',
    headline: 'No account. No server. No tracking.',
    sub: 'Your applications are stored in your browser and never leave this device.',
    driver: `document.querySelector('footer').style.outline = '2px solid rgba(37,99,235,.45)';`,
  },
];

const stub = (apps) => `
<script>
  window.chrome = {
    storage: { local: {
      get: (keys) => { const s = { applications: ${JSON.stringify(apps)} };
        const o = {}; for (const k of [].concat(keys)) o[k] = s[k]; return Promise.resolve(o); },
      set: () => Promise.resolve(),
    }},
    tabs: { query: () => Promise.resolve([{ id: 1,
      title: 'Razorpay hiring Backend Engineer II in Bengaluru | LinkedIn',
      url: 'https://www.linkedin.com/jobs/view/4012345678/' }]) },
    scripting: { executeScript: () => Promise.reject(new Error('screenshot mode')) },
    runtime: { sendMessage: () => Promise.resolve({ ok: true }) },
    permissions: { getAll: () => Promise.resolve({ origins: [] }), request: () => Promise.resolve(false), remove: () => Promise.resolve(true) },
  };
</script>`;

const frame = (shot) => `
<style>
  html {
    min-height: 100vh; margin: 0;
    background: radial-gradient(120% 120% at 15% 0%, #eaf1ff 0%, #f7f8fb 45%, #eef1f6 100%);
    display: flex; align-items: flex-start; justify-content: center;
    padding-top: 152px;
    font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  body {
    width: 380px !important;
    border-radius: 14px;
    box-shadow: 0 24px 60px -12px rgba(15,26,50,.34), 0 0 0 1px rgba(15,26,50,.08);
    overflow: hidden;
  }
  .list { max-height: none !important; }
  .shot-copy {
    position: fixed; top: 46px; left: 0; right: 0;
    text-align: center; color: #101a2e;
  }
  .shot-copy h2 { margin: 0 0 9px; font-size: 31px; letter-spacing: -.5px; }
  .shot-copy p { margin: 0; font-size: 15.5px; color: #55617a; }
</style>
<div class="shot-copy"><h2>${shot.headline}</h2><p>${shot.sub}</p></div>
<script>setTimeout(() => { ${shot.driver} }, 200);</script>`;

fs.mkdirSync(OUT, { recursive: true });
const popup = fs.readFileSync(path.join(ROOT, 'popup.html'), 'utf8');
const anchor = popup.includes('<script src="shared.js"></script>')
  ? '<script src="shared.js"></script>'
  : '<script src="popup.js"></script>';

for (const shot of SHOTS) {
  const html = popup.replace(anchor, stub(APPS) + anchor).replace('</body>', frame(shot) + '</body>');
  const tmp = path.join(ROOT, `_shot_${shot.name}.html`);
  const out = path.join(OUT, `${shot.name}.png`);
  fs.writeFileSync(tmp, html);
  try {
    execFileSync(chromePath(), [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      '--force-device-scale-factor=1', '--window-size=1280,800',
      '--virtual-time-budget=3000', `--screenshot=${out}`, `file://${tmp}`,
    ], { stdio: ['ignore', 'ignore', 'ignore'] });
    console.log(`${path.relative(ROOT, out)}  ${fs.statSync(out).size} bytes`);
  } finally {
    fs.unlinkSync(tmp);
  }
}
