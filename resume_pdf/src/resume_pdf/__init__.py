"""
Markdown-to-PDF pipeline (xhtml2pdf). Subpackages organize config, preprocessors,
HTML handling, PDF rendering, and CLI.
"""

from resume_pdf.cli import main

__all__ = ["main"]
