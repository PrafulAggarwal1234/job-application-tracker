// splitTitle() is the last-resort path, used whenever a page exposes no useful
// markup. It runs on real-world page titles, so it is tested against them.
'use strict';

const { read, runner } = require('./helpers');
const t = runner('shared.js — title parsing and URL normalising');

const api = new Function(read('shared.js') + '; return { splitTitle, tidy, tidyCompany, normalizeUrl, resolveFields };')();
const parse = (title) => {
  const r = api.splitTitle(title);
  return [api.tidyCompany(r.company), api.tidy(r.role)];
};

t.check('LinkedIn "hiring ... in <city>"',
  parse('Acme Corp hiring Backend Engineer in Bengaluru | LinkedIn'), ['Acme Corp', 'Backend Engineer']);
t.check('LinkedIn "is hiring a ..."',
  parse('Meesho is hiring a Senior SDE in Bangalore, Karnataka, India | LinkedIn'), ['Meesho', 'Senior SDE']);
t.check('"<role> at <company>"',
  parse('Backend Engineer at Stripe'), ['Stripe', 'Backend Engineer']);
t.check('dash separator plus a Careers tail',
  parse('Senior Software Engineer - Razorpay | Careers'), ['Razorpay', 'Senior Software Engineer']);
t.check('domain-shaped brand is trimmed',
  parse('Software Development Engineer II | Amazon.jobs'), ['Amazon', 'Software Development Engineer II']);
t.check('Naukri "Job in <company> at <city>" — " in " must beat " at "',
  parse('SDE-1 Job in Zomato at Gurgaon - Naukri.com'), ['Zomato', 'SDE-1']);
t.check('Naukri plural form',
  parse('Data Scientist Jobs in Swiggy - Naukri.com'), ['Swiggy', 'Data Scientist']);
t.check('middot separator',
  parse('Product Designer · Figma · Jobs'), ['Figma', 'Product Designer']);
t.check('no company in the title',
  parse('Frontend Engineer'), ['', 'Frontend Engineer']);

t.check('tracking parameters are ignored when comparing postings',
  api.normalizeUrl('https://linkedin.com/jobs/view/1?refId=x&trk=y&utm_source=z#top'),
  'https://linkedin.com/jobs/view/1');
t.check('a meaningful query parameter is kept',
  api.normalizeUrl('https://boards.greenhouse.io/acme/jobs/123?gh_jid=456'),
  'https://boards.greenhouse.io/acme/jobs/123?gh_jid=456');
t.check('scraped values win over the title guess',
  api.resolveFields({ title: 'Backend Engineer at Stripe', company: 'Stripe Inc.', role: 'Backend Engineer II' }),
  { role: 'Backend Engineer II', company: 'Stripe Inc.' });

t.done();
