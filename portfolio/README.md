# Portfolio site

Vite static site: **`content/resume.md`** (facts) + **`content/portfolio.md`** (narrative + **YAML UI**). Output: **`public/site.json`**.

## Design

Hero + narrative sections from **`portfolio.md`**, metric-style strip, **Work highlights** (resume bullets), education + tools grid, **Let's connect** band.

## Prerequisites

- **Node.js** 18, 20, or 22+ (see **`engines`** in `package.json`; Vite 6 matches this range)
- **npm**
- **`content/resume.md`** (required), **`content/portfolio.md`** (optional but recommended)
- Optional **`artifacts/resume.pdf`** for the download button

## Commands

From **`portfolio/`**:

| Command | Purpose |
|---------|---------|
| `npm install` | Install deps (Vite) |
| `npm run sync` | `content/*.md` → `public/site.json` (+ PDF copy) |
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
- **`npm run validate:site`** – smoke check that **`public/site.json`** exists and has required fields (run **`npm run sync`** first).

These run in GitHub Actions on push/PR (see **`.github/workflows/portfolio.yml`**).

## Deploy

### GitHub Pages (recommended)

1. Repo **Settings → Pages → Build and deployment**: set **Source** to **GitHub Actions** (not “Deploy from a branch”).
2. Push to **`main`**: workflow **Portfolio** builds with `GITHUB_PAGES=true` (asset base = `/<repo-name>/`) and deploys **`portfolio/dist/`**.
3. Site URL: **`https://<your-username>.github.io/<repository-name>/`** (repository name must match the path segment; GitHub sets `GITHUB_REPOSITORY` in Actions).

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

**`public/site.json`** and **`public/resume.pdf`** are gitignored; they must be produced by **`npm run sync`** during dev or build.

## Structure

```
portfolio/
  index.html
  vite.config.js
  package.json
  scripts/
    sync-site.mjs    # resume.md + portfolio.md -> site.json; PDF copy
  src/
    main.js
    styles/main.css
  public/
  dist/
```

## `content/portfolio.md` frontmatter (optional)

If the file starts with a **`---` … `---`** YAML block, those keys become **`site.json.ui`** (hero tagline, section headings, PDF button label, document title suffix, footer). Omitted keys use built-in defaults in **`scripts/sync-site.mjs`**.

- **`heroTagline`**: use **`{{firstName}}`**; replaced from the first word of the name in **`resume.md`** at sync.
- **`footerNote`**: plain text; wrap paths or commands in **backticks** to render as `<code>` (e.g. `` `npm run sync` ``).

Without frontmatter, sync uses the same defaults and parses the whole file as Markdown (legacy).

## `content/portfolio.md` sections

After the closing `---` of frontmatter (or from the top of the file if no frontmatter), use `##` headings (case-insensitive mapping):

- **About me**
- **What I do best**
- **Impact at a glance** (or **Impact metrics**)
- **Let's connect**

Unknown `##` sections are stored in `site.json.portfolio` under a derived key.

## Extending

- Add sections: extend **`sync-site.mjs`** mapping and **`main.js`** render.
- Richer MD: add a Markdown parser in sync only (keep the browser bundle small).
