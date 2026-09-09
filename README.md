# ASPIC II — Purchase Order app

A small web app with two tabs:

- **New PO** — fill in a form, click *Create PO & download PDF*. It fills in
  your existing fillable PO template (`public/aspic-po-template.pdf`) with
  pdf-lib right in the browser and downloads the finished PDF.
- **PO Log** — every PO you create is also saved to a log (via a Netlify
  Function + Netlify Blobs, no external database needed). You can search it,
  change a PO's status, re-download any PO's PDF, delete a row, or export
  the whole log to CSV.

No sign-up, no database to configure — Netlify Blobs is built into your
Netlify site automatically once this is deployed.

## Deploy it (pick one)

### Option A — Netlify CLI (fastest, ~2 minutes)

1. Install the CLI if you don't have it: `npm install -g netlify-cli`
2. From this folder, log in: `netlify login`
3. Create/link a site: `netlify init` (choose "Create & configure a new site")
4. Install dependencies: `npm install`
5. Deploy to production: `netlify deploy --prod`

Netlify will print your live URL when it's done (something like
`https://aspic-po.netlify.app`).

### Option B — Connect a GitHub repo (best for ongoing edits)

1. Push this folder to a new GitHub repository.
2. In the Netlify dashboard: **Add new site → Import an existing project**,
   pick the repo.
3. Build settings are already set via `netlify.toml`
   (publish directory `public`, functions directory `netlify/functions`) —
   just click **Deploy**.
4. Every future `git push` redeploys automatically.

### Option C — Manual drag-and-drop

Netlify's drag-and-drop deploy (app.netlify.com/drop) only works for static
files — it won't pick up the `netlify/functions` folder or install
dependencies, so the PO Log tab won't work until you switch to Option A or B.
Fine for a quick look at the New PO form and PDF download only.

## After it's live

- Bookmark the site URL for the team, or add it to your phone's home screen
  (it works fine on mobile browsers).
- Anyone with the link can create and see POs — there's no login. If you
  want to restrict access, Netlify's **Site settings → Visitor access**
  has a free option to password-protect the whole site, or you can add
  Netlify Identity for individual logins.
- The PO log lives in Netlify Blobs, scoped to this site — it isn't
  affected by redeploys, and there's nothing to back up manually (though
  the **Export CSV** button is there any time you want a copy).

## Project structure

```
public/
  index.html              the two-tab app
  style.css
  app.js                  form logic, PDF filling (pdf-lib), log calls
  aspic-po-template.pdf   your fillable PO template — swap this file to
                           change the PDF's look, as long as field names match
netlify/functions/
  po-log.js               GET/POST/DELETE API for the PO log (Netlify Blobs)
netlify.toml              publish dir, functions dir, /api/* redirect
package.json              @netlify/blobs dependency
```

## Customizing

- **Add/change a field:** add the input in `index.html`, read it in
  `gatherData()` in `app.js`, and add a matching `setText(...)` call in
  `fillAndDownloadPDF()`. The name must match a field in the PDF template
  exactly (open the PDF in Acrobat's "Prepare Form" view to see field names).
- **Change the PDF template:** replace
  `public/aspic-po-template.pdf` with a new fillable PDF, as long as it has
  the same field names (`date`, `po_number`, `qty_1`…`qty_8`, etc.) — or
  update the field names in `app.js` to match your new template.
- **Statuses:** edit the `STATUSES` array near the top of the "log tab"
  section in `app.js`.
