# Job Application Tracker

A Chrome extension that saves a job posting with one click and keeps your applications in a simple list.

**Your data never leaves your browser.** There is no backend, no account, and no analytics. Everything
lives in `chrome.storage.local` on your own machine.

![icon](icons/icon128.png)

## What it does

- Click the toolbar icon on any job page (LinkedIn, Naukri, Indeed, or a company careers page) and hit
  **Save this page**. It records the company, role, URL and today's date.
- Company and role are guessed from the page — via site-specific selectors, then the page's
  [schema.org `JobPosting`](https://schema.org/JobPosting) data, then the title. Every field stays
  editable, so fix anything the guess got wrong by typing over it.
- Track each application through **Applied → Interviewing → Rejected / Offer**.
- Export everything to CSV for your own spreadsheet.

## Install from source

1. Clone this repo.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the cloned folder.
4. Pin the extension so the icon is always visible.

## Permissions, and why each one is needed

| Permission | Why |
| --- | --- |
| `storage` | Saves your list on this device. Nothing is synced or uploaded. |
| `activeTab` | Reads the title and URL of the tab you're on — and only when you click the icon. |
| `scripting` | Injects the small reader that pulls the company and role out of that one page. |

There are no required `host_permissions`, which means a default install has **no standing access to any
website**. It can only read a page in the moment you click the icon, and it reads nothing else.

## Automatic detection (optional, off by default)

Saving by hand means remembering to do it. Turn on **Detect applications automatically** and the
extension notices the confirmation screen after you submit, then either queues the application for you
to confirm or — if you also turn on **Save without asking me** — files it directly.

This needs to watch job sites, so it is an `optional_host_permissions` grant rather than a required one:

- A fresh install still asks for nothing. The toggle triggers Chrome's own permission prompt, and only
  then is the detector registered via `chrome.scripting.registerContentScripts()`.
- Turning it off revokes the site access, not just the behaviour.
- Covers LinkedIn, Naukri, Indeed, Greenhouse, Lever, Ashby and Workday.

**Detection is a heuristic and it will sometimes miss.** It keys off confirmation *text*
("your application was sent", "thank you for applying") rather than CSS selectors, because job boards
rewrite their markup constantly but rarely reword that sentence. Even so, a redesign or an unusual apply
flow can slip past it — which is exactly why the manual button is never going away. Treat auto-detect as
a convenience on top, not as the thing you rely on.

The reverse mistake is cheaper: if it saves something you did not apply to, delete the row.

## Data

Everything is stored under a single `applications` key in `chrome.storage.local`:

```js
{
  id: "…", company: "Acme", role: "Backend Engineer",
  url: "https://…", date: "2026-09-10", status: "Applied", createdAt: 1757500000000
}
```

Uninstalling the extension deletes it. There is no copy anywhere else — so use **Export CSV** if you
want a backup.

## Development

Plain Manifest V3 and vanilla JavaScript. No build step, no dependencies, no bundler.

```
manifest.json    permissions and the toolbar action
popup.html/css   the popup UI
popup.js         the popup: list, pending queue, settings, CSV export
shared.js        site list + pure helpers used by the popup and the worker
scrape.js        reads job details out of a page (injected on demand)
detector.js      watches a granted site for a submission confirmation
background.js    service worker: dedupes detections, badge, script registration
icons/           generated from store/icon.svg
```

`shared.js` exists so a detected application is parsed by exactly the same code as a manually saved
one — `resolveFields()` is the single source of truth for turning a scraped page into a company and a
role. `scrape.js` is an IIFE so that injecting it into a tab that already runs it as a content script
cannot collide.

After editing, hit the reload button on `chrome://extensions` to pick up the change.

## Tests

No framework and no dependencies — just node and Chrome:

```bash
./test/run.sh          # 57 assertions across 4 suites
CHROME=/path/to/chrome ./test/run.sh
```

The suites drive the real extension files rather than copies of them:

| Suite | Covers |
| --- | --- |
| `parse.test.js` | `splitTitle()` against real page titles, URL normalising, field precedence |
| `background.test.js` | the worker's decisions: ignore / queue / file, dedupe, badge, registration |
| `detector.test.js` | renders a synthetic job page in headless Chrome and checks *when* the detector fires |
| `popup.test.js` | drives the real `popup.html`: detected queue, accept, and the permission flow |

The detector's negative cases carry the most weight. It has to stay quiet on a plain posting and on the
applied-jobs list — where LinkedIn prints "Application sent" against every row — because firing there
would fill the tracker with jobs you only looked at.

## Roadmap

Deliberately small. Possible next steps: notes per application, filter by status, and a reminder for
applications with no reply after N days.

## License

[MIT](LICENSE)
