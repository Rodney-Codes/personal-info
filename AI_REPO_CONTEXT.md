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
- PDF preview association in `.vscode/settings.json` expects:
  - `"workbench.editorAssociations": { "*.pdf": "pdf.preview" }`
  - Install extension `tomoki1207.pdf` (VSCode PDF by tomoki1207), otherwise `pdf.preview` can be flagged as an invalid editor ID in Cursor/VS Code.

Quick check:

- Confirm extension is installed and enabled:
  - `code --list-extensions | rg tomoki1207.pdf`

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

The repository publishes a personal **resume PDF** and a **portfolio website** using a workflow-selected profile:

- **`config/workflow.active.json` is the single switch file** for the active combination. After adding new `content/*` or `templates/*` files, point the four `*_id` fields (and optionally `outputs.*`) at them; then `workflow validate-config`, `resume build`, and `portfolio sync`. Human checklist: **`config/README.md`**.
- Resume content: `content/resumes/<resume_content_id>.md`.
- Portfolio narrative: `content/portfolios/<portfolio_content_id>.md`.
- Resume PDF presentation: `templates/resume_formats/<resume_format_id>.json` (paths into `resume_pdf/` assets).
- Site template defaults: `templates/portfolio_formats/<portfolio_format_id>.json` (includes `templateVariant`, e.g. `format2` for the React app).

From these sources, the repo generates:

1. **Resume PDF**: selected resume markdown -> `artifacts/<outputs.resume_pdf>` via `resume_pdf/`
2. **Portfolio site data**: selected resume + portfolio markdown -> `portfolio/public/<outputs.site_json>` via `portfolio/scripts/sync-site.mjs`
3. **Runtime metadata**: `portfolio/public/workflow.runtime.json` points the frontend to selected site/pdf files.
4. **Static site build**: `portfolio/` consumes runtime metadata + selected site JSON during browser render and deploy.

The intent is composable profile-driven publishing for resume + portfolio variants, with CI verification for the selected active profile.

## 2. Key directories (mental model)

Repository root:

- `config/`
  - **`workflow.active.json`**: only file required to change the active resume/portfolio/template combination (see **`config/README.md`**).
- `content/`
  - Versioned source content (`resumes/`, `portfolios/`).
- `templates/`
  - Resume and portfolio format manifests selected by workflow profile.
- `resume_pdf/`
  - Python toolchain to convert selected resume markdown into a profile PDF.
- `artifacts/`
  - Generated outputs for selected profile (`resume`, `build manifest`, etc.).
- `portfolio/`
  - Vite (Node) static site.
  - `npm run sync` generates profile-selected site/pdf assets and `public/workflow.runtime.json`.
  - Browser UI reads runtime metadata and then fetches the selected site JSON.
- `tools/`
  - Python “central CLI” that registers commands and forwards to `resume_pdf/` and `portfolio/`.
- `__root__/`
  - Helper to locate repository root robustly from any file.

## 3. Canonical content contracts

### 3.1 `content/resumes/<resume_content_id>.md` (selected resume facts)

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

### 3.2 `content/portfolios/<portfolio_content_id>.md` (selected site narrative + UI labels)

This file is parsed as:

- Optional YAML frontmatter block at the top:
  - delimited by `---` ... `---`
  - keys become `ui.*` fields in generated selected site JSON (labels, headings, hero tagline, footer note, etc.)
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

- `artifacts/<outputs.resume_pdf>` from `config/workflow.active.json`

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

- `portfolio/public/<outputs.site_json>` (profile-selected main site data contract)
- `portfolio/public/<outputs.resume_pdf>` (copied from `artifacts/<outputs.resume_pdf>` if it exists)
- `portfolio/public/workflow.runtime.json` (runtime selector for site/pdf filenames)

High-level flow (`portfolio/scripts/sync-site.mjs`):

1. Resolve active profile from `config/workflow.active.json`
   - compute selected resume content, portfolio content, portfolio format, and output paths
2. Read selected resume markdown (`content/resumes/<resume_content_id>.md`)
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
3. Read selected portfolio format (`templates/portfolio_formats/<portfolio_format_id>.json`)
   - merge `ui_defaults` into base UI defaults
   - merge `section_mapping` into section key mapping
4. Read selected portfolio markdown (`content/portfolios/<portfolio_content_id>.md`):
   - optional YAML frontmatter:
     - parsed via the `yaml` package
     - merged onto `DEFAULT_PORTFOLIO_UI`
   - sections:
     - parsed by `## ...` headings and mapped into content keys
5. Build `site` JSON object:
   - `meta.title` = `${name} | ${ui.metaTitleSuffix}`
   - `meta.description` = summary truncated to 160 chars
   - `ui` = merged UI labels (frontmatter overrides defaults)
   - `contact` = parsed contact fields
   - `experience` and `projects` = parsed arrays from resume
   - `education` and `skills` = parsed arrays
   - `pdfAvailable` = boolean set by existence of `artifacts/<outputs.resume_pdf>`
6. Write:
   - `portfolio/public/<outputs.site_json>`
7. Optional:
   - if `artifacts/<outputs.resume_pdf>` exists:
     - copy it to `portfolio/public/<outputs.resume_pdf>`
8. Write runtime selector:
   - `portfolio/public/workflow.runtime.json`
   - includes `selected`: `{ resume_content_id, portfolio_content_id, resume_format_id, portfolio_format_id }` for traceability (and optional UI tooltips)

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

Entry: **`portfolio/src/main.js`**.

- Loads **`public/workflow.runtime.json`** (`cache: "no-store"`), then the site file named by **`site_json_file`**.
- Passes `{ data, runtime }` into the renderer where `runtime` includes at least **`pdfFile`** (from `resume_pdf_file` in JSON) and optional **`selected`** (workflow IDs).

