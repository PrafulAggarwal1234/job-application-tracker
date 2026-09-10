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

There are no `host_permissions`, which means the extension has **no standing access to any website**.
It can only read a page in the moment you click the icon, and it reads nothing else.

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
popup.js         page scraping, title parsing, storage, CSV export
icons/           generated from store/icon.svg
```

After editing, hit the reload button on `chrome://extensions` to pick up the change.

## Roadmap

Deliberately small. Possible next steps: notes per application, filter by status, and a reminder for
applications with no reply after N days.

## License

[MIT](LICENSE)
