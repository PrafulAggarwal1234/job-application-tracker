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

## Found while testing

<!-- Add here. Format: what you did, what happened, what you expected. A URL helps a lot. -->

- [ ] **Auto-detect will miss most LinkedIn applications.** `looksLikeJobPage()` gates phrase-based
      detection on the URL looking like a single posting, and only `/jobs/view/<id>` qualifies. But
      Easy Apply usually happens from the search or collections page, where the posting renders in a
      side pane and the URL stays `/jobs/search/?currentJobId=<id>` or
      `/jobs/collections/recommended/?currentJobId=<id>`. Neither matches, so the confirmation is
      ignored.
      *Fix:* treat a `currentJobId` query parameter as qualifying, and use it for dedupe so the same
      posting saved from a search page and from its own page does not appear twice.

- [ ] **The Greenhouse / Lever / Ashby patterns in `JOB_URL` can never match.** They include the
      hostname (`/lever\.co\/[^/]+\/[0-9a-f-]{8,}/`) but are tested against `pathname + search`,
      which has no hostname in it. So `jobs.lever.co/acme/<uuid>` does not qualify at all. Greenhouse
      only passes by accident, via the generic `/\/jobs?\/[0-9a-f-]{6,}/` rule.
      *Fix:* test the host separately from the path, or drop the hostname from those patterns.
      *Note:* only affects the phrase path — these sites' confirmation URLs still trigger via
      `URL_HINTS` (`/confirmation`, `/thanks`), which is the more common route for them.

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
- [ ] LinkedIn Easy Apply — fires on the confirmation
- [ ] Does *not* fire while browsing the LinkedIn applied-jobs list *(the false positive I designed
      against; tested synthetically, never live)*
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
