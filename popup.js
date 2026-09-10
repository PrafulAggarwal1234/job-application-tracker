'use strict';

const KEY = 'applications';
const PENDING = 'pending';
const SETTINGS = 'settings';
const STATUSES = ['Applied', 'Interviewing', 'Rejected', 'Offer'];
const DEFAULT_SETTINGS = { autoDetect: false, autoSave: false };

const $ = (id) => document.getElementById(id);
const els = {
  list: $('list'), count: $('count'), empty: $('empty'),
  save: $('save'), pageTitle: $('page-title'), notice: $('notice'), export: $('export'),
  pending: $('pending'), pendingWrap: $('pending-wrap'),
  autoDetect: $('auto-detect'), autoSave: $('auto-save'), autoDetectHelp: $('auto-detect-help'),
};

let apps = [];
let pending = [];
let settings = Object.assign({}, DEFAULT_SETTINGS);
let current = null; // { company, role, url, title } for the active tab
let armedDeleteId = null; // row whose ✕ has been clicked once and awaits confirmation

/* ---------- storage ---------- */

async function persist() {
  await chrome.storage.local.set({ [KEY]: apps });
}

/* ---------- page reading ---------- */


// Last-resort guesses from a page title, e.g.
//   "Acme hiring Backend Engineer in Bengaluru | LinkedIn"
//   "Backend Engineer at Acme"
//   "Backend Engineer - Acme Careers"



/* ---------- rendering ---------- */


function render() {
  armedDeleteId = null;
  els.list.textContent = '';
  els.count.textContent = String(apps.length);
  els.empty.hidden = apps.length > 0;

  for (const app of apps) {
    const li = document.createElement('li');
    li.dataset.id = app.id;
    li.dataset.status = app.status;

    li.append(
      field('company', app.company, 'Company'),
      field('role', app.role, 'Role'),
    );

    const row = document.createElement('div');
    row.className = 'row';

    const date = document.createElement('input');
    date.type = 'date';
    date.className = 'date';
    date.value = app.date;
    date.title = 'Date applied';

    const status = document.createElement('select');
    status.className = 'status';
    status.title = 'Status';
    for (const s of STATUSES) {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      opt.selected = s === app.status;
      status.append(opt);
    }

    const spacer = document.createElement('span');
    spacer.className = 'spacer';

    row.append(date, status, spacer);

    if (app.url) {
      const link = document.createElement('a');
      link.className = 'icon';
      link.href = app.url;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = '↗';
      link.title = 'Open posting';
      row.append(link);
    }

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'icon del';
    del.dataset.action = 'delete';
    del.textContent = '✕';
    del.title = 'Delete';
    row.append(del);

    li.append(row);
    els.list.append(li);
  }
}

function field(cls, value, placeholder) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = cls;
  input.value = value || '';
  input.placeholder = placeholder;
  return input;
}

function renderPending() {
  els.pending.textContent = '';
  els.pendingWrap.hidden = pending.length === 0;

  for (const item of pending) {
    const li = document.createElement('li');
    li.dataset.id = item.id;

    const who = document.createElement('div');
    who.className = 'who';
    who.textContent = item.company || 'Unknown company';

    const what = document.createElement('div');
    what.className = 'what';
    what.textContent = item.role || 'Unknown role';

    const where = document.createElement('div');
    where.className = 'where';
    try {
      where.textContent = `${new URL(item.url).hostname.replace(/^www\./, '')} · ${item.date}`;
    } catch (e) {
      where.textContent = item.date;
    }

    const actions = document.createElement('div');
    actions.className = 'actions';

    const accept = document.createElement('button');
    accept.type = 'button';
    accept.className = 'accept';
    accept.dataset.action = 'accept';
    accept.textContent = 'Save';

    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'ghost';
    dismiss.dataset.action = 'dismiss';
    dismiss.textContent = 'Not this one';

    actions.append(accept, dismiss);
    li.append(who, what, where, actions);
    els.pending.append(li);
  }
}

