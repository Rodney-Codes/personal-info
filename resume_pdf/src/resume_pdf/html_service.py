"""HTML fragment cleanup and document shell assembly."""

from __future__ import annotations

import html
import re
from pathlib import Path


def apply_resume_semantic_classes(html_body: str) -> str:
    tagged, n = re.subn(
        r"(<h1[^>]*>.*?</h1>\s*)<p>",
        r'\1<p class="resume-contact">',
        html_body,
        count=1,
        flags=re.DOTALL,
    )
    return tagged if n else html_body


def _strip_trailing_empty_blocks(html_body: str) -> str:
    s = html_body.rstrip()
    while True:
        before = s
        s = re.sub(r"(?:\s*<p>\s*(?:<br\s*/>)?\s*</p>\s*)+$", "", s, flags=re.IGNORECASE)
        s = re.sub(r"(?:\s*<br\s*/>\s*)+$", "", s, flags=re.IGNORECASE)
        s = s.rstrip()
        if s == before:
            break
    return s


def sanitize_html_for_pdf(html_body: str) -> str:
    s = html_body
    while True:
        before = s
        s = re.sub(r"<p>\s*(?:<br\s*/>)?\s*</p>", "", s, flags=re.IGNORECASE)
        if s == before:
            break
    s = re.sub(r"(?:<br\s*/>\s*){3,}", "<br />", s, flags=re.IGNORECASE)
    return _strip_trailing_empty_blocks(s)


def render_document_html(
    *,
    template_path: Path,
    document_title: str,
    css_text: str,
    body_html: str,
) -> str:
    tpl = template_path.read_text(encoding="utf-8")
    styles_block = f"<style>\n{css_text}\n</style>"
    return (
        tpl.replace("__RESUME_DOCUMENT_TITLE__", html.escape(document_title))
        .replace("__RESUME_DOCUMENT_STYLES__", styles_block)
        .replace("__RESUME_DOCUMENT_BODY__", body_html)
    )
