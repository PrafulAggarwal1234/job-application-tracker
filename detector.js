// Watches a job page for a submission confirmation and reports it to the
// service worker. Only ever runs on a site the user has explicitly granted.
//
// Detection is keyed off confirmation *text* rather than CSS selectors:
// LinkedIn and Naukri rotate obfuscated class names constantly, but the
// sentence they show you after applying is comparatively stable.
'use strict';

(() => {
  if (globalThis.__jatDetectorLoaded) return;
  globalThis.__jatDetectorLoaded = true;

  // Deliberately specific. Bare "application sent" is omitted because LinkedIn
  // prints it against every row of the My Jobs list, which would fire on browsing.
  const PHRASES = [
    'your application was sent',
    'application was sent to',
    'your application has been submitted',
    'your application has been received',
    'we have received your application',
    'application submitted successfully',
    'you have successfully applied',
    'successfully applied',
    'thank you for applying',
    'thanks for applying',
  ];

  // Confirmation routes used by the common applicant tracking systems.
  const URL_HINTS = [
    /\/confirmation\b/i,
    /\/thanks\b/i,
    /post[-_]?apply/i,
    /application[-_]?(sent|complete|completed|submitted)/i,
  ];

  // A single posting, as opposed to a search page or the "jobs I applied to" list.
  const JOB_URL = [
    /\/jobs?\/view\//i,
    /\/viewjob\b/i,
    /\/job-listings?[-/]/i,
    /\/jobs?\/[0-9a-f-]{6,}/i,
    /\/(apply|application)\b/i,
    /greenhouse\.io\/.+\/jobs?\//i,
    /lever\.co\/[^/]+\/[0-9a-f-]{8,}/i,
    /ashbyhq\.com\/[^/]+\//i,
  ];

  const reported = new Set();
  let timer = null;
  let observer = null;

  const hasPhrase = (text) => {
    const t = (text || '').toLowerCase();
    return PHRASES.some((p) => t.includes(p));
  };

  function looksLikeJobPage() {
    const path = location.pathname + location.search;
    if (JOB_URL.some((r) => r.test(path))) return true;
    // Careers pages that describe themselves properly.
    for (const node of document.querySelectorAll('script[type="application/ld+json"]')) {
      if ((node.textContent || '').includes('JobPosting')) return true;
    }
    return false;
  }

  function report(reason) {
    const url = location.href;
    if (reported.has(url)) return;
    reported.add(url);

    let payload = {};
    try {
      payload = (globalThis.__jatScrape && globalThis.__jatScrape()) || {};
    } catch (e) {
      payload = { title: document.title, url };
    }

    try {
      const sending = chrome.runtime.sendMessage({ type: 'application-detected', reason, payload });
      if (sending && typeof sending.catch === 'function') sending.catch(() => {});
    } catch (e) {
      // Extension reloaded or updated while the page stayed open. Nothing to do.
    }
  }

  const urlLooksDone = () => URL_HINTS.some((r) => r.test(location.pathname + location.search));

  function check(addedNodes) {
    if (urlLooksDone()) {
      report('url');
      return;
    }
    if (!looksLikeJobPage()) return;

    if (addedNodes) {
      for (const node of addedNodes) {
        if (!node || node.nodeType !== 1) continue;
        if (hasPhrase((node.innerText || '').slice(0, 4000))) {
          report('confirmation');
          return;
        }
      }
      return;
    }

    if (hasPhrase(((document.body && document.body.innerText) || '').slice(0, 20000))) {
      report('confirmation');
    }
  }

  function start() {
    check(null);

    observer = new MutationObserver((records) => {
      const added = [];
      for (const r of records) {
        for (const n of r.addedNodes) added.push(n);
      }
      if (!added.length) return;
      clearTimeout(timer);
      timer = setTimeout(() => check(added), 400);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    // These sites are single-page apps, so a "navigation" is just a URL swap.
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      setTimeout(() => check(null), 600);
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
