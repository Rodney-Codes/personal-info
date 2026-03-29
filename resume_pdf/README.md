# Resume PDF builder

Builds **`artifacts/<outputs.resume_pdf>`** from workflow-selected **`content/resumes/<resume_content_id>.md`** using Markdown, HTML templates, CSS, and xhtml2pdf (no LaTeX).

**Design:** Content lives only under `../content/`. This folder holds the PDF-specific **presentation** (CSS, HTML shell, row templates) and the Python package under `src/resume_pdf/`.

The package is under `src/resume_pdf/`; **`.vscode/settings.json`** sets `python.analysis.extraPaths` to the workspace folder (for **`__root__`**) and **`resume_pdf/src`** (for **`resume_pdf`**).

## Layout

| Path | Role |
|------|------|
| `build.py` | Run this to build (adds `src/` to `sys.path`) |
| `build_config.json` | Paths and preprocessor flags (paths relative to this file’s directory) |
| `assets/resume.css` | PDF typography and layout |
| `assets/templates/` | HTML shell and row snippets for `@edu` / `@tech` / experience lines |
| `src/resume_pdf/` | Python: `config`, `preprocessors`, `html_service`, `pdf_service`, `build_service`, `cli` |

## Requirements

From repo root (venv activated):

```bash
pip install -r requirements.txt
```

| Package | Purpose |
|---------|---------|
| markdown | MD to HTML |
| xhtml2pdf | HTML + CSS to PDF |
| pypdf | Trim trailing blank pages |

## Usage

From repository root (central runner):

```bash
python -m tools resume build
```

Or call this package directly:

```bash
python resume_pdf/build.py
```

From this directory:

```bash
python build.py
```

### CLI overrides

```text
python resume_pdf/build.py [--config PATH] [--input MD] [--output PDF] [--css PATH]
  [--document-template PATH] [--title TEXT]
  [--no-edu-tech] [--no-experience-rows] [--no-contact-class] [--no-trim-blank-pages]
```

For arbitrary Markdown, disable resume-specific preprocessors with the `--no-*` flags.

## Configuration

See keys in **`build_config.json`**. Defaults in code mirror that file if JSON is missing.

- **`python -m tools resume build`** resolves **`content/resumes/<resume_content_id>.md`**, template paths, and **`artifacts/<outputs.resume_pdf>`** from **`config/workflow.active.json`** and **`templates/resume_formats/<resume_format_id>.json`**, unless you pass explicit CLI overrides. Switching resume or PDF template = change that config (and add files), then validate and rebuild. See **`config/README.md`**.

## Markdown conventions (resume)

- **`@edu`** / **`@tech`**: three pipe-separated fields; expanded via `assets/templates/education_row.html`
- **Experience**: `**Company** | Location | Dates` under `###` titles; expanded via `experience_row.html`

## Blank extra page

Mitigations: no `nl2br`, empty `<p>` stripped, CSS overrides for xhtml2pdf defaults, **`hr`** from `---` kept, pypdf drops trailing blank pages when `trim_trailing_blank_pages` is true.
