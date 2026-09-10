#!/usr/bin/env bash
# Runs every test. Needs node and Chrome; set CHROME=/path/to/chrome to override.
set -uo pipefail
cd "$(dirname "$0")/.."

status=0
for f in test/parse.test.js test/background.test.js test/detector.test.js test/popup.test.js; do
  node "$f" || status=1
done

echo
if [ "$status" -eq 0 ]; then echo "all suites passed"; else echo "FAILURES"; fi
exit "$status"
