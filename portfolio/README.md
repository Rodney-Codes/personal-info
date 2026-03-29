# Portfolio site

Vite static site driven by **`config/workflow.active.json`** selections:
- resume content from `content/resumes/<resume_content_id>.md`
- portfolio content from `content/portfolios/<portfolio_content_id>.md`
- portfolio format from `templates/portfolio_formats/<portfolio_format_id>.json`
- output files in `public/` from `outputs.*` plus `workflow.runtime.json`

## Design

The active **`templates/portfolio_formats/<portfolio_format_id>.json`** sets `templateVariant` and UI defaults. **`templateVariant: format2`** loads the React app in **`src/format2/upstream/`** (data from generated site JSON). Other variants use the string-template renderer in **`src/main.js`**. Resume-backed sections (experience, projects, skills, etc.) always come from the workflow-selected resume markdown at sync time.

## Prerequisites

- **Node.js** 18, 20, 22, or 24+ (see **`engines`** in `package.json`; GitHub Actions uses **24**)
- **npm**
- active workflow config at **`config/workflow.active.json`**
- selected resume markdown and portfolio markdown files from workflow IDs
- for **local** `npm run sync`: run **`python -m tools resume build`** first so **`artifacts/<outputs.resume_pdf>`** exists (enables **`pdfAvailable`** and the hero download button). **GitHub Actions** runs that Python step before **`npm run sync`**.

## Format2 hero photo

Resolution order (see **`scripts/sync-site.mjs`**):

1. **`profilePhotoUrl`** in portfolio **frontmatter** (or non-empty **`ui_defaults`** in the portfolio format manifest) — full `https://` URL or a path under **`portfolio/public/`** (e.g. `headshot.jpg`).
2. Else, if the resume contact line has a **GitHub** link, sync calls the **GitHub API** for **`avatar_url`** and stores it with a one-time **`cb=`** query so each deploy fetches your **current** profile picture (avoids stale CDN/browser cache after you change the avatar on GitHub). If the API is unavailable, sync falls back to **`https://github.com/{username}.png`**.
3. Else the app falls back to **`local-assets/profile.png`** (gitignored, local-only) and then the **`onError`** stock image if that file is missing.

So production stays wrong only if there is **no** frontmatter URL/path, **no** GitHub link on the resume, and **no** committed image under **`public/`**.

## Commands

From **`portfolio/`**:

| Command | Purpose |
|---------|---------|
| `npm install` | Install deps (Vite) |
| `npm run sync` | Resolve workflow profile -> generate `public/<outputs.site_json>`, `public/<outputs.resume_pdf>`, and `public/workflow.runtime.json` |
| `npm run dev` | Dev server (runs `sync` first) |
| `npm run build` | Static output to `dist/` |
| `npm run preview` | Preview `dist/` |

From **repository root**:

```bash
python -m tools portfolio sync
python -m tools portfolio dev
python -m tools portfolio build
```

## Localhost

```bash
cd portfolio
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Resume download (browser)

The hero PDF link serves `public/<outputs.resume_pdf>` from the active workflow. The suggested save-as name is **`rr_resume_<timestamp>.pdf`** (`Date.now()` at click). Rebuilding that file requires **`python -m tools resume build`** and **`npm run sync`** (or **`prebuild`**) so `pdfAvailable` stays accurate.

## Tests

- **`npm run test`** – Vitest unit tests (e.g. URL handle helper).
- **`npm run validate:site`** – smoke check for workflow-selected site JSON from `public/workflow.runtime.json` (run **`npm run sync`** first).

These run in GitHub Actions on push/PR (see **`.github/workflows/portfolio.yml`**). The workflow also runs **`python -m tools resume build`** before **`npm run sync`** so the PDF and **`pdfAvailable`** are present in **`dist/`**.

## Deploy

### GitHub Pages (recommended)

1. Repo **Settings → Pages → Build and deployment**: set **Source** to **GitHub Actions** (not “Deploy from a branch”).
2. Push to **`main`**: workflow **Portfolio** builds with `GITHUB_PAGES=true` (asset base = `/<repo-name>/`), archives **`portfolio/dist/`** as a tar (including dotfiles like **`.nojekyll`**), uploads with **`actions/upload-artifact@v6`**, and **`deploy-pages`** publishes it.
3. Site URL: **`https://<your-username>.github.io/<repository-name>/`** (repository name must match the path segment; GitHub sets `GITHUB_REPOSITORY` in Actions).

**Live site looks wrong but localhost is fine:**

