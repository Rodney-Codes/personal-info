# Workflow configuration

## Single switch point

**`workflow.active.json` is the only file you need to change** to point the whole pipeline at a different combination of:

| Key | Resolves to |
|-----|-------------|
| `resume_content_id` | `content/resumes/<id>.md` |
| `portfolio_content_id` | `content/portfolios/<id>.md` |
| `resume_format_id` | `templates/resume_formats/<id>.json` (paths to PDF HTML/CSS/row templates) |
| `portfolio_format_id` | `templates/portfolio_formats/<id>.json` (UI defaults, section mapping, `templateVariant`) |
| `outputs.site_json` | Generated site data: `portfolio/public/<filename>` |
| `outputs.resume_pdf` | Generated/copied PDF: `artifacts/<filename>` and `portfolio/public/<filename>` |
| `outputs.build_manifest` | Traceability: `artifacts/<filename>` |

After adding **new** content or template files, register them by setting the matching `*_id` and `outputs.*` names here (you may use new output filenames per profile to avoid cache confusion).

## Checklist after editing `workflow.active.json`

1. **Validate** (repo root, venv on):

   ```bash
   python -m tools workflow validate-config
   ```

2. **Build resume PDF** (if you want the download button and `pdfAvailable`):

   ```bash
   python -m tools resume build
   ```

3. **Sync portfolio assets** (regenerates site JSON, copies PDF into `portfolio/public/`, writes `workflow.runtime.json`):

   ```bash
   cd portfolio && npm run sync
   ```

   Or from repo root: `python -m tools portfolio sync`

4. **Dev or build**:

   ```bash
   cd portfolio && npm run dev
   ```

   `predev` / `prebuild` run `sync` automatically; explicit `sync` after a config change is still useful before a quick PDF-only rebuild.

## Runtime metadata

`portfolio/scripts/sync-site.mjs` writes `portfolio/public/workflow.runtime.json` with:

- `site_json_file`, `resume_pdf_file` (from `outputs`)
- `selected`: echo of the four content/format IDs for debugging and UI tooltips

Do not hand-edit generated files under `portfolio/public/` for profile selection; change **`config/workflow.active.json`** and re-run sync.
