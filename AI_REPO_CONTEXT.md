# personal-info (AI Repo Context)

This document is designed so you can give it to another AI model to reliably understand:
1) what this repository does,
2) how data flows end-to-end,
3) what parsing conventions are used,
4) what files/configurations are the source of truth, and
5) where to change things without breaking the pipeline.

## 0. Repo setup requirements (for AI + humans)

An AI agent should confirm environment setup before running build or validation commands.

### 0.1 Python requirements

- Use a **local virtual environment** only:
  - venv path: `.venv/`
  - expected interpreter path on Windows: `.venv/Scripts/python.exe`
- Recommended Python version:
  - `3.11` (matches `pyrightconfig.json` and editor settings)
- Python dependencies:
  - install from `requirements.txt`
  - packages: `markdown`, `xhtml2pdf`, `pypdf`

Setup:

1. Create venv (if missing):
   - `python -m venv .venv`
2. Activate (PowerShell):
   - `.\\scripts\\activate_venv.ps1`
3. Install Python deps:
   - `pip install -r requirements.txt`

Quick checks:

- `python --version` (expect Python 3.11.x)
- `python -c "import markdown, xhtml2pdf, pypdf; print('python deps ok')"`

### 0.2 Node.js / npm requirements

- Node is required for `portfolio/`.
- Version range (from `portfolio/package.json` engines):
  - `^18.0.0 || ^20.0.0 || >=22.0.0`
- CI uses Node `24` (`.github/workflows/portfolio.yml`), so Node 24 is the safest match.
- npm is required (bundled with Node).

Setup:

1. Install a supported Node version (prefer 24).
2. Install portfolio dependencies:
   - `cd portfolio`
   - `npm install`

Quick checks:

- `node -v`
- `npm -v`
- `cd portfolio && npm run sync`
- `cd portfolio && npm run test`

### 0.3 VS Code/Cursor expectations

- `.vscode/settings.json` points default Python interpreter to:
  - `${workspaceFolder}/.venv/Scripts/python.exe`
- `python.terminal.activateEnvironment` is enabled.
- `python.analysis.extraPaths` includes:
  - `${workspaceFolder}`
  - `${workspaceFolder}/resume_pdf/src`

### 0.4 Minimal bootstrap command sequence

From repo root:

1. Python side:
   - `python -m venv .venv`
   - `.\\scripts\\activate_venv.ps1`
   - `pip install -r requirements.txt`
2. Node side:
   - `cd portfolio`
   - `npm install`
3. Validate setup:
   - `cd ..`
   - `python -m tools resume build`
   - `python -m tools portfolio sync`
   - `python -m tools portfolio build`

## 1. What this repo is trying to do

The repository publishes a personal **resume PDF** and a **portfolio website** using a single set of canonical Markdown sources:

- `content/resume.md` is the canonical resume content (facts + structured fields).
- `content/portfolio.md` is portfolio-only narrative and UI labels.

From these sources, the repo generates:

1. **Resume PDF**: `content/resume.md` -> `artifacts/resume.pdf` via `resume_pdf/`
2. **Portfolio site data**: `content/resume.md` + `content/portfolio.md` -> `portfolio/public/site.json` via `portfolio/scripts/sync-site.mjs`
3. **Static site build**: `portfolio/` consumes `public/site.json` to render UI in the browser and during GitHub Pages deploy.

The intent is “one source for resume + portfolio”, with light automation and CI verification for the portfolio build.

## 2. Key directories (mental model)

Repository root:

- `content/`
  - Source of truth for resume and portfolio narrative.
- `resume_pdf/`
  - Python toolchain to convert `content/resume.md` into a PDF.
- `artifacts/`
  - Generated outputs (notably `artifacts/resume.pdf`).
- `portfolio/`
  - Vite (Node) static site.
  - `npm run sync` generates `portfolio/public/site.json` from `content/*.md`.
  - Browser UI renders `public/site.json` and serves an optional `public/resume.pdf`.
- `tools/`
  - Python “central CLI” that registers commands and forwards to `resume_pdf/` and `portfolio/`.
