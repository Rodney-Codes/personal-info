# Content

Versioned source data for this repository. PDF and portfolio builds read from here via `config/workflow.active.json`.

| Path pattern | Purpose |
|------|---------|
| `resumes/resume_i.md` | Formal resume content (`i` is integer version). Supports `@edu` / `@tech`, contact line, and experience/project conventions used by PDF and portfolio sync. |
| `portfolios/portfolio_i.md` | Site-only narrative and optional YAML UI frontmatter (`i` is integer version). |

The active IDs are selected in `config/workflow.active.json`:

- `resume_content_id` / `portfolio_content_id` → which markdown files sync reads
- `resume_format_id` → resume PDF HTML/CSS template manifest (`templates/resume_formats/`), used by `python -m tools resume build`
- `portfolio_format_id` → site UI defaults and `templateVariant` (`templates/portfolio_formats/`)
