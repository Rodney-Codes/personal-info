# personal-info

Personal content and tooling: **canonical resume Markdown**, **PDF resume** build, and a **Vite portfolio** site (localhost + static deploy).

## Repository layout

| Path | Purpose |
|------|---------|
| **`content/`** | **Source of truth** for resume copy (`resume.md`). Portfolio and other apps should read from here. |
| **`artifacts/`** | Generated outputs (e.g. `resume.pdf` from the PDF builder). |
| **`resume_pdf/`** | Python tool: Markdown + templates + CSS to PDF (`build.py`, `build_config.json`, `assets/`, `src/resume_pdf/`). |
| **`portfolio/`** | Vite static site; install deps with **`npm install` inside `portfolio/`**, then **`npm run dev`** from repo root or **`python -m tools portfolio dev`** (reads `content/resume.md`). |
| **`scripts/`** | Shell helpers (e.g. venv activation). |
| **`tools/`** | Central CLI: register commands, run from repo root with `python -m tools`. |
| **`__root__/`** | Marker package: `REPO_ROOT` and `repo_root_from()` so scripts don’t guess `parents[N]`. |
| **`requirements.txt`** | Python dependencies for `resume_pdf`. |

## Task runner (central commands)

From the **repository root**:

```bash
python -m tools              # list registered commands
python -m tools resume build # same as python resume_pdf/build.py (+ optional args)
python -m tools portfolio dev   # localhost portfolio (Node/npm required)
```

**Portfolio (npm):** One-time **`cd portfolio` then `npm install`**. After that you can run **`npm run dev`**, **`npm run build`**, or **`npm run sync`** from the **repo root** (root `package.json` forwards into `portfolio/`), or run the same scripts from **`portfolio/`**.

Add new commands by creating a module under **`tools/commands/`** and registering with **`@command(...)`** (see **`tools/commands/resume.py`**), then import that module from **`tools/commands/__init__.py`**.

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

Output: **`artifacts/resume.pdf`**. Edit **`content/resume.md`** only for resume text.

Details: **`resume_pdf/README.md`**.

## Portfolio (localhost / deploy)

See **`portfolio/README.md`**: **`npm run dev`** in **`portfolio/`** or **`python -m tools portfolio dev`** from the repo root.

**GitHub Pages:** enable **Pages → GitHub Actions** in repo settings; pushes to **`main`** run **`.github/workflows/portfolio.yml`** (test, validate `site.json`, build, deploy).

## License

Open source under the **MIT License** — see **`LICENSE`**.

## CI (GitHub Actions)

Workflow **Portfolio** (on push/PR to `main`): installs Node deps, runs **`npm run sync`**, **`npm run test`**, **`npm run validate:site`**, and **`npm run build`** with the GitHub Pages asset base. On push to **`main`**, it also deploys **`portfolio/dist`** to GitHub Pages.

**Why this helps:** every change is verified before merge; **`main`** always matches a known-good build; you avoid “works on my machine” and broken deploys after a bad edit. After cloning, run **`npm ci`** locally the same way CI does when debugging failures.
