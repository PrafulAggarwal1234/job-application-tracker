// Guards the file boundaries that keep the popup and the service worker in
// agreement. Both of these have already been violated once by a bad refactor:
// readActiveTab drifted into shared.js, and the popup quietly kept its own
// copy of the field-resolution logic.
'use strict';

const { read, runner } = require('./helpers');
const t = runner('architecture');

const shared = read('shared.js');
const popup = read('popup.js');
const background = read('background.js');

// shared.js is loaded into the popup AND importScripts-ed into the service
// worker, so it must be pure logic with no extension APIs.
t.check('shared.js calls no chrome.* API', /\bchrome\./.test(shared), false);
t.check('shared.js touches no DOM', /\bdocument\.|\bwindow\./.test(shared), false);

// resolveFields() is the only sanctioned way to turn a scraped page into a
// company and a role. Calling the pieces directly is how the two paths drifted.
for (const [name, src] of [['popup.js', popup], ['background.js', background]]) {
  t.check(`${name} resolves fields via resolveFields()`, /resolveFields\(/.test(src), true);
  t.check(`${name} does not call splitTitle() directly`, /splitTitle\(/.test(src), false);
  t.check(`${name} does not call tidyCompany() directly`, /tidyCompany\(/.test(src), false);
}

// readActiveTab belongs to the popup: it queries tabs and injects a script.
t.check('readActiveTab lives in popup.js', /async function readActiveTab/.test(popup), true);
t.check('  and not in shared.js', /readActiveTab/.test(shared), false);

t.done();
