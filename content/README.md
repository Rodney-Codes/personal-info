# Content

**Canonical source data** for this repository. PDF and portfolio builds read from here.

| File | Purpose |
|------|---------|
| `resume.md` | Formal resume: `@edu` / `@tech`, contact line (pipe-separated; optional `[Portfolio](url)`). **Experience / Projects**: split on `###` between roles. Within each chunk: **classic** = title line + `**Org** \| Location \| Dates` + `-` bullets; **compact** = `**Name** \| Subtitle \| Year` + bullets. **Stacked compact** (e.g. several projects): repeat `**Name** \| … \| Year` blocks with blank lines between; no `###` required between them. Used by **`resume_pdf/`** and **`portfolio/`** sync. |
| `portfolio.md` | **Site-only** copy and **UI strings** (optional YAML frontmatter): narrative `##` sections plus labels, hero tagline, footer. Resume stays the source of truth for roles and metrics. |
