'use strict';
// Site config and the pure helpers that both the popup and the service worker
// need. Loaded as a plain script into each, so these are deliberately globals.
// Field resolution lives here so an auto-detected entry is parsed exactly the
// same way a manually saved one is.


const SUPPORTED_SITES = [
  { id: 'linkedin', label: 'LinkedIn', patterns: ['*://*.linkedin.com/*'] },
  { id: 'naukri', label: 'Naukri', patterns: ['*://*.naukri.com/*'] },
  { id: 'indeed', label: 'Indeed', patterns: ['*://*.indeed.com/*'] },
  { id: 'greenhouse', label: 'Greenhouse', patterns: ['*://*.greenhouse.io/*'] },
  { id: 'lever', label: 'Lever', patterns: ['*://jobs.lever.co/*'] },
  { id: 'ashby', label: 'Ashby', patterns: ['*://jobs.ashbyhq.com/*'] },
  { id: 'workday', label: 'Workday', patterns: ['*://*.myworkdayjobs.com/*'] },
];

const ALL_SITE_PATTERNS = SUPPORTED_SITES.reduce((acc, s) => acc.concat(s.patterns), []);

const DETECT_SCRIPT_ID = 'jat-detector';

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
      files: ['scrape.js'],
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

function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// Same posting reached from a search page, an email and a share link produces three
// different URLs. Compare on this, store the original.
function normalizeUrl(raw) {
  try {
    const url = new URL(raw);
    url.hash = '';
    for (const key of [
      'refId', 'trackingId', 'trk', 'trkInfo', 'position', 'pageNum', 'eBP',
      'originalSubdomain', 'src', 'from', 'gclid', 'fbclid', 'gh_src',
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
    ]) url.searchParams.delete(key);
    return url.toString().replace(/\/$/, '');
  } catch (e) {
    return raw || '';
  }
}

// Turns whatever scrape.js managed to read into the two fields we store.
function resolveFields(payload) {
  const guess = splitTitle((payload && payload.title) || '');
  return {
    role: tidy((payload && payload.role) || guess.role),
    company: tidyCompany((payload && payload.company) || guess.company),
  };
}