- `__root__/`
  - Helper to locate repository root robustly from any file.

## 3. Canonical content contracts

### 3.1 `content/resume.md` (canonical resume facts)

This file is expected to follow a specific Markdown shape; multiple parts of the codebase parse it via regex and conventions.

Minimum expectations:

- First line is the name, formatted as Markdown heading: `# Rohit Raj`
- Next non-empty line after the name is a single-line “contact line”:
  - phone text and Markdown links separated by `|`
  - example:
    - `(+91) 9431730420 | [email](mailto:...) | [LinkedIn](https://...) | [GitHub](https://...) | [Portfolio](https://...)`
- Then sections are defined by Markdown headings: `## Professional Summary`, `## Professional Experience`, `## Projects`, `## Education`, `## Technical Skills`, etc.
- Section contents are separated by `## ...` headers.
- Horizontal rules/dividers may be represented as Markdown `---`; portfolio sync removes those within extracted sections.

Resume-specific structured lines:

1. Education and skills rows:
   - `@edu <school> | <detail> | <year>`
   - `@tech <label> | <value>`

2. Experience and “company/location/dates” rows (used by the resume PDF builder):
   - A single line matching: `**Company** | Location | Dates`
   - Note: this is line-level parsing. For this to work, that row must appear as a single Markdown line in the final Markdown text.

3. Experience and projects chunk conventions (used by portfolio sync):
   - Portfolio sync interprets the **Professional Experience** and **Projects** sections using a “split on `###` headings” strategy and supports multiple layouts:
     - “Classic”:
       - A role title line starting with `### ...`
       - Then a triple-meta line: `**Org** | <Location> | <Dates>`
       - Then `-` bullets
     - “Compact” (used for Projects):
       - No `###` between projects
       - Each project starts with a full-line triple-meta row: `**Name** | <Subtitle/stack> | <Year>`
       - Then `-` bullets
     - “Stacked compact”:
       - Multiple `**Name** | ... | <Year>` blocks in one section separated by blank lines.

### 3.2 `content/portfolio.md` (site narrative + UI labels)

This file is parsed as:

- Optional YAML frontmatter block at the top:
  - delimited by `---` ... `---`
  - keys become `site.json.ui.*` (labels, headings, hero tagline, footer note, etc.)
- Then Markdown sections defined by `## Heading`.

The sync script maps certain `## ...` headings (case-insensitive) to fixed JSON keys:

- `## About me` -> `aboutMe`
- `## What I do best` -> `whatIDoBest`
- `## Impact at a glance` / `## Impact metrics` -> `impactAtAGlance`
- `## Work highlights` -> used as the “Work highlights” heading in the UI
- `## Projects` -> `projects` heading area (not the data; data comes from resume experience parsing)
- `## Let's connect` -> `letsConnect`

Unknown `## ...` headings are stored under a derived key:
 - lowercased
 - whitespace to `_`
 - stripped to `[a-zA-Z0-9_]`

## 4. Data pipeline details

### 4.1 Resume PDF pipeline (`resume_pdf/`)

Entry points:

- Recommended (repo-root): `python -m tools resume build`
- Direct: `python resume_pdf/build.py`

Output:

- `artifacts/resume.pdf`

High-level flow (implementation is in `resume_pdf/src/resume_pdf/build_service.py`):

1. **Load config**
   - `resume_pdf/build_config.json` defines defaults (input MD path, output PDF path, which templates to use).
   - CLI arguments can override config paths and toggle preprocessors.
2. **Optional preprocessors** (resume-specific)
   - `preprocessors.preprocess_edu_and_tech_rows(...)`
     - Replaces lines like:
       - `@edu ...` and `@tech ...`
     - with HTML table row snippets from:
       - `resume_pdf/assets/templates/education_row.html`
       - `resume_pdf/assets/templates/education_row.html` expects placeholders `{{school}}`, `{{detail}}`, `{{year}}`
       - `resume_pdf/assets/templates/experience_row.html` expects placeholders `{{company}}`, `{{location}}`, `{{dates}}`
   - `preprocessors.preprocess_experience_rows(...)`
     - Replaces lines matching exactly the “experience meta” pattern:
       - `**Company** | Location | Dates`
     - by injecting `experience_row.html` rows.
