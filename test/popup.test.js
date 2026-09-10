// Drives the real popup.html with a stubbed chrome API: the detected queue, the
// accept/dismiss actions, and the auto-detect permission flow.
'use strict';

const { read, render, runner } = require('./helpers');

const stub = `
<div id="RESULT">never ran</div>
<script>
  window.__err = [];
  window.addEventListener('error', (e) => window.__err.push(String(e.message)));
  window.addEventListener('unhandledrejection', (e) => window.__err.push('reject: ' + e.reason));
  window.__store = {
    applications: [],
    pending: [{ id: 'p1', company: 'Acme', role: 'Backend Engineer',
                url: 'https://linkedin.com/jobs/view/1', date: '2026-09-10',
                status: 'Applied', createdAt: 1, detectedBy: 'confirmation' }],
    settings: { autoDetect: false, autoSave: false },
  };
  window.__msgs = []; window.__requested = null; window.__revoked = false;
  window.chrome = {
    storage: { local: {
      get: (keys) => { const o = {}; for (const k of [].concat(keys)) o[k] = window.__store[k]; return Promise.resolve(o); },
      set: (o) => { Object.assign(window.__store, o); return Promise.resolve(); },
    }},
    tabs: { query: () => Promise.resolve([{ id: 1,
      title: 'Backend Engineer - Bengaluru - Verloop - 2 to 4 years of experience',
      url: 'https://www.naukri.com/job-listings-backend-engineer-verloop-bengaluru-2-to-4-years-160726502068' }]) },
    scripting: { executeScript: () => Promise.reject(new Error('not injectable in harness')) },
    runtime: { sendMessage: (m) => { window.__msgs.push(m.type); return Promise.resolve({ ok: true }); } },
    permissions: {
      getAll: () => Promise.resolve({ origins: [] }),
      request: (o) => { window.__requested = o.origins; return Promise.resolve(true); },
      remove: () => { window.__revoked = true; return Promise.resolve(true); },
    },
  };
</script>`;

const driver = `
<script>
(async () => {
  const out = {};
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s) => document.querySelector(s);
  const snap = (o) => JSON.parse(JSON.stringify(o));
  try {
    await wait(300);
    out.pendingVisible = !q('#pending-wrap').hidden;
    out.pendingCompany = q('#pending .who').textContent;
    out.pendingRole = q('#pending .what').textContent;
    out.pendingWhere = q('#pending .where').textContent;
    out.badgeAcknowledged = window.__msgs.includes('badge-seen');
    out.autoSaveLockedShut = q('#auto-save').disabled;
    out.currentPageLabel = q('#page-title').textContent;

    q('#pending button[data-action="accept"]').click();
    await wait(250);
    out.queueCleared = q('#pending-wrap').hidden;
    out.savedCount = window.__store.applications.length;
    out.detectedByStripped = !('detectedBy' in (window.__store.applications[0] || { detectedBy: 1 }));
    out.listCompany = q('#list input.company') ? q('#list input.company').value : null;
    out.headerCount = q('#count').textContent;

    q('#auto-detect').checked = true;
    q('#auto-detect').dispatchEvent(new Event('change', { bubbles: true }));
    await wait(250);
    out.originsRequested = (window.__requested || []).length;
    out.settingsAfterEnable = snap(window.__store.settings);
    out.autoSaveUnlocked = !q('#auto-save').disabled;
    out.registrationSynced = window.__msgs.includes('sync-registration');

    q('#auto-save').checked = true;
    q('#auto-save').dispatchEvent(new Event('change', { bubbles: true }));
    await wait(200);
    out.settingsAfterAutoSave = snap(window.__store.settings);

    q('#auto-detect').checked = false;
    q('#auto-detect').dispatchEvent(new Event('change', { bubbles: true }));
    await wait(250);
    out.settingsAfterDisable = snap(window.__store.settings);
    out.accessRevoked = window.__revoked;

    // deleting takes two clicks, and anything else cancels
    const del = () => q('#list button[data-action="delete"]');
    del().click();
    await wait(160);
    out.armedLabel = del().textContent;
    out.survivesFirstClick = window.__store.applications.length;

    document.querySelector('header h1').click();   // click elsewhere
    await wait(160);
    out.labelAfterClickAway = del().textContent;
    out.survivesClickAway = window.__store.applications.length;

    del().click();
    await wait(160);
    del().click();
    await wait(220);
    out.afterTwoClicks = window.__store.applications.length;
    out.listEmpty = !q('#list li');
  } catch (e) { out.threw = e.message; }
  out.errors = window.__err;
  document.getElementById('RESULT').textContent = JSON.stringify(out);
})();
</script>`;

const html = read('popup.html')
  .replace('<script src="shared.js"></script>', stub + '\n<script src="shared.js"></script>')
  .replace('</body>', driver + '\n</body>');

const r = render(html, 'popup_test');
const t = runner('popup.js — detected queue and settings');

t.check('no page-load errors', r.errors, []);
t.check('detected queue is shown', r.pendingVisible, true);
t.check('  company', r.pendingCompany, 'Acme');
t.check('  role', r.pendingRole, 'Backend Engineer');
t.check('  source and date', r.pendingWhere, 'linkedin.com · 2026-09-10');
t.check('opening the popup acknowledges the badge', r.badgeAcknowledged, true);
t.check('auto-save cannot be set before auto-detect', r.autoSaveLockedShut, true);
t.check('the popup applies host-specific title rules (Naukri orders Role - City - Company)',
  r.currentPageLabel, 'Verloop — Backend Engineer');

t.check('accepting empties the queue', r.queueCleared, true);
t.check('  and stores the application', r.savedCount, 1);
t.check('  dropping the internal detection marker', r.detectedByStripped, true);
t.check('  and shows it in the list', r.listCompany, 'Acme');
t.check('  and updates the count', r.headerCount, '1');

t.check('enabling auto-detect asks for every supported site', r.originsRequested, 7);
t.check('  persists only after the grant', r.settingsAfterEnable, { autoDetect: true, autoSave: false });
t.check('  unlocks auto-save', r.autoSaveUnlocked, true);
t.check('  and re-registers the detector', r.registrationSynced, true);
t.check('auto-save persists', r.settingsAfterAutoSave, { autoDetect: true, autoSave: true });

t.check('disabling clears both flags', r.settingsAfterDisable, { autoDetect: false, autoSave: false });
t.check('  and revokes the site access', r.accessRevoked, true);

t.check('one click on the delete button only arms it', r.armedLabel, 'Sure?');
t.check('  the application survives that first click', r.survivesFirstClick, 1);
t.check('clicking elsewhere cancels', r.labelAfterClickAway, '✕');
t.check('  and the application is still there', r.survivesClickAway, 1);
t.check('two clicks delete it', r.afterTwoClicks, 0);
t.check('  and the list empties', r.listEmpty, true);

t.done();
