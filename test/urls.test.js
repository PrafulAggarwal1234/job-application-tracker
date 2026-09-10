// The detector only inspects a page's text if the URL looks like a single job
// posting. That gate is pure string matching, so it is worth testing exhaustively
// against the URL shapes these sites actually produce — two bugs lived here.
'use strict';

const { read, runner } = require('./helpers');

const src = read('detector.js');
const grab = (name) => {
  const start = src.indexOf(`const ${name} = [`);
  const end = src.indexOf('];', start) + 2;
  return eval(src.slice(start, end).replace(`const ${name} =`, ''));
};
const JOB_URL = grab('JOB_URL');
const URL_HINTS = grab('URL_HINTS');
const PHRASES = grab('PHRASES');

// mirrors looksLikeJobPage()'s URL half
const qualifies = (u) => {
  const url = new URL(u);
  return JOB_URL.some((r) => r.test(url.hostname + url.pathname + url.search));
};
const isConfirmationRoute = (u) => {
  const url = new URL(u);
  return URL_HINTS.some((r) => r.test(url.pathname + url.search));
};

const t = runner('detector.js — URL gating');

/* --- pages that must qualify as a single posting --- */
[
  ['LinkedIn posting in its own tab', 'https://www.linkedin.com/jobs/view/4012345678/'],
  ['LinkedIn search side pane (where Easy Apply usually happens)', 'https://www.linkedin.com/jobs/search/?currentJobId=4012345678'],
  ['LinkedIn collections side pane', 'https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4012345678'],
  ['Naukri posting', 'https://www.naukri.com/job-listings-backend-engineer-acme-bengaluru-3-to-6-years-010125123456'],
  ['Indeed posting', 'https://in.indeed.com/viewjob?jk=abc123def456'],
  ['Greenhouse posting', 'https://boards.greenhouse.io/acme/jobs/4567890'],
  ['Lever posting', 'https://jobs.lever.co/acme/1a2b3c4d-5e6f-7890-abcd-ef1234567890'],
  ['Ashby posting', 'https://jobs.ashbyhq.com/acme/9f8e7d6c-1234-5678-9abc-def012345678'],
  ['Workday posting', 'https://acme.wd1.myworkdayjobs.com/en-US/careers/job/Bengaluru/Backend-Engineer_R-12345'],
].forEach(([label, url]) => t.check(`qualifies: ${label}`, qualifies(url), true));

/* --- pages that must NOT qualify, or the tracker fills with jobs merely browsed --- */
[
  ['LinkedIn applied-jobs list', 'https://www.linkedin.com/my-items/saved-jobs/?cardType=APPLIED'],
  ['LinkedIn bare search, nothing selected', 'https://www.linkedin.com/jobs/search/?keywords=backend'],
  ['LinkedIn feed', 'https://www.linkedin.com/feed/'],
  ['Naukri search results', 'https://www.naukri.com/backend-engineer-jobs-in-bengaluru'],
  ['Indeed search results', 'https://in.indeed.com/jobs?q=backend+engineer&l=Bengaluru'],
  ['an unrelated site', 'https://news.ycombinator.com/item?id=123456'],
].forEach(([label, url]) => t.check(`does not qualify: ${label}`, qualifies(url), false));

/* --- confirmation routes, which fire on their own --- */
[
  ['Greenhouse confirmation', 'https://boards.greenhouse.io/acme/jobs/4567890/confirmation'],
  ['Lever thank-you', 'https://jobs.lever.co/acme/1a2b3c4d-5e6f-7890-abcd-ef1234567890/thanks'],
  ['Indeed post-apply', 'https://smartapply.indeed.com/beta/indeedapply/form/post-apply'],
].forEach(([label, url]) => t.check(`confirmation route: ${label}`, isConfirmationRoute(url), true));

t.check('a plain posting is not a confirmation route',
  isConfirmationRoute('https://boards.greenhouse.io/acme/jobs/4567890'), false);

/* --- the phrase that would fire while merely browsing --- */
t.check('bare "successfully applied" is not a trigger phrase',
  PHRASES.includes('successfully applied'), false);
t.check('bare "application sent" is not a trigger phrase (LinkedIn lists it per row)',
  PHRASES.includes('application sent'), false);
t.check('the LinkedIn confirmation wording is a trigger',
  PHRASES.includes('your application was sent'), true);

/* --- dedupe across the two ways to reach one LinkedIn posting --- */
const api = new Function(read('shared.js') + '; return { normalizeUrl };')();
t.check('search-page and own-tab URLs collapse to the same posting',
  api.normalizeUrl('https://www.linkedin.com/jobs/search/?currentJobId=4012345678&refId=x'),
  api.normalizeUrl('https://www.linkedin.com/jobs/view/4012345678/'));
t.check('different postings stay distinct',
  api.normalizeUrl('https://www.linkedin.com/jobs/search/?currentJobId=1') ===
  api.normalizeUrl('https://www.linkedin.com/jobs/search/?currentJobId=2'), false);

t.done();