async function resolvePending(id, keep) {
  const item = pending.find((p) => p.id === id);
  pending = pending.filter((p) => p.id !== id);

  if (keep && item) {
    delete item.detectedBy;
    apps.unshift(item);
    await chrome.storage.local.set({ [KEY]: apps, [PENDING]: pending });
    render();
    highlight(item.id);
    notify('Saved. Edit anything the detector got wrong.');
  } else {
    await chrome.storage.local.set({ [PENDING]: pending });
    notify('Dismissed.');
  }

  renderPending();
  chrome.runtime.sendMessage({ type: 'badge-seen' }).catch(() => {});
}

function notify(message, isWarning) {
  els.notice.textContent = message || '';
  els.notice.hidden = !message;
  els.notice.classList.toggle('warn', Boolean(isWarning));
}

function highlight(id) {
  const li = els.list.querySelector(`li[data-id="${id}"]`);
  if (!li) return;
  li.classList.add('flash');
  li.scrollIntoView({ block: 'nearest' });
}

/* ---------- actions ---------- */

async function saveCurrentPage() {
  if (!current) return;

  const existing = current.url && apps.find((a) => a.url === current.url);
  if (existing) {
    notify('Already saved — showing it below.', true);
    highlight(existing.id);
    return;
  }

  const app = {
    id: (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()),
    company: current.company,
    role: current.role,
    url: current.url,
    date: todayISO(),
    status: 'Applied',
    createdAt: Date.now(),
  };

  apps.unshift(app);
  await persist();
  render();
  notify('Saved. Fix the company or role below if the guess was off.');
  highlight(app.id);

  const companyInput = els.list.querySelector(`li[data-id="${app.id}"] input.company`);
  if (companyInput) {
    companyInput.focus();
    companyInput.select();
  }
}

async function updateFrom(target) {
  const li = target.closest('li[data-id]');
  if (!li) return;
  const app = apps.find((a) => a.id === li.dataset.id);
  if (!app) return;

  if (target.classList.contains('company')) app.company = target.value.trim();
  else if (target.classList.contains('role')) app.role = target.value.trim();
  else if (target.classList.contains('date')) app.date = target.value;
  else if (target.classList.contains('status')) {
    app.status = target.value;
    li.dataset.status = app.status;
  } else return;

  await persist();
}

function disarmDelete() {
  if (!armedDeleteId) return;
  const button = els.list.querySelector(`li[data-id="${armedDeleteId}"] button[data-action="delete"]`);
  if (button) {
    button.textContent = '✕';
    button.title = 'Delete';
    button.classList.remove('armed');
  }
  armedDeleteId = null;
}

// Two clicks, because a single misclick would otherwise destroy a record the
// user cannot reconstruct — the posting URL goes with it.
async function deleteFrom(button) {
  const li = button.closest('li[data-id]');
  if (!li) return;
  const id = li.dataset.id;

  if (armedDeleteId !== id) {
    disarmDelete();
    armedDeleteId = id;
    button.textContent = 'Sure?';
    button.title = 'Click again to delete';
    button.classList.add('armed');
    return;
  }

  armedDeleteId = null;
  apps = apps.filter((a) => a.id !== id);
  await persist();
  render();
  notify('Deleted.');
}

/* ---------- CSV ---------- */