3. **Markdown -> HTML**
   - Uses the Python `markdown` package:
     - `markdown.markdown(md_text, extensions=["extra"], output_format="html")`
4. **Inject semantic CSS hooks**
   - `apply_resume_semantic_classes(html_body)`:
     - adds `class="resume-contact"` to the first `<p>` after the first `<h1>`.
5. **Sanitize HTML for PDF layout stability**
   - `sanitize_html_for_pdf(...)`:
     - strips empty `<p>` blocks
     - compresses excessive `<br>` sequences
     - trims trailing empty blocks to reduce blank pages.
6. **Render the final HTML shell**
   - `render_document_html(...)` fills placeholders in:
     - `resume_pdf/assets/templates/document.html`
     - placeholders:
       - `__RESUME_DOCUMENT_TITLE__`
       - `__RESUME_DOCUMENT_STYLES__` (from `assets/resume.css`)
       - `__RESUME_DOCUMENT_BODY__`
7. **HTML -> PDF bytes**
   - `xhtml2pdf.pisa.CreatePDF(html_doc, dest=buf, encoding="utf-8")`
8. **Optional blank-page trimming**
   - `trim_trailing_blank_pages(...)` uses `pypdf`:
     - extracts text from trailing pages
     - removes trailing pages with no extracted text
9. **Write output**
   - ensures parent directory exists and writes bytes to `output_pdf`.

Important implementation notes:

- Preprocessors are line-level regex transforms that run **before** Markdown parsing.
- `markdown` then produces HTML, which must be compatible with xhtml2pdf CSS/layout expectations.
- Blank-page issues are mitigated via both:
  - HTML sanitization (removing empty `<p>`)
  - optional PDF trimming (pypdf text extraction).

### 4.2 Portfolio + site data pipeline (`portfolio/`)

Entry points:

- Generate JSON + optional PDF copy:
  - `npm run sync` (from inside `portfolio/`)
  - or `python -m tools portfolio sync` (repo root)
- Dev server:
  - `npm run dev` (sync runs first via `predev`)
- CI/build:
  - `npm run build` (sync runs first via `prebuild`)

Output artifacts:

- `portfolio/public/site.json` (main data contract for the front-end)
- `portfolio/public/resume.pdf` (copied from `artifacts/resume.pdf` if it exists)

High-level flow (`portfolio/scripts/sync-site.mjs`):

1. Read `content/resume.md`
   - Extract `name` from the first line (`# ...`)
   - Extract `contactLine` from the next non-empty line
   - Extract sections by regex matching `^## (.+)$`
   - Remove `---` dividers within each section body.
2. Parse resume fields into structured arrays:
   - Summary:
     - looks up section `Professional Summary`
     - collapses newlines into spaces
   - Experience/project:
     - `parseExperience(body)`:
       - splits on `### ` job headings
       - supports both “classic” and “compact triple meta” formats
   - Education:
     - `@edu` lines produce `{ school, detail, year }`
   - Skills/tools:
     - `@tech` lines produce `{ label, value }`
3. Read `content/portfolio.md`:
   - optional YAML frontmatter:
     - parsed via the `yaml` package
     - merged onto `DEFAULT_PORTFOLIO_UI`
   - sections:
     - parsed by `## ...` headings and mapped into content keys
4. Build `site` JSON object:
   - `meta.title` = `${name} | ${ui.metaTitleSuffix}`
   - `meta.description` = summary truncated to 160 chars
   - `ui` = merged UI labels (frontmatter overrides defaults)
   - `contact` = parsed contact fields
   - `experience` and `projects` = parsed arrays from resume
   - `education` and `skills` = parsed arrays
   - `pdfAvailable` = boolean set by existence of `artifacts/resume.pdf`
5. Write:
   - `portfolio/public/site.json`