1. **Unpushed or non-default branch:** Deploy only runs on pushes to the repository **default branch** (`main` / `master`). Open **Actions** and confirm the latest **Portfolio** run on that branch finished **build** and **deploy** (green).
2. **Pages source:** **Settings → Pages → Source** must be **GitHub Actions**, not “Deploy from a branch” (that can serve an old tree or the repo `README`).
3. **Edge cache:** GitHub Pages serves `index.html` and JSON with **`Cache-Control: max-age=600`** at the CDN. The app appends **`?v=<commit-sha>`** to `workflow.runtime.json` and the site JSON in **CI builds** (`VITE_SITE_DATA_BUST`) so each deploy uses new URLs and avoids stale data at the edge. After pulling that change, push once so the next deploy includes it.
4. **Browser:** Hard refresh (Ctrl+Shift+R) or a private window after deploy.

Local **`npm run dev`** does not set `VITE_SITE_DATA_BUST` (URLs unchanged). Production **`npm run build`** in GitHub Actions sets it from **`github.sha`**.

**If you see the repo README instead of the portfolio:**

1. **Settings → Pages → Source** must be **GitHub Actions** (not “Deploy from a branch”). Branch-based publishing serves the repo root (`README.md`).
2. Open the latest **Portfolio** workflow run for a **push** to your **default branch** (not only a PR). Confirm **two jobs**: **`build`** and **`deploy`**. If **`deploy`** is missing or skipped, nothing was published to Pages (older branch-based site can still show).
3. Merge this repo’s workflow update (deploy runs on **default branch**, not only `main`). Or **Actions → Portfolio → Run workflow** (manual) after selecting the default branch.
4. Hard-refresh or try a private window; CDN can cache the old page briefly.

**Custom domain field:** Must be a real DNS name (e.g. `portfolio.example.com`), not a path like `user/repo`. See GitHub’s [troubleshooting custom domains](https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site/troubleshooting-custom-domains-and-github-pages#github-repository-setup-errors). To use only the default URL, leave **Custom domain** empty.

Local production-like build (same base as CI):

```bash
set GITHUB_PAGES=true
set GITHUB_REPOSITORY=yourname/your-repo
npm run build
```

(Omit those env vars for normal local dev; **`base`** stays **`./`**.)

### Other hosts

1. `npm run build` → **`portfolio/dist/`**.
2. Upload **`dist/`** to the host; CI should run **`npm ci`**, sync, test, validate, and build.

Workflow-generated files in `public/` are gitignored and must be produced by **`npm run sync`** during dev or build.

## Structure

```
portfolio/
  index.html
  vite.config.js
  package.json
  scripts/
    sync-site.mjs       # reads config/workflow.active.json -> public site JSON + workflow.runtime.json + PDF copy
    validate-site-json.mjs
  src/
    main.js             # loads runtime + site JSON; string-template UI when templateVariant is not format2; React App when format2
    format2/upstream/   # React portfolio (template_format_* with templateVariant format2)
    styles/
  public/               # generated assets (sync); not the source of profile selection
  dist/
```

## `content/portfolios/portfolio_i.md` frontmatter (optional)

If the selected portfolio content file starts with a **`---` … `---`** YAML block, those keys become `ui` fields in the generated profile site JSON. Omitted keys use built-in defaults plus selected template defaults in `scripts/sync-site.mjs`.

- **`heroTagline`**: use **`{{firstName}}`**; replaced from the first word of the selected resume content at sync.
- **`workHighlightsLede`**: optional subtitle under Work highlights; omit or leave empty to hide.
- **`footerNote`**: optional footer line; omit or leave empty to hide. If set, plain text with **backticks** for `<code>` (e.g. `` `npm run sync` ``).

Without frontmatter, sync uses the same defaults and parses the whole file as Markdown.

## `content/portfolios/portfolio_i.md` sections

After the closing `---` of frontmatter (or from the top of the file if no frontmatter), use `##` headings (case-insensitive mapping):

- **About me**
- **What I do best**
- **Impact at a glance** (or **Impact metrics**)
- **Let's connect**

Unknown `##` sections are stored under `portfolio` in generated site JSON using a derived key.

## `content/resumes/resume_i.md` Projects (stacked compact)

Under **`## Projects`**, you can list several entries without `###` between them: each entry starts with a full line

`**Name** | Subtitle or stack | Year`

followed by optional blank lines and `-` bullets. Sync splits on each such line when the chunk starts with compact format. **`## Professional Experience`** still uses `###` between roles (or the same rules apply there if you use compact stacks).

## Extending

- Add sections: extend **`sync-site.mjs`** mapping and **`main.js`** render.
- Richer MD: add a Markdown parser in sync only (keep the browser bundle small).
