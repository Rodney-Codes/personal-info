# personal-info

Personal content and tooling: **canonical resume Markdown**, PDF generation, and a **portfolio** placeholder for a future hosted site.

## Repository layout

| Path | Purpose |
|------|---------|
| **`content/`** | **Source of truth** for resume copy (`resume.md`). Portfolio and other apps should read from here. |
| **`artifacts/`** | Generated outputs (e.g. `resume.pdf` from the PDF builder). |
| **`resume_pdf/`** | Python tool: Markdown + templates + CSS to PDF (`build.py`, `build_config.json`, `assets/`, `src/resume_pdf/`). |
| **`portfolio/`** | Reserved for the hosted portfolio (consume `content/resume.md` at build time). |
| **`scripts/`** | Shell helpers (e.g. venv activation). |
| **`tools/`** | Central CLI: register commands, run from repo root with `python -m tools`. |
| **`__root__/`** | Marker package: `REPO_ROOT` and `repo_root_from()` so scripts don’t guess `parents[N]`. |
| **`requirements.txt`** | Python dependencies for `resume_pdf`. |

## Task runner (central commands)

From the **repository root**:

```bash
python -m tools              # list registered commands
python -m tools resume build # same as python resume_pdf/build.py (+ optional args)
```

Add new commands by creating a module under **`tools/commands/`** and registering with **`@command(...)`** in **`tools/registry.py`** style (see **`tools/commands/resume.py`**), then import that module from **`tools/commands/__init__.py`**.

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

## Next: portfolio

See **`portfolio/README.md`**. Plan: static or SSR site that imports **`content/resume.md`** (and optionally links to **`artifacts/resume.pdf`**).
