// Minimal test plumbing: no framework, no dependencies.
// Chrome-based tests write a temporary page into the repo root so that the
// extension's own relative <script src> paths resolve exactly as they do in the
// real popup, render it headless, and read a JSON blob back out of #RESULT.
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function chromePath() {
  const candidates = [
    process.env.CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error('Chrome not found. Set CHROME=/path/to/chrome');
  return found;
}

function render(html, name) {
  const file = path.join(ROOT, `_${name}.html`);
  fs.writeFileSync(file, html);
  try {
    const dom = execFileSync(chromePath(), [
      '--headless=new', '--disable-gpu', '--no-sandbox',
      '--virtual-time-budget=10000', '--dump-dom', `file://${file}`,
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 32 * 1024 * 1024 });

    const m = dom.match(/<div id="RESULT">([\s\S]*?)<\/div>/);
    if (!m) throw new Error('page never wrote #RESULT');
    const text = m[1]
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    return JSON.parse(text);
  } finally {
    fs.unlinkSync(file);
  }
}

function runner(title) {
  let pass = 0;
  let fail = 0;
  console.log(`\n${title}`);
  return {
    check(name, got, want) {
      const ok = JSON.stringify(got) === JSON.stringify(want);
      ok ? pass++ : fail++;
      console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
      if (!ok) {
        console.log(`        got  ${JSON.stringify(got)}`);
        console.log(`        want ${JSON.stringify(want)}`);
      }
    },
    done() {
      console.log(`  ${pass} passed, ${fail} failed`);
      if (fail) process.exitCode = 1;
      return fail;
    },
  };
}

module.exports = { ROOT, render, runner, read: (f) => fs.readFileSync(path.join(ROOT, f), 'utf8') };
