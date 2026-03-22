"""
CLI entry for the resume PDF builder. Puts repo root and resume_pdf/src on sys.path.
"""
from __future__ import annotations

import sys
from pathlib import Path

_RESUME_PDF_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _RESUME_PDF_DIR.parent

for _p in (_REPO_ROOT, _RESUME_PDF_DIR / "src"):
    s = str(_p)
    if s not in sys.path:
        sys.path.insert(0, s)

from __root__ import REPO_ROOT

if REPO_ROOT.resolve() != _REPO_ROOT.resolve():
    raise RuntimeError("resume_pdf/build.py: repo root mismatch vs __root__.REPO_ROOT")

from resume_pdf.cli import main

if __name__ == "__main__":
    sys.exit(main(script_dir=REPO_ROOT / "resume_pdf"))
