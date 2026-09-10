#!/usr/bin/env bash
# Build the zip to upload to the Chrome Web Store.
set -euo pipefail
cd "$(dirname "$0")"

VERSION=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
OUT="job-application-tracker-v${VERSION}.zip"

rm -f "$OUT"
zip -r -q "$OUT" manifest.json popup.html popup.css popup.js \
  shared.js scrape.js detector.js background.js icons
echo "$OUT"
unzip -l "$OUT"
