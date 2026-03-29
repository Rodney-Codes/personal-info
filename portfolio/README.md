# Portfolio site

Vite static site driven by **`config/workflow.active.json`** selections:
- resume content from `content/resumes/<resume_content_id>.md`
- portfolio content from `content/portfolios/<portfolio_content_id>.md`
- portfolio format from `templates/portfolio_formats/<portfolio_format_id>.json`
- output files in `public/` from `outputs.*` plus `workflow.runtime.json`

## Design

- **Format 1** (`ui.templateVariant` omitted or not `format2`): string-template site rendered from `src/main.js` (hero, narrative sections from selected portfolio markdown, metrics, work highlights from resume, education/skills, connect band).
- **Format 2** (`ui.templateVariant: "format2"` from the selected `templates/portfolio_formats/*.json`): React UI in `src/format2/upstream/App.tsx`, driven by the same generated site JSON + `workflow.runtime.json`.

Static assets (e.g. tech logos under `public/*.png`) are served with the app; profile photos can live in `public/local-assets/` (gitignored) for local builds.

## Prerequisites

- **Node.js** 18, 20, 22, or 24+ (see **`engines`** in `package.json`; GitHub Actions uses **24**)
- **npm**
- active workflow config at **`config/workflow.active.json`**
- selected resume markdown and portfolio markdown files from workflow IDs
- selected resume PDF in **`artifacts/<outputs.resume_pdf>`** for the download button

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

## Tests

- **`npm run test`** – Vitest unit tests (e.g. URL handle helper).
- **`npm run validate:site`** – smoke check for workflow-selected site JSON from `public/workflow.runtime.json` (run **`npm run sync`** first).

These run in GitHub Actions on push/PR (see **`.github/workflows/portfolio.yml`**).

## Deploy

### GitHub Pages (recommended)

1. Repo **Settings → Pages → Build and deployment**: set **Source** to **GitHub Actions** (not “Deploy from a branch”).
2. Push to **`main`**: workflow **Portfolio** builds with `GITHUB_PAGES=true` (asset base = `/<repo-name>/`), archives **`portfolio/dist/`** as a tar (including dotfiles like **`.nojekyll`**), uploads with **`actions/upload-artifact@v6`**, and **`deploy-pages`** publishes it.
3. Site URL: **`https://<your-username>.github.io/<repository-name>/`** (repository name must match the path segment; GitHub sets `GITHUB_REPOSITORY` in Actions).

**Live site looks wrong but localhost is fine:** GitHub Pages and browsers often cache generated JSON assets. The app loads `workflow.runtime.json` and selected site data with **`cache: no-store`**, but you may still need a **hard refresh** (Ctrl+Shift+R) or a short wait after deploy. Confirm **Actions** ran **deploy** on your default branch and open the site in a private window.

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
    sync-site.mjs    # workflow-selected content -> profile site data + runtime metadata
  src/
    main.js
    styles/main.css
  public/
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
