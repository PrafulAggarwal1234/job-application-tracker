// Renders a synthetic job page in headless Chrome, loads the real scrape.js and
// detector.js into it, and asserts on when the detector does and does not fire.
//
// The false-positive cases matter as much as the positive one: LinkedIn prints
// "Application sent" against every row of the applied-jobs list, and firing
// there would fill the tracker with jobs the user only looked at.
'use strict';

const { render, runner } = require('./helpers');

const page = `<!doctype html><html><head><meta charset="utf-8">
<title>Acme hiring Backend Engineer in Bengaluru | LinkedIn</title>
<script type="application/ld+json">
{"@type":"JobPosting","title":"Backend Engineer","hiringOrganization":{"name":"Acme Corp"}}
</script></head>
<body>
<h1>Backend Engineer</h1><div id="page"></div>
<div id="RESULT">never ran</div>
<script>
  window.__sent = []; window.__err = [];
  window.addEventListener('error', (e) => window.__err.push(String(e.message)));
  window.chrome = { runtime: { sendMessage: (m) => { window.__sent.push(m); return Promise.resolve({ ok: true }); } } };
</script>
<script src="scrape.js"></script>
<script src="detector.js"></script>
<script>
(async () => {
  const out = {};
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fired = () => window.__sent.length > 0;
  try {
    await wait(250);
    out.plainJobPage = fired();

    const rows = document.createElement('div');
    rows.textContent = 'Application sent \\u00b7 Application sent \\u00b7 Application sent';
    document.getElementById('page').append(rows);
    await wait(800);
    out.appliedJobsList = fired();

    const modal = document.createElement('div');
    modal.setAttribute('role', 'dialog');
    modal.textContent = 'Your application was sent to Acme Corp';
    document.body.append(modal);
    await wait(800);
    out.confirmationModal = fired();
    out.payload = window.__sent[0] ? window.__sent[0].payload : null;
    out.reason = window.__sent[0] ? window.__sent[0].reason : null;

    const again = document.createElement('div');
    again.textContent = 'Your application was sent to Acme Corp';
    document.body.append(again);
    await wait(800);
    out.messageCount = window.__sent.length;
  } catch (e) { out.threw = e.message; }
  out.errors = window.__err;
  document.getElementById('RESULT').textContent = JSON.stringify(out);
})();
</script></body></html>`;

const r = render(page, 'detector_test');
const t = runner('detector.js — when it fires');

t.check('no page-load errors', r.errors, []);
t.check('stays quiet on a plain job posting', r.plainJobPage, false);
t.check('stays quiet on the applied-jobs list', r.appliedJobsList, false);
t.check('fires on a submission confirmation', r.confirmationModal, true);
t.check('reports why it fired', r.reason, 'confirmation');
t.check('reads the company from JSON-LD', r.payload && r.payload.company, 'Acme Corp');
t.check('reads the role from JSON-LD', r.payload && r.payload.role, 'Backend Engineer');
t.check('reports a posting only once', r.messageCount, 1);

t.done();
