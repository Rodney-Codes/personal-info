# Workflow V2 (Versioned Content + Template Composition)

## Goal

Move from a single-source resume/portfolio flow to a composable pipeline:

**Switching combinations:** after new `.md` or template JSON files exist in the right folders, update **`config/workflow.active.json`** only (IDs + optional `outputs` names), then run resume build and portfolio sync. No separate “registry” file is required beyond that config.

- choose one resume content version
- choose one portfolio content version
- choose one resume format template
- choose one portfolio format template
- build a resolved release profile with explicit artifact names

## Directory Contract

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

## Active Profile Contract

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

## Template Manifest Shape (V2)

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

## Build Manifest (Required Output)

Each run should emit `artifacts/<outputs.build_manifest>` with:

- selected IDs
- resolved source/template file paths
- generated artifact paths
- UTC timestamp

This improves traceability and debugging when a wrong combination is deployed.

## Implementation Phases

1. Contract + validator:
   - add active profile config
   - add content/template directories
   - add `python -m tools workflow validate-config`
2. Resume pipeline integration:
   - make resume build read active profile instead of static `build_config.json`
3. Portfolio sync integration:
   - make sync read active profile and write profile-selected site JSON + runtime selector
4. Deployment integration:
   - deploy selected profile output only
5. Optional matrix:
   - pre-release verification for multiple profile IDs

## Non-Goals for First Cut

- supporting arbitrary unmanaged file layouts
- supporting every historical markdown convention
- runtime template auto-discovery

