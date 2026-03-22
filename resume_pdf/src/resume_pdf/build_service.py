"""Orchestrates one end-to-end Markdown to PDF build."""

from __future__ import annotations

import sys

from resume_pdf.config import BuildPaths
from resume_pdf.html_service import (
    apply_resume_semantic_classes,
    render_document_html,
    sanitize_html_for_pdf,
)
from resume_pdf.pdf_service import html_to_pdf_bytes, trim_trailing_blank_pages
from resume_pdf.preprocessors import preprocess_edu_and_tech_rows, preprocess_experience_rows


def run_build(paths: BuildPaths) -> int:
    try:
        import markdown
    except ImportError:
        print("Missing dependency: pip install markdown", file=sys.stderr)
        return 1

    try:
        import xhtml2pdf  # noqa: F401
    except ImportError:
        print("Missing dependency: pip install xhtml2pdf", file=sys.stderr)
        return 1

    md_text = paths.input_md.read_text(encoding="utf-8")

    if paths.preprocess_edu_tech:
        md_text = preprocess_edu_and_tech_rows(md_text, paths.education_row_template)
    if paths.preprocess_experience:
        md_text = preprocess_experience_rows(md_text, paths.experience_row_template)

    html_body = markdown.markdown(
        md_text,
        extensions=["extra"],
        output_format="html",
    )
    if paths.contact_class_after_h1:
        html_body = apply_resume_semantic_classes(html_body)
    html_body = sanitize_html_for_pdf(html_body)

    css_text = paths.css.read_text(encoding="utf-8")
    html_doc = render_document_html(
        template_path=paths.document_template,
        document_title=paths.document_title,
        css_text=css_text,
        body_html=html_body,
    )

    pdf_bytes, ok = html_to_pdf_bytes(html_doc)
    if not ok:
        print("PDF build failed.", file=sys.stderr)
        return 1

    if paths.trim_blank_pages:
        pdf_bytes = trim_trailing_blank_pages(pdf_bytes)

    paths.output_pdf.parent.mkdir(parents=True, exist_ok=True)
    paths.output_pdf.write_bytes(pdf_bytes)
    print(f"Wrote {paths.output_pdf}")
    return 0
