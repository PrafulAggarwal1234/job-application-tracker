# v1.1 punch list

Running list of findings from real-world testing. v1.0.0 is in Chrome Web Store review and is
frozen — nothing here goes into it. Everything lands on `feat/auto-detect` and ships as v1.1.

Add findings under **Found while testing** as you hit them; no need to be tidy about it.

---

## Fixed, awaiting release

- [x] **Deleting a row had no confirmation.** ✕ removed the entry instantly. Now the first click turns
      the ✕ into a small red **Sure?**; a second click deletes, and clicking anywhere else cancels.
      Chosen over an undo because the popup closes the moment you click outside it, so an undo would
      not survive a misclick-then-click-away — and a deleted posting cannot be reconstructed, since
      its URL goes with it.

- [x] **Auto-detect missed most LinkedIn applications.** Easy Apply usually runs from the search or
      collections page, where the URL keeps the posting in `currentJobId` and the path never becomes
      `/jobs/view/<id>` — so `looksLikeJobPage()` rejected it and the confirmation was ignored.
      A `currentJobId` parameter now qualifies, and `normalizeUrl()` collapses both URL forms to the
      same posting so saving from either place is not counted twice.
      *Confirmed end-to-end* against a page served on a real `www.linkedin.com` origin.

- [x] **The Greenhouse / Lever / Ashby patterns could never match.** They named a hostname but were
      tested against the path alone. Gating now matches on hostname + path + query, and a Workday
      pattern was added. Nine real URL shapes are asserted to qualify and six to be rejected.

- [x] **Dropped the trigger phrase "successfully applied".** Too loose once search pages qualify — the
      side pane can say it about a job applied to previously. The longer forms that confirmation
      screens actually print are kept.

## Found while testing

<!-- Add here. Format: what you did, what happened, what you expected. A URL helps a lot. -->

- [ ] …

## Unverified — needs a real page to confirm

My tests stub the `chrome.*` APIs, so these paths have never run for real. Confirmed working is
marked; the rest are unknown, not broken.

**Manual save**
- [x] LinkedIn job posting — company + role read correctly *(confirmed on a live page)*
- [ ] Naukri job posting — site-specific selectors unverified
- [ ] Indeed job posting — site-specific selectors unverified
- [ ] A Greenhouse / Lever / Ashby posting — exercises the JSON-LD path
- [ ] A company careers page with no JSON-LD — exercises title parsing
- [ ] Duplicate detection: click the icon twice on the same posting
- [ ] Status change survives closing and reopening the popup
- [ ] Field edits survive closing and reopening the popup
- [ ] Export CSV opens cleanly in Numbers / Excel, with commas and quotes intact
- [ ] Dark mode renders correctly

**Auto-detect (v1.1 only, 7 sites)**
- [x] LinkedIn Easy Apply — fires on the confirmation *(covered by `test/e2e.test.js`, which serves
      the page on a real `www.linkedin.com` origin via `--host-resolver-rules`, so the detector reads
      genuine `location` values. Does not need a real application.)*
- [x] Does *not* fire while browsing the LinkedIn applied-jobs list *(same suite)*
- [ ] Naukri apply flow
- [ ] Indeed apply flow
- [ ] Greenhouse / Lever / Ashby confirmation page
- [ ] Permission prompt appears and the detector registers after granting
- [ ] Turning auto-detect off actually revokes site access (`chrome://extensions` should stop
      listing the site permissions)
- [ ] Auto-save mode files entries without asking, badge turns green

## Deferred ideas

Not for v1.1 unless something here turns out to matter more than the above.

- [ ] Notes field per application
- [ ] Filter or group the list by status
- [ ] Nudge for applications with no reply after N days
- [ ] Firefox and Edge builds (Edge takes the same package unchanged)

---

## Shipping v1.1

1. Work through **Found while testing** and any failures above
2. `./test/run.sh` — all suites green
3. Bump `version` in `manifest.json` to `1.1.0`
4. Merge `feat/auto-detect` into `main`
5. `node store/screenshots.js` — the popup gained the settings section, so the listing images are stale
6. Update `store/listing.md` with the optional-host-permission justifications, then
   `python3 store/paste-ready.py`
7. `./package.sh` and upload as an update
8. Privacy policy already covers auto-detect on this branch — confirm it is live after merging
