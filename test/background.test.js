// The service worker decides what happens to a detection: ignore it, queue it,
// or file it. Runs the real background.js in Node against a stubbed chrome.
'use strict';

const { read, runner } = require('./helpers');

const shared = read('shared.js');
const bg = read('background.js').replace("importScripts('shared.js');", '');

let store = {};
let badge = {};
let registered = [];
let onMessage = null;
let grantedOrigins = [];

const chrome = {
  storage: { local: {
    get: (keys) => { const out = {}; for (const k of [].concat(keys)) out[k] = store[k]; return Promise.resolve(out); },
    set: (o) => { Object.assign(store, o); return Promise.resolve(); },
  }},
  action: {
    setBadgeText: (o) => { badge.text = o.text; return Promise.resolve(); },
    setBadgeBackgroundColor: (o) => { badge.color = o.color; return Promise.resolve(); },
  },
  runtime: {
    onMessage: { addListener: (fn) => { onMessage = fn; } },
    onInstalled: { addListener: () => {} },
    onStartup: { addListener: () => {} },
  },
  permissions: {
    getAll: () => Promise.resolve({ origins: grantedOrigins }),
    onAdded: { addListener: () => {} },
    onRemoved: { addListener: () => {} },
  },
  scripting: {
    getRegisteredContentScripts: () => Promise.resolve(registered),
    unregisterContentScripts: () => { registered = []; return Promise.resolve(); },
    registerContentScripts: (arr) => { registered = arr; return Promise.resolve(); },
  },
};

new Function('chrome', shared + '\n' + bg)(chrome);

const send = (msg) => new Promise((res) => { if (!onMessage(msg, { tab: { url: msg.payload && msg.payload.url } }, res)) res(null); });
const detect = (url, extra) => send({ type: 'application-detected', reason: 'confirmation',
  payload: Object.assign({ url, title: 'Acme hiring Backend Engineer in Bengaluru | LinkedIn' }, extra) });

const t = runner('background.js — detection handling');
const check = t.check;

(async () => {
  // 1. off by default
  store = {};
  check('detection ignored while auto-detect is off', (await detect('https://linkedin.com/jobs/view/1')).reason, 'disabled');

  // 2. prompt mode -> pending + orange badge
  store = { settings: { autoDetect: true, autoSave: false } };
  check('prompt mode queues as pending', (await detect('https://linkedin.com/jobs/view/1')).reason, 'pending');
  check('  pending count', store.pending.length, 1);
  check('  applications untouched', (store.applications || []).length, 0);
  check('  fields parsed from title', [store.pending[0].company, store.pending[0].role], ['Acme', 'Backend Engineer']);
  check('  badge shows 1, orange', [badge.text, badge.color], ['1', '#b45309']);

  // 3. dedupe across tracking params
  check('same posting via tracking params is deduped',
    (await detect('https://linkedin.com/jobs/view/1?refId=abc&trk=xyz')).reason, 'already-pending');
  check('  still one pending', store.pending.length, 1);

  // 4. auto-save mode
  store = { settings: { autoDetect: true, autoSave: true } };
  check('auto-save writes straight to the list', (await detect('https://linkedin.com/jobs/view/2')).reason, 'saved');
  check('  application stored', store.applications.length, 1);
  check('  nothing left pending', (store.pending || []).length, 0);
  check('  badge shows 1, green', [badge.text, badge.color], ['1', '#15803d']);

  // 5. never double-save
  check('already-saved posting is skipped', (await detect('https://linkedin.com/jobs/view/2')).reason, 'already-saved');
  check('  still one application', store.applications.length, 1);

  // 6. popup acknowledging the badge
  await send({ type: 'badge-seen' });
  check('opening the popup clears the green badge', badge.text, '');

  // 7. registration follows granted permissions
  store = { settings: { autoDetect: true, autoSave: false } };
  grantedOrigins = ['*://*.linkedin.com/*', '*://*.naukri.com/*'];
  let r = await send({ type: 'sync-registration' });
  check('registers only granted sites', r.registered, ['*://*.linkedin.com/*', '*://*.naukri.com/*']);
  check('  injects scraper before detector', registered[0].js, ['scrape.js', 'detector.js']);

  store.settings.autoDetect = false;
  r = await send({ type: 'sync-registration' });
  check('unregisters when auto-detect is switched off', [r.registered, registered], [[], []]);

  t.done();
})();