6. Optional:
   - if `artifacts/resume.pdf` exists:
     - copy it to `portfolio/public/resume.pdf`

Contact line parsing details (`parseContactLine(line)`):

- Splits by `|`
- For each segment:
  - if it matches a Markdown link `[...] (...)`:
    - chooses field by checking link text (lowercased) contains:
      - `mail` -> email
      - `linkedin` -> linkedin
      - `github` -> github
      - `portfolio` -> portfolio
  - else, if non-empty and not starting with `[`:
    - treated as phone text (concatenated with ` | ` when multiple segments exist)

### 4.3 Front-end rendering (`portfolio/src/`)

The browser loads `public/site.json` in `portfolio/src/main.js`:

- It determines base path from `import.meta.env.BASE_URL`
- Fetches `${base}site.json` with `cache: "no-store"` to avoid stale data after deploy
- Renders UI using pure string templates:
  - header (name, eyebrow, hero tagline)
  - optionally shows a PDF download button when `data.pdfAvailable === true`
  - renders experience cards from `data.experience`
  - renders projects from `data.projects`
  - renders education from `data.education`
  - renders skills from `data.skills`
  - optionally renders portfolio narrative sections from `data.portfolio.*`
  - optionally renders footer note with inline code spans for backticks

Component-ish render helpers:

- `renderMarkdownBlock(text)`:
  - splits on blank lines
  - if every trimmed line starts with `- `, renders as a `<ul>`
  - else renders as paragraphs (with `**bold**` converted to `<strong>`)
- `renderImpactStrip(text)`:
  - if `text` contains `-` bullet lines, converts them into “metric pills”

PDF download link:

- When `pdfAvailable` is true:
  - `<a href="${BASE_URL}resume.pdf" download>...</a>`

Profile handle helper (`portfolio/src/lib/profileHandleFromUrl.js`):

- Given a URL, strips `?query` / `#hash` and trailing slashes
- Returns the last path segment (used for LinkedIn/GitHub display text)

Test:

- `portfolio/src/lib/profileHandleFromUrl.test.js` uses Vitest.

## 5. Data contract: `portfolio/public/site.json`

This file is generated by `portfolio/scripts/sync-site.mjs` and validated lightly by `portfolio/scripts/validate-site-json.mjs`.

Expected top-level fields (based on generator + renderer):

- `meta`
  - `title` (string)
  - `description` (string)
- `name` (string)
- `ui` (object)
  - includes UI strings such as `heroTagline`, `metaTitleSuffix`, `aboutMeHeading`, etc.
- `contact`
  - `phone` (string)
  - `email` = `{ text: string, href: string }`
  - `linkedin` = `{ text: string, href: string }`
  - `github` = `{ text: string, href: string }`
  - `portfolio` = `{ text: string, href: string }`
- `summary` (string)
- `portfolio` (object)
  - keys depend on `content/portfolio.md` headings, e.g. `aboutMe`, `letsConnect`, etc.
- `experience` (array)
  - items: `{ title, company, location, dates, bullets, displayTitle }`
- `projects` (array)
  - items: same structure as experience items
- `education` (array)
  - items: `{ school, detail, year }`
- `skills` (array)
  - items: `{ label, value }`
- `pdfAvailable` (boolean)

Light validation:

- `validate-site-json.mjs` checks:
  - `name` non-empty string
  - `ui` exists and `ui.heroTagline` non-empty
  - `experience` is an array
  - `contact` and `meta.title` exist with expected types

## 6. Running the repo locally (runbook)

### 6.1 Python venv

Venv lives at `.venv/`.

PowerShell activation:

- `.\\scripts\\activate_venv.ps1`

### 6.2 Resume PDF build

From repo root (with venv activated):

- `pip install -r requirements.txt`
- `python -m tools resume build`

Direct:

- `python resume_pdf/build.py`

### 6.3 Portfolio dev / build

From repo root:

- `python -m tools portfolio dev`
- `python -m tools portfolio build`
- `python -m tools portfolio sync`

Or from `portfolio/`:

- `npm install`
- `npm run dev`
- `npm run sync`
- `npm run build`

### 6.4 CI behavior (GitHub Actions)

Workflow: `.github/workflows/portfolio.yml`

Jobs:

- `build`
  - checks out code
  - installs Node 24
  - runs `npm ci`
  - runs:
    - `npm run sync`
    - `npm run test`
    - `npm run validate:site`
    - `npm run build`
  - archives `portfolio/dist` as an artifact
  - verifies build output files and inspects `dist/site.json` lengths
- `deploy`
  - runs after `build`
  - uses `actions/deploy-pages@v4`

Note:

- The CI workflow does not run the Python resume PDF generator. The PDF download button depends on whether `artifacts/resume.pdf` exists at sync time (`pdfAvailable`).

## 7. Extension points (how to add features safely)

### 7.1 Add a new central CLI command

Follow the pattern in `tools/`:

- Create a new module under `tools/commands/`
- Register a handler with `@command(...)` from `tools/registry.py`
- Import the module in `tools/commands/__init__.py` so registrations run at `python -m tools` startup.

### 7.2 Change resume PDF layout or parsing

Most resume PDF behavior is controlled by:

- `resume_pdf/src/resume_pdf/preprocessors.py`
  - regex patterns and HTML row injection
- `resume_pdf/assets/templates/*.html`
  - table row templates used for education/experience
- `resume_pdf/assets/resume.css`
  - xhtml2pdf layout and margins
- `resume_pdf/src/resume_pdf/build_service.py`
  - end-to-end orchestration

Recommended strategy for modifications:

1. Edit `content/resume.md` only for resume text and structured lines.
2. If you change how a pattern is parsed, update the corresponding preprocessor and template.
3. Validate by running:
   - `python -m tools resume build`

### 7.3 Change portfolio site sections / UI strings

Update `content/portfolio.md` for narrative and YAML UI label changes.

To add new section support end-to-end:

1. Update `portfolio/scripts/sync-site.mjs`:
   - add a mapping in `PORTFOLIO_SECTION_KEYS` if it should map to a known key
   - ensure the generated `site.json` shape includes it
2. Update `portfolio/src/main.js`:
   - add rendering logic for the new `site.json.portfolio.<key>` field
3. Optionally update `portfolio/scripts/validate-site-json.mjs`:
   - add stronger schema checks if you rely on new fields.

### 7.4 Change `site.json` schema

Treat `portfolio/scripts/sync-site.mjs` as the contract author:

- Any schema changes should be mirrored in:
  - `portfolio/src/main.js` (rendering)
  - `portfolio/scripts/validate-site-json.mjs` (validation)

## 8. Quick “where to look” index

- Repo entrypoint CLI:
  - `tools/__main__.py`, `tools/cli.py`, `tools/registry.py`
- Resume PDF builder:
  - `resume_pdf/build.py`
  - `resume_pdf/src/resume_pdf/build_service.py`
  - `resume_pdf/src/resume_pdf/preprocessors.py`
  - `resume_pdf/src/resume_pdf/html_service.py`
  - `resume_pdf/src/resume_pdf/pdf_service.py`
- Portfolio sync generator:
  - `portfolio/scripts/sync-site.mjs`
- Portfolio smoke validation:
  - `portfolio/scripts/validate-site-json.mjs`
- Portfolio Vite app:
  - `portfolio/src/main.js`
  - `portfolio/src/styles/main.css`

## 9. Known gotchas (operational risks)

1. `portfolio/public/site.json` is generated; if you edit `content/*.md`, you must run `npm run sync` (or `python -m tools portfolio sync`).
2. GitHub Pages deploy caching can make the site appear “stuck”; the front-end fetches `site.json` with `cache: "no-store"`, but browsers/CDNs can still cache other assets.
3. Resume PDF generation depends on Python packages:
   - `markdown`, `xhtml2pdf`, `pypdf` (see `requirements.txt`)
4. xhtml2pdf is sensitive to HTML structure and CSS:
   - preprocessors exist to transform structured lines into stable HTML row/table markup.

