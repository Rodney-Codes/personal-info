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

## Workflow v2 scaffolding

This repository now includes a v2 workflow foundation for versioned content and templates:

- active profile: `config/workflow.active.json`
- versioned content directories:
  - `content/resumes/`
  - `content/portfolios/`
- template manifests:
  - `templates/resume_formats/`
  - `templates/portfolio_formats/`
- architecture notes: `docs/workflow-v2.md`

Run `python -m tools workflow validate-config` to resolve the active profile and verify all referenced files exist.

### Switching resume, portfolio, or template design

1. Add or edit files under `content/resumes/`, `content/portfolios/`, and/or `templates/resume_formats/`, `templates/portfolio_formats/` as needed.
2. Update **only** `config/workflow.active.json` so `resume_content_id`, `portfolio_content_id`, `resume_format_id`, and `portfolio_format_id` point at those IDs (and adjust `outputs.*` if you want separate artifact basenames).
3. Rebuild: `python -m tools resume build`, then `npm run sync` inside `portfolio/` (or `python -m tools portfolio sync` from the repo root), then `npm run build` for a production bundle.

No application code changes are required for a pure combination swap.

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

Details: **`resume_pdf/README.md`**.

## Portfolio (localhost / deploy)

See **`portfolio/README.md`**: **`npm run dev`** in **`portfolio/`** or **`python -m tools portfolio dev`** from the repo root.

**GitHub Pages:** enable **Pages → GitHub Actions** in repo settings; pushes to your **default branch** (`main` or `master`) run **`.github/workflows/portfolio.yml`** (sync, test, validate, build, deploy).

**Resume PDF on Pages:** CI runs Node `sync` only. The download button is shown when `artifacts/<outputs.resume_pdf>` exists at sync time; that file is normally produced locally with `python -m tools resume build` (Python is not installed in the current Portfolio workflow). Committing generated PDFs under `portfolio/public/` is discouraged (those paths are gitignored). To ship a PDF from CI, extend the workflow with a job that builds the PDF and runs sync afterward.

## License

Open source under the **MIT License** — see **`LICENSE`**.

## CI (GitHub Actions)

Workflow **Portfolio** (on push/PR to `main`): installs Node deps, runs **`npm run sync`**, **`npm run test`**, **`npm run validate:site`**, and **`npm run build`** with the GitHub Pages asset base. On push to **`main`**, it also deploys **`portfolio/dist`** to GitHub Pages.

**Why this helps:** every change is verified before merge; **`main`** always matches a known-good build; you avoid “works on my machine” and broken deploys after a bad edit. After cloning, run **`npm ci`** locally the same way CI does when debugging failures.
