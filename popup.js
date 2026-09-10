'use strict';

const KEY = 'applications';
const STATUSES = ['Applied', 'Interviewing', 'Rejected', 'Offer'];

const $ = (id) => document.getElementById(id);
const els = {
  list: $('list'), count: $('count'), empty: $('empty'),
  save: $('save'), pageTitle: $('page-title'), notice: $('notice'), export: $('export'),
};

let apps = [];
let current = null; // { company, role, url, title } for the active tab

/* ---------- storage ---------- */

async function loadApps() {
  const stored = await chrome.storage.local.get(KEY);
  return Array.isArray(stored[KEY]) ? stored[KEY] : [];
}

async function persist() {
  await chrome.storage.local.set({ [KEY]: apps });
}

/* ---------- page reading ---------- */

// Runs in the page, only after the user clicks the toolbar icon (activeTab).
// Must be fully self-contained: it is serialised and injected.
function scrapeJobPage() {
  const clean = (s) => (typeof s === 'string' ? s : '').replace(/\s+/g, ' ').trim();
  const pick = (selectors) => {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      const text = el ? clean(el.textContent) : '';
      if (text) return text;
    }
    return '';
  };

  const host = location.hostname.replace(/^www\./, '');
  let role = '';
  let company = '';

  if (host.endsWith('linkedin.com')) {
    role = pick([
      '.job-details-jobs-unified-top-card__job-title',
      '.jobs-unified-top-card__job-title',
      '.topcard__title',
      'h1',
    ]);
    company = pick([
      '.job-details-jobs-unified-top-card__company-name a',
      '.job-details-jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__company-name',
      '.topcard__org-name-link',
    ]);
  } else if (host.endsWith('naukri.com')) {
    role = pick(['[class*="jd-header-title"]', 'h1']);
    company = pick(['[class*="jd-header-comp-name"] a', '[class*="jd-header-comp-name"]', '.comp-name']);
  } else if (host.includes('indeed.')) {
    role = pick(['[data-testid="jobsearch-JobInfoHeader-title"]', '.jobsearch-JobInfoHeader-title', 'h1']);
    company = pick([
      '[data-testid="inlineHeader-companyName"]',
      '[data-company-name="true"]',
      '.jobsearch-CompanyInfoContainer a',
    ]);
  }

  // schema.org JobPosting — how most ATS pages (Greenhouse, Lever, Workday, Ashby) describe themselves.
  if (!role || !company) {
    for (const node of document.querySelectorAll('script[type="application/ld+json"]')) {
      let data;
      try { data = JSON.parse(node.textContent); } catch (e) { continue; }
      const items = [].concat(data, (data && data['@graph']) || []);
      for (const item of items) {
        if (!item || item['@type'] !== 'JobPosting') continue;
        const org = item.hiringOrganization;
        const orgName = typeof org === 'string' ? org : (org && org.name) || '';
        role = role || clean(item.title);
        company = company || clean(orgName);
      }
    }
  }

  if (!role) role = pick(['h1']);
  if (!company) {
    const og = document.querySelector('meta[property="og:site_name"]');
    company = clean(og && og.content);
  }

  return { role, company, title: clean(document.title), url: location.href };
}

// Last-resort guesses from a page title, e.g.
//   "Acme hiring Backend Engineer in Bengaluru | LinkedIn"
//   "Backend Engineer at Acme"
//   "Backend Engineer - Acme Careers"
function splitTitle(rawTitle) {
  const SITES = /\s*[|·—–\-]\s*(linkedin|naukri(\.com)?|indeed(\.com)?|glassdoor|monster|shine|instahyre|wellfound|angellist|greenhouse|lever|workday|ashby|careers?|jobs?|job search|hiring)\s*$/i;

  let t = (rawTitle || '').replace(/\s+/g, ' ').trim();
  while (SITES.test(t)) t = t.replace(SITES, '');

  let m = t.match(/^(.+?)\s+(?:is\s+)?hiring\s+(?:an?\s+)?(.+?)(?:\s+in\s+.+)?$/i);
  if (m) return { company: m[1], role: m[2] };

  // Naukri renders "<Role> Job in <Company> at <Location>", so " in " wins over " at " here.
  m = t.match(/^(.+?)\s+jobs?\s+in\s+(.+?)(?:\s+at\s+.+)?$/i);
  if (m) return { role: m[1], company: m[2] };

  m = t.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
  if (m) return { role: m[1], company: m[2] };

  m = t.match(/^(.+?)\s*[|·—–]\s*(.+)$/);
  if (m) return { role: m[1], company: m[2] };

  m = t.match(/^(.+?)\s+-\s+(.+)$/);
  if (m) return { role: m[1], company: m[2] };

  return { role: t, company: '' };
}

const tidy = (s) => (s || '').replace(/\s+/g, ' ').replace(/\s*[|·—–-]\s*$/, '').trim();

// A company scraped out of a page title tends to keep a domain or a "Careers" tail.
const tidyCompany = (s) =>
  tidy(tidy(s).replace(/\.(com|co|co\.in|in|io|ai|jobs|net|org)$/i, '').replace(/\s+(careers?|jobs?)$/i, ''));

async function readActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return null;

  let scraped = null;
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeJobPage,
    });
    scraped = result && result.result;
  } catch (e) {
    // chrome:// pages, the Web Store, PDFs and file:// URLs cannot be injected into.
    // Title + URL from the tab itself is still enough to save something useful.
  }

  const title = (scraped && scraped.title) || tab.title || '';
  const url = (scraped && scraped.url) || tab.url || '';
  const guess = splitTitle(title);

  return {
    title,
    url,
    role: tidy((scraped && scraped.role) || guess.role),
    company: tidyCompany((scraped && scraped.company) || guess.company),
  };
}

/* ---------- rendering ---------- */

function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function render() {
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

async function deleteFrom(button) {
  const li = button.closest('li[data-id]');
  if (!li) return;
  apps = apps.filter((a) => a.id !== li.dataset.id);
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

/* ---------- wiring ---------- */

els.save.addEventListener('click', saveCurrentPage);
els.export.addEventListener('click', exportCSV);
els.list.addEventListener('change', (e) => updateFrom(e.target));
els.list.addEventListener('click', (e) => {
  if (e.target.dataset.action === 'delete') deleteFrom(e.target);
});

(async function init() {
  apps = await loadApps();
  render();

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
