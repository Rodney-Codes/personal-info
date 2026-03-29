# Content

Versioned source markdown. Which files are used is determined only by **`config/workflow.active.json`** (`resume_content_id`, `portfolio_content_id`). Resume PDF layout and site chrome come from **`templates/`** via the same config (`resume_format_id`, `portfolio_format_id`). See **`config/README.md`**.

| Path pattern | Purpose |
|--------------|---------|
| `resumes/resume_i.md` | Resume facts: contact line, sections, `@edu` / `@tech`, experience/project conventions for PDF + portfolio sync. |
| `portfolios/portfolio_i.md` | Site narrative, optional YAML frontmatter for UI strings; `##` sections mapped in sync. |