function toCSV(rows) {
  const cell = (value) => {
    let s = value == null ? '' : String(value);
    // Stop spreadsheets treating a cell as a formula.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };

  const lines = [['Company', 'Role', 'Status', 'Date Applied', 'URL']];
  for (const a of rows) lines.push([a.company, a.role, a.status, a.date, a.url]);
  return lines.map((line) => line.map(cell).join(',')).join('\r\n');
}

function exportCSV() {
  if (!apps.length) {
    notify('Nothing to export yet.', true);
    return;
  }

  // ﻿ so Excel opens the UTF-8 correctly.
  const blob = new Blob(['﻿' + toCSV(apps)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `job-applications-${todayISO()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  notify(`Exported ${apps.length} application${apps.length === 1 ? '' : 's'}.`);
}

/* ---------- auto-detect settings ---------- */

async function saveSettings() {
  await chrome.storage.local.set({ [SETTINGS]: settings });
  await chrome.runtime.sendMessage({ type: 'sync-registration' }).catch(() => {});
}

function paintSettings(grantedCount) {
  els.autoDetect.checked = settings.autoDetect;
  els.autoSave.checked = settings.autoSave;
  els.autoSave.disabled = !settings.autoDetect;
  if (typeof grantedCount === 'number' && settings.autoDetect) {
    els.autoDetectHelp.textContent = `Watching ${grantedCount} site${grantedCount === 1 ? '' : 's'} for submitted applications.`;
  }
}

async function onAutoDetectToggled() {
  if (!els.autoDetect.checked) {
    settings.autoDetect = false;
    settings.autoSave = false;
    await saveSettings();
    await chrome.permissions.remove({ origins: ALL_SITE_PATTERNS }).catch(() => {});
    paintSettings();
    notify('Auto-detect off. Site access revoked.');
    return;
  }

  // Chrome closes the popup while its own permission dialog is up on some
  // platforms, so persist nothing until we know the answer.
  let granted = false;
  try {
    granted = await chrome.permissions.request({ origins: ALL_SITE_PATTERNS });
  } catch (e) {
    granted = false;
  }

  if (!granted) {
    els.autoDetect.checked = false;
    paintSettings();
    notify('Auto-detect needs access to those job sites to work.', true);
    return;
  }

  settings.autoDetect = true;
  await saveSettings();
  paintSettings(SUPPORTED_SITES.length);
  notify('On. Apply to a job and it will show up here.');
}

async function onAutoSaveToggled() {
  settings.autoSave = els.autoSave.checked;
  await saveSettings();
  notify(settings.autoSave
    ? 'Detected applications will save straight to the list.'
    : 'Detected applications will wait for your confirmation.');
}

/* ---------- wiring ---------- */

els.save.addEventListener('click', saveCurrentPage);
els.export.addEventListener('click', exportCSV);
els.list.addEventListener('change', (e) => updateFrom(e.target));
els.list.addEventListener('click', (e) => {
  if (e.target.dataset.action === 'delete') deleteFrom(e.target);
});
els.pending.addEventListener('click', (e) => {
  const action = e.target.dataset.action;
  if (action !== 'accept' && action !== 'dismiss') return;
  const li = e.target.closest('li[data-id]');
  if (li) resolvePending(li.dataset.id, action === 'accept');
});
els.autoDetect.addEventListener('change', onAutoDetectToggled);
document.addEventListener('click', (e) => {
  if (!armedDeleteId) return;
  if (e.target.dataset && e.target.dataset.action === 'delete') return;
  disarmDelete();
});
els.autoSave.addEventListener('change', onAutoSaveToggled);

(async function init() {
  const stored = await chrome.storage.local.get([KEY, PENDING, SETTINGS]);
  apps = Array.isArray(stored[KEY]) ? stored[KEY] : [];
  pending = Array.isArray(stored[PENDING]) ? stored[PENDING] : [];
  settings = Object.assign({}, DEFAULT_SETTINGS, stored[SETTINGS] || {});

  render();
  renderPending();

  const granted = await chrome.permissions.getAll().catch(() => ({ origins: [] }));
  const origins = granted.origins || [];

  // On some platforms Chrome closes the popup while its own permission dialog is
  // open, so the grant lands but onAutoDetectToggled never gets to save the flag.
  // Treat a live grant as the intent it was, and repair the setting.
  if (!settings.autoDetect && ALL_SITE_PATTERNS.some((p) => origins.includes(p))) {
    settings.autoDetect = true;
    await saveSettings();
  }
  paintSettings(origins.length);

  // Opening the popup counts as having seen whatever the badge was reporting.
  chrome.runtime.sendMessage({ type: 'badge-seen' }).catch(() => {});

  current = await readActiveTab();
  if (!current || !current.url) {
    els.pageTitle.textContent = 'No page to read.';
    els.save.disabled = true;
    return;
  }

  const label = [current.company, current.role].filter(Boolean).join(' — ') || current.title;
  els.pageTitle.textContent = label;
  els.pageTitle.title = current.url;

  if (apps.some((a) => a.url === current.url)) {
    els.save.textContent = '✓ Already saved';
    els.save.disabled = true;
  }
})();
