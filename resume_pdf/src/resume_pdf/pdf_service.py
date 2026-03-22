"""PDF byte generation and post-processing."""

from __future__ import annotations

import io


def trim_trailing_blank_pages(pdf_bytes: bytes) -> bytes:
    try:
        from pypdf import PdfReader, PdfWriter
    except ImportError:
        return pdf_bytes

    reader = PdfReader(io.BytesIO(pdf_bytes))
    total = len(reader.pages)
    if total <= 1:
        return pdf_bytes

    last_idx = total - 1
    while last_idx >= 0:
        try:
            text = reader.pages[last_idx].extract_text() or ""
        except Exception:
            text = ""
        if text.strip():
            break
        last_idx -= 1

    if last_idx < 0 or last_idx == total - 1:
        return pdf_bytes

    writer = PdfWriter()
    for i in range(last_idx + 1):
        writer.add_page(reader.pages[i])
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def html_to_pdf_bytes(html_doc: str) -> tuple[bytes, bool]:
    """
    Render full HTML document to PDF. Returns (pdf_bytes, ok).
    ok is False if xhtml2pdf reported errors.
    """
    from xhtml2pdf import pisa

    buf = io.BytesIO()
    status = pisa.CreatePDF(html_doc, dest=buf, encoding="utf-8")
    return buf.getvalue(), not bool(status.err)
