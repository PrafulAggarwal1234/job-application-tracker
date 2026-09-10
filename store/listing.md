# Chrome Web Store listing copy

Paste-ready text for the developer dashboard.

## Name (max 45 chars)
`Job Application Tracker`

## Short description (max 132 chars)
`Save any job posting with one click and track your applications. All data stays in your browser — nothing is ever uploaded.`

## Detailed description

Keep track of every job you apply to, without a spreadsheet and without handing your job search to
somebody else's server.

Open a job posting on LinkedIn, Naukri, Indeed or a company's own careers page, click the icon, and hit
Save. The company, role, URL and today's date are recorded for you. The company and role are read off
the page automatically — and every field stays editable, so you can correct anything that came out
wrong just by typing over it.

Move each application through Applied → Interviewing → Rejected or Offer as things progress, and export
the whole list to CSV whenever you want it in a spreadsheet.

Tired of remembering to save? Turn on automatic detection and the extension notices when you've
submitted an application and offers to record it. It's off by default, it asks your permission for the
job sites it watches, and turning it off revokes that access again.

WHY IT'S PRIVATE BY DESIGN
• No account, no sign-up, no server.
• Your applications are stored on your own computer, in Chrome's local storage.
• No analytics, no tracking, no third-party services.
• A default install requests no site access at all. It can only read a page in the moment you click
  its icon. Automatic detection is opt-in and revocable.
• Open source — read every line at
  https://github.com/PrafulAggarwal1234/job-application-tracker

FEATURES
• One-click save from any job page
• Automatic company and role detection, fully editable
• Status tracking: Applied, Interviewing, Rejected, Offer
• Optional automatic detection — notices when you've submitted an application
• Duplicate detection so you don't save the same posting twice
• One-click CSV export
• Light and dark mode

## Category
Productivity

## Single purpose (required by review)
Lets the user save job postings they have applied to and track the status of each application.

## Permission justifications (required by review)

**storage** — Stores the user's own list of saved applications on their device. Nothing is transmitted.

**activeTab** — Reads the title and URL of the tab the user is viewing so the application can be saved,
only at the moment the user clicks the extension icon.

**scripting** — Injects a small script into that one page, on that click, to read the company name and
job title from the posting so the user does not have to type them. Also used to register the optional
detection script described below, once the user has granted access.

**Optional host permissions** (LinkedIn, Naukri, Indeed, Greenhouse, Lever, Ashby, Workday) — Requested
at runtime, only if the user switches on "Detect applications automatically", and revoked when they
switch it off. A default installation requests no site access at all. When granted, a content script
watches those sites for an application-submission confirmation so the user's application is recorded
without them having to remember to save it. It reads only the job title and company, and transmits
nothing.

## Privacy
- Privacy policy URL: `https://prafulaggarwal1234.github.io/job-application-tracker/`
- Data collection disclosures: select **nothing** in every category.
- "Do you use remote code?" → No.

## Assets checklist
- [x] 128x128 icon — `icons/icon128.png`
- [ ] Screenshot 1280x800 or 640x400 — popup with 3-4 applications in different statuses
- [ ] Screenshot 2 — a job page with the popup open, showing prefilled fields
