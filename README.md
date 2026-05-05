# personal-info

Personal content and tooling: **versioned resume/portfolio content**, **template-driven PDF resume** build, and a **Vite portfolio** site (localhost + static deploy).

## Repository layout

| Path | Purpose |
|------|---------|
| **`content/`** | Source of truth for versioned content (`content/resumes/`, `content/portfolios/`). |
| **`artifacts/`** | Generated outputs for the active profile (for example `resume.main_release.pdf`). |
| **`resume_pdf/`** | Python tool: Markdown + templates + CSS to PDF (`build.py`, `build_config.json`, `assets/`, `src/resume_pdf/`). |
| **`portfolio/`** | Vite static site; `sync` reads active workflow profile and writes profile-selected public assets. |
| **`scripts/`** | Shell helpers (e.g. venv activation). |
| **`tools/`** | Central CLI: register commands, run from repo root with `python -m tools`. |
| **`__root__/`** | Marker package: `REPO_ROOT` and `repo_root_from()` so scripts don’t guess `parents[N]`. |
| **`requirements.txt`** | Python dependencies for `resume_pdf`. |

### Directory tree (quick reference)

Omitted: generated or heavy dirs (`node_modules/`, `.venv/`, `dist/`, `.git/`, typical `__pycache__/`, gitignored sync outputs under `portfolio/public/`).

```
personal-info/
├── .github/workflows/          # CI (e.g. portfolio build + Pages deploy)
├── config/                     # workflow.active.json; config README
├── content/
│   ├── portfolios/             # versioned portfolio markdown
│   └── resumes/                # versioned resume markdown
├── docs/                       # workflow + chatbot docs
├── portfolio/                  # Vite app (see portfolio/README.md)
│   ├── public/                 # static assets (+ generated site JSON after sync)
│   ├── scripts/                # sync-site.mjs, validate-site-json.mjs
│   └── src/
│       ├── format2/            # format2 shell + upstream React UI
│       ├── lib/
│       └── styles/
├── resume_pdf/
│   ├── assets/                 # HTML/CSS templates
│   └── src/resume_pdf/         # PDF build library + CLI
├── scripts/                    # venv, ingest, index helpers
├── src/docs_chatbot_service/   # chatbot API / indexing package
├── templates/
│   ├── portfolio_formats/      # portfolio template manifests
│   └── resume_formats/         # resume format manifests
├── tests/
├── tools/
│   └── commands/               # python -m tools subcommands
├── __root__/                   # repo root resolution helper
├── AI_README.md
├── LICENSE
├── package.json                # forwards npm scripts into portfolio/
├── pyproject.toml
├── requirements.txt
└── README.md
```

## Task runner (central commands)

From the **repository root**:

```bash
python -m tools                         # list registered commands
python -m tools resume build            # same as python resume_pdf/build.py (+ optional args)
python -m tools portfolio dev           # localhost portfolio (Node/npm required)
python -m tools workflow validate-config
```

**Portfolio (npm):** One-time **`cd portfolio` then `npm install`**. After that you can run **`npm run dev`**, **`npm run build`**, or **`npm run sync`** from the **repo root** (root `package.json` forwards into `portfolio/`), or run the same scripts from **`portfolio/`**.

Add new commands by creating a module under **`tools/commands/`** and registering with **`@command(...)`** (see **`tools/commands/resume.py`**), then import that module from **`tools/commands/__init__.py`**.

## Workflow (single config drives everything)

**To switch resume content, portfolio content, resume PDF layout, or site template:** edit **`config/workflow.active.json`** only (after the new `.md` / template manifest files exist).

Supporting layout:

- **`config/workflow.active.json`** – active profile IDs and output filenames
- **`content/resumes/`**, **`content/portfolios/`** – versioned markdown
- **`templates/resume_formats/`**, **`templates/portfolio_formats/`** – JSON manifests
- Contract: **`docs/workflow.md`**

Validate after any config edit:

```bash
python -m tools workflow validate-config
```

## Supported combination matrix

Not every content/template mix gives a high-quality output. Use these combinations as the currently validated options:

| Resume content | Portfolio content | Resume format | Portfolio format | Status | Notes |
|---|---|---|---|---|---|
| `resume_1` | `portfolio_2` | `resume_format_1` | `template_format_2` | Recommended | Current production/default pairing with best visual and chatbot grounding quality. |
| `resume_1` | `portfolio_1` | `resume_format_1` | `template_format_1` | Supported | Legacy/simple layout pairing; use when you want the minimal format1 presentation. |

If you create new content/template IDs, treat them as unvalidated until you run the full checklist (`workflow validate-config`, resume build, `portfolio` sync, local smoke test).

## Python venv

- Venv lives at `.venv/`. In Cursor/VS Code, new terminals in this repo can auto-activate it.
- Manual activation (PowerShell): `.\scripts\activate_venv.ps1` from repo root.
- If PowerShell blocks scripts, run once:  
  `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

## Build resume PDF

```bash
pip install -r requirements.txt
python -m tools resume build
```

(Direct tool entry is still: `python resume_pdf/build.py`.)

Output: **`artifacts/<outputs.resume_pdf>`** from `config/workflow.active.json`.

## Chatbot (integrated frontend + external backend)

- Static index generated by: **`portfolio/scripts/sync-site.mjs`**
- API contract and rules: **`AI_README.md`**
- Integration guide: **`docs/chatbot-integration.md`**
- Standalone service repo (phase-3 split): [Rodney-Codes/docs-chatbot](https://github.com/Rodney-Codes/docs-chatbot)
- App-specific corpus/index artifacts can remain in this repo (`data/index/...`) and be loaded into the standalone chatbot service via artifact URL parameters.
- Build portfolio assets (includes chatbot index from active workflow docs):

```bash
cd portfolio && npm run sync
```

## Portfolio (localhost / deploy)

Local dev: **`cd portfolio`**, **`npm install`**, **`npm run dev`** (opens Vite, usually **http://localhost:5173**; `predev` runs **`npm run sync`**). From repo root: **`python -m tools portfolio dev`**.

**GitHub Pages:** enable **Pages → GitHub Actions** in repo settings; pushes to the default branch run **`.github/workflows/portfolio.yml`** (sync, test, validate, build, deploy). This document does not trigger deploy by itself.

## Engineering conventions

- **Single source of truth for the active bundle:** `config/workflow.active.json`.
- **Generated assets:** `portfolio/public/site.*.json`, `workflow.runtime.json`, and copied PDFs are gitignored; produce them with **`npm run sync`** (or **`predev`** / **`prebuild`**).
- **Before relying on a new combination:** `python -m tools workflow validate-config`, then resume build if you need the PDF, then sync.

## License

Open source under the **MIT License** — see **`LICENSE`**.

## CI (GitHub Actions)

Workflow **Portfolio** (on push/PR to `main`): installs Node deps, runs **`npm run sync`**, **`npm run test`**, **`npm run validate:site`**, and **`npm run build`** with the GitHub Pages asset base. On push to **`main`**, it also deploys **`portfolio/dist`** to GitHub Pages.

**Why this helps:** every change is verified before merge; **`main`** always matches a known-good build; you avoid “works on my machine” and broken deploys after a bad edit. After cloning, run **`npm ci`** locally the same way CI does when debugging failures.
