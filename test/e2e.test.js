// End-to-end: runs the real scrape.js and detector.js on a page Chrome genuinely
// believes is www.linkedin.com, by mapping that host to a local server. So
// location.hostname, pathname and search are all real — which is exactly what
// the gating logic reads, and where both of its bugs lived.
//
// The page posts its own result back rather than being screenshotted, because
// --virtual-time-budget deadlocks against real network requests.
'use strict';

const http = require('http');
const os = require('os');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { ROOT, runner } = require('./helpers');

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

const fixture = (body, driver) => [
  '<!doctype html><html><head><meta charset="utf-8">',
  '<title>Acme hiring Backend Engineer in Bengaluru | LinkedIn</title></head><body>',
  body,
  '<script>',
  '  window.__sent = []; window.__err = [];',
  '  window.addEventListener("error", (e) => window.__err.push(String(e.message)));',
  '  window.chrome = { runtime: { sendMessage: (m) => {',
  '    window.__sent.push(m); return Promise.resolve({ ok: true }); } } };',
  '</script>',
  '<script src="/scrape.js"></script>',
  '<script src="/detector.js"></script>',
  '<script>',
  '(async () => {',
  '  const out = {};',
  '  const wait = (ms) => new Promise((r) => setTimeout(r, ms));',
  '  try {', driver, '  } catch (e) { out.threw = e.message; }',
  '  out.url = location.href;',
  '  out.errors = window.__err;',
  '  out.payload = window.__sent[0] ? window.__sent[0].payload : null;',
  '  await fetch("/__result", { method: "POST", body: JSON.stringify(out) });',
  '})();',
  '</script></body></html>',
].join('\n');

const CASES = [
  {
    name: 'easy apply from the search pane',
    url: 'http://www.linkedin.com/jobs/search/?currentJobId=4012345678&keywords=backend',
    body: '<h1>Backend Engineer</h1>'
      + '<div class="job-details-jobs-unified-top-card__company-name"><a>Acme Corp</a></div>',
    driver: [
      '    await wait(300);',
      '    out.beforeSubmit = window.__sent.length;',
      '    const modal = document.createElement("div");',
      '    modal.setAttribute("role", "dialog");',
      '    modal.textContent = "Your application was sent to Acme Corp";',
      '    document.body.append(modal);',
      '    await wait(900);',
      '    out.afterConfirmation = window.__sent.length;',
    ].join('\n'),
  },
  {
    name: 'browsing the applied-jobs list',
    url: 'http://www.linkedin.com/my-items/saved-jobs/?cardType=APPLIED',
    body: '<h1>My Jobs</h1>',
    driver: [
      '    await wait(300);',
      '    const list = document.createElement("div");',
      '    list.innerHTML = "<div>Application sent</div><div>Application sent</div>";',
      '    document.body.append(list);',
      '    await wait(900);',
      '    out.afterBrowsingList = window.__sent.length;',
    ].join('\n'),
  },
];

async function run(testCase) {
  const html = fixture(testCase.body, testCase.driver);
  let resolve;
  const reported = new Promise((r) => { resolve = r; });

  const server = http.createServer((req, res) => {
    const file = req.url.split('?')[0];

    if (req.method === 'POST' && file === '/__result') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        res.writeHead(204).end();
        resolve(JSON.parse(body));
      });
      return;
    }
    if (file === '/scrape.js' || file === '/detector.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(fs.readFileSync(path.join(ROOT, file.slice(1))));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  });

  // listen() binds asynchronously, so the port is unknown until it fires
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'jat-e2e-'));
  const chrome = spawn(chromePath(), [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
    `--user-data-dir=${profile}`,
    `--host-resolver-rules=MAP www.linkedin.com 127.0.0.1:${port}`,
    testCase.url,
  ], { stdio: 'ignore' });

  try {
    return await Promise.race([
      reported,
      new Promise((_, reject) => setTimeout(
        () => reject(new Error(`timed out waiting for: ${testCase.name}`)), 25000)),
    ]);
  } finally {
    chrome.kill('SIGKILL');
    server.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

(async () => {
  const t = runner('end-to-end on a real linkedin.com origin');

  const apply = await run(CASES[0]);
  t.check('no page errors', apply.errors, []);
  t.check('Chrome served it as linkedin.com',
    apply.url.startsWith('http://www.linkedin.com/jobs/search/'), true);
  t.check('quiet before submitting', apply.beforeSubmit, 0);
  t.check('FIRES on the confirmation, applying from the search pane', apply.afterConfirmation, 1);
  t.check('  reads the company off the page', apply.payload && apply.payload.company, 'Acme Corp');
  t.check('  reads the role', apply.payload && apply.payload.role, 'Backend Engineer');

  const browse = await run(CASES[1]);
  t.check('no page errors', browse.errors, []);
  t.check('stays quiet while browsing the applied-jobs list', browse.afterBrowsingList, 0);

  t.done();
})();
