// Reads job details out of the current page.
// Injected on demand by the popup, and loaded alongside detector.js when
// auto-detect is enabled. Kept in one file so the two paths never diverge.
'use strict';

(() => {
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

  globalThis.__jatScrape = scrapeJobPage;
  return scrapeJobPage();
})();
