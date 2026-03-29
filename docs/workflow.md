# Workflow (versioned content + template composition)

## Goal

Composable publishing pipeline:

- choose one resume content version
- choose one portfolio content version
- choose one resume format template
- choose one portfolio format template
- build a resolved release profile with explicit artifact names

All of this is driven by **`config/workflow.active.json`**. See **`config/README.md`** for the operational checklist.

## Directory contract

```text
config/
  workflow.active.json

content/
  resumes/
    resume_i.md
  portfolios/
    portfolio_i.md

templates/
  resume_formats/
    resume_format_i.json
  portfolio_formats/
    template_format_i.json
```

## Active profile contract

File: `config/workflow.active.json`

```json
{
  "profile_id": "main_release",
  "resume_content_id": "resume_1",
  "portfolio_content_id": "portfolio_1",
  "resume_format_id": "resume_format_1",
  "portfolio_format_id": "template_format_1",
  "outputs": {
    "site_json": "site.main_release.json",
    "resume_pdf": "resume.main_release.pdf",
    "build_manifest": "build.main_release.json"
  }
}
```

Rules:

- IDs are filesystem keys, not free text.
- Use integer progression naming:
  - `resume_i`, `portfolio_i`, `resume_format_i`, `template_format_i`
  - where `i` is a positive integer version index (`1, 2, 3, ...`).
- IDs map to strict paths:
  - `resume_content_id` -> `content/resumes/<id>.md`
  - `portfolio_content_id` -> `content/portfolios/<id>.md`
  - `resume_format_id` -> `templates/resume_formats/<id>.json`
  - `portfolio_format_id` -> `templates/portfolio_formats/<id>.json`
- `outputs.*` values are file names only (no nested paths).

## Template manifest shape

Resume template manifest (`templates/resume_formats/<id>.json`):

```json
{
  "id": "resume_format_1",
  "document_title": "Resume",
  "css_path": "resume_pdf/assets/resume.css",
  "document_template_path": "resume_pdf/assets/templates/document.html",
  "row_templates": {
    "education": "resume_pdf/assets/templates/education_row.html",
    "experience": "resume_pdf/assets/templates/experience_row.html"
  },
  "section_types": {
    "Professional Summary": "prose",
    "Professional Experience": "timeline",
    "Projects": "timeline",
    "Education": "edu_rows",
    "Technical Skills": "tech_rows"
  }
}
```

Portfolio template manifest (`templates/portfolio_formats/<id>.json`):

```json
{
  "id": "template_format_1",
  "renderer": "portfolio_vite",
  "ui_defaults": {
    "heroTagline": "Hi, I'm {{firstName}}.",
    "projectsHeading": "Projects"
  },
  "section_mapping": {
    "About me": "aboutMe",
    "Let's connect": "letsConnect"
  }
}
```

## Build manifest (required output)

Each run emits `artifacts/<outputs.build_manifest>` with:

- selected IDs
- resolved source/template file paths
- generated artifact paths
- UTC timestamp

This supports traceability when verifying which combination was built.

## Implemented in this repository

- Active profile config and validator: `python -m tools workflow validate-config`
- Resume PDF build resolves content and templates from the active profile (`python -m tools resume build`)
- Portfolio sync writes profile-selected site JSON, runtime metadata, and PDF copy (`npm run sync` in `portfolio/`)
- CI builds and validates the selected site output (see `.github/workflows/portfolio.yml`)

## Out of scope

- arbitrary unmanaged file layouts
- every historical markdown convention
- runtime template auto-discovery

## Operations: switching the active combination

1. Add or reuse content under **`content/resumes/`** and **`content/portfolios/`** and manifests under **`templates/resume_formats/`** and **`templates/portfolio_formats/`** using stable IDs (e.g. `resume_2`, `portfolio_3`, `resume_format_2`, `template_format_2`).
2. Edit **`config/workflow.active.json`** so `resume_content_id`, `portfolio_content_id`, `resume_format_id`, and `portfolio_format_id` match those IDs. Adjust **`outputs.*`** if you want distinct artifact names per profile.
3. Run **`python -m tools workflow validate-config`**, then **`python -m tools resume build`**, then **`cd portfolio && npm run sync`** (or rely on **`predev`** / **`prebuild`** for sync when developing).

The browser does not rebuild the PDF; it downloads the file produced by the resume build and copied during sync. See **`config/README.md`** for the full checklist.
