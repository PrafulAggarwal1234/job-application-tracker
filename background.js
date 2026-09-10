// Receives detections from detector.js, decides whether to queue or save them,
// and keeps the toolbar badge in sync. Also owns content-script registration,
// which follows whatever host permissions the user has actually granted.
'use strict';

importScripts('shared.js');

const KEY = 'applications';
const PENDING = 'pending';
const SETTINGS = 'settings';
const UNSEEN = 'unseenSaved';

const DEFAULTS = { autoDetect: false, autoSave: false };

async function readState() {
  const s = await chrome.storage.local.get([KEY, PENDING, SETTINGS, UNSEEN]);
  return {
    apps: Array.isArray(s[KEY]) ? s[KEY] : [],
    pending: Array.isArray(s[PENDING]) ? s[PENDING] : [],
    settings: Object.assign({}, DEFAULTS, s[SETTINGS] || {}),
    unseen: Number(s[UNSEEN]) || 0,
  };
}

/* ---------- badge ---------- */

async function refreshBadge() {
  const { pending, unseen } = await readState();
  const total = pending.length + unseen;

  await chrome.action.setBadgeText({ text: total ? String(total) : '' });
  if (!total) return;
  // Orange asks for a decision; green is just telling you something happened.
  await chrome.action.setBadgeBackgroundColor({
    color: pending.length ? '#b45309' : '#15803d',
  });
}

/* ---------- detection ---------- */

async function handleDetection(message, sender) {
  const { apps, pending, settings, unseen } = await readState();
  if (!settings.autoDetect) return { ok: false, reason: 'disabled' };

  const payload = message.payload || {};
  const url = payload.url || (sender.tab && sender.tab.url) || '';
  if (!url) return { ok: false, reason: 'no-url' };

  const norm = normalizeUrl(url);
  if (apps.some((a) => normalizeUrl(a.url) === norm)) return { ok: true, reason: 'already-saved' };
  if (pending.some((p) => normalizeUrl(p.url) === norm)) return { ok: true, reason: 'already-pending' };

  const fields = resolveFields(payload);
  const entry = {
    id: crypto.randomUUID(),
    company: fields.company,
    role: fields.role,
    url,
    date: todayISO(),
    status: 'Applied',
    createdAt: Date.now(),
    detectedBy: message.reason || 'auto',
  };

  if (settings.autoSave) {
    await chrome.storage.local.set({
      [KEY]: [entry].concat(apps),
      [UNSEEN]: unseen + 1,
    });
  } else {
    await chrome.storage.local.set({ [PENDING]: [entry].concat(pending) });
  }

  await refreshBadge();
  return { ok: true, reason: settings.autoSave ? 'saved' : 'pending' };
}

/* ---------- content script registration ---------- */

// Granted origins should come back as the exact patterns we asked for, but match
// on the host too so a differently-shaped grant still enables the site.
function grantedPatterns(origins) {
  const out = [];
  for (const site of SUPPORTED_SITES) {
    const host = site.patterns[0].replace(/^\*:\/\/\*?\.?/, '').replace(/\/\*$/, '');
    const granted = site.patterns.some((p) => origins.includes(p))
      || origins.some((o) => o.includes(host));
    if (granted) out.push.apply(out, site.patterns);
  }
  return out;
}

async function syncRegistration() {
  const { settings } = await readState();

  const existing = await chrome.scripting
    .getRegisteredContentScripts({ ids: [DETECT_SCRIPT_ID] })
    .catch(() => []);
  if (existing.length) {
    await chrome.scripting.unregisterContentScripts({ ids: [DETECT_SCRIPT_ID] }).catch(() => {});
  }

  if (!settings.autoDetect) return { registered: [] };

  const granted = await chrome.permissions.getAll();
  const patterns = grantedPatterns(granted.origins || []);
  if (!patterns.length) return { registered: [] };

  await chrome.scripting.registerContentScripts([{
    id: DETECT_SCRIPT_ID,
    matches: patterns,
    js: ['scrape.js', 'detector.js'],
    runAt: 'document_idle',
    persistAcrossSessions: true,
  }]).catch(() => {});

  return { registered: patterns };
}

/* ---------- wiring ---------- */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = message && message.type;

  if (type === 'application-detected') {
    handleDetection(message, sender).then(sendResponse, () => sendResponse({ ok: false }));
    return true;
  }
  if (type === 'sync-registration') {
    syncRegistration().then(sendResponse, () => sendResponse({ registered: [] }));
    return true;
  }
  if (type === 'badge-seen') {
    chrome.storage.local.set({ [UNSEEN]: 0 }).then(refreshBadge).then(
      () => sendResponse({ ok: true }),
      () => sendResponse({ ok: false }),
    );
    return true;
  }
  return false;
});

chrome.runtime.onInstalled.addListener(() => { syncRegistration(); refreshBadge(); });
chrome.runtime.onStartup.addListener(() => { syncRegistration(); refreshBadge(); });
chrome.permissions.onAdded.addListener(() => syncRegistration());
chrome.permissions.onRemoved.addListener(() => syncRegistration());