**`templateVariant`** (from generated `data.ui.templateVariant`, driven by the active portfolio format manifest):

- **`format2`**: dynamically imports **`./format2/upstream/App.tsx`** (React) and mounts it with `{ data, runtime }`. Hero CTAs include mailto, LinkedIn, and a resume download when `data.pdfAvailable` is true. The download anchor sets `download` to **`rr_resume_<Date.now()>.pdf`** on click (suggested filename only; href still points at `public/<outputs.resume_pdf>`).
- **Other `templateVariant` values**: HTML string templates in `main.js` (default `format1`). PDF link uses the same suggested filename pattern via inline `onclick`.

Shared helpers on the string-template path:

- `renderMarkdownBlock`, `renderImpactStrip`, etc.
- **`portfolio/src/lib/profileHandleFromUrl.js`**: URL to display handle; covered by **`portfolio/src/lib/profileHandleFromUrl.test.js`** (Vitest).

## 5. Data contracts: runtime JSON vs selected site JSON

### 5.1 `portfolio/public/workflow.runtime.json` (generated)

Produced by **`portfolio/scripts/sync-site.mjs`**. Consumed by **`main.js`** and **`validate-site-json.mjs`** (to find the site file).

| Field | Type | Purpose |
|-------|------|---------|
| `profile_id` | string | Profile label from workflow config |
| `site_json_file` | string | Basename of generated site JSON under `public/` |
| `resume_pdf_file` | string | Basename of PDF under `public/` (copy of artifact when present) |
| `generated_at_utc` | string | ISO timestamp |
| `selected` | object | Echo of `resume_content_id`, `portfolio_content_id`, `resume_format_id`, `portfolio_format_id` |

The in-memory object passed to React uses **`pdfFile`** (not `resume_pdf_file`); **`main.js`** maps this when calling `loadData()`.

### 5.2 Selected site JSON (`portfolio/public/<outputs.site_json>`)

| Field | Notes |
|-------|--------|
| `meta` | `title`, `description` |
| `name` | From resume `#` line |
| `ui` | Merged defaults + portfolio format + frontmatter; includes `templateVariant`, `heroTagline`, `pdfButton`, etc. |
| `contact` | `phone`, `email`, `linkedin`, `github`, `portfolio` (shaped objects where applicable) |
| `summary` | Professional summary text |
| `portfolio` | Narrative sections from portfolio markdown |
| `experience`, `projects` | Parsed from resume |
| `education`, `skills` | Parsed from resume |
| `pdfAvailable` | `true` if `artifacts/<outputs.resume_pdf>` existed at sync time |

**Light validation** (`validate-site-json.mjs`): non-empty `name`, `ui.heroTagline`, array `experience`, object `contact`, `meta.title`. It reads **`workflow.runtime.json`** only to locate the site file.

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
  - verifies build output files and inspects runtime-selected site JSON fields in `dist/`
- `deploy`
  - runs after `build`
  - uses `actions/deploy-pages@v4`

Note:

- The **Portfolio** workflow runs **`python -m tools resume build`** before **`npm run sync`**, so `artifacts/<outputs.resume_pdf>` exists in CI and `pdfAvailable` is true when the build succeeds. The download button requires that PDF plus `runtime.pdfFile` in the client.

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

1. Edit selected `content/resumes/<resume_content_id>.md` for resume text and structured lines.
2. If you change how a pattern is parsed, update the corresponding preprocessor and template.
3. Validate by running:
   - `python -m tools resume build`

### 7.3 Change portfolio site sections / UI strings

Update selected `content/portfolios/<portfolio_content_id>.md` for narrative and YAML UI label changes.

To add new section support end-to-end:

1. Update `portfolio/scripts/sync-site.mjs`:
   - add a mapping in `PORTFOLIO_SECTION_KEYS` if it should map to a known key
   - ensure the generated selected site JSON shape includes it
2. Update `portfolio/src/main.js`:
   - add rendering logic for the new `site.portfolio.<key>` field
3. Optionally update `portfolio/scripts/validate-site-json.mjs`:
   - add stronger schema checks if you rely on new fields.

### 7.4 Change selected site JSON schema

Treat `portfolio/scripts/sync-site.mjs` as the contract author:

- Any schema changes should be mirrored in:
  - `portfolio/src/main.js` (rendering)
  - `portfolio/scripts/validate-site-json.mjs` (validation)

## 8. Quick “where to look” index

- **Switch active resume/portfolio/template:** `config/workflow.active.json` + **`config/README.md`**
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
  - `portfolio/src/main.js` (loader + string-template formats)
  - `portfolio/src/format2/upstream/App.tsx` (React UI when `templateVariant` is `format2`)
  - `portfolio/src/styles/main.css`

## 9. Known gotchas (operational risks)

1. **Profile selection is not edited in `portfolio/public/`.** Change **`config/workflow.active.json`**, then validate, resume build (for PDF), and sync. See **`config/README.md`**.
2. `portfolio/public/workflow.runtime.json` and profile-selected site JSON are generated; if you edit selected content/template files, you must run `npm run sync` (or `python -m tools portfolio sync`).
3. GitHub Pages deploy caching can make the site appear “stuck”; the front-end fetches runtime metadata and selected site JSON with `cache: "no-store"`, but browsers/CDNs can still cache other assets.
4. Resume PDF generation depends on Python packages:
   - `markdown`, `xhtml2pdf`, `pypdf` (see `requirements.txt`)
5. xhtml2pdf is sensitive to HTML structure and CSS:
   - preprocessors exist to transform structured lines into stable HTML row/table markup.

