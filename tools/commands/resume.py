"""Resume-related registered commands."""

from __future__ import annotations

import sys
from pathlib import Path

from __root__ import REPO_ROOT
from tools.registry import command

_RESUME_PDF_DIR = REPO_ROOT / "resume_pdf"
_RESUME_PDF_SRC = _RESUME_PDF_DIR / "src"
if str(_RESUME_PDF_SRC) not in sys.path:
    sys.path.insert(0, str(_RESUME_PDF_SRC))

from resume_pdf.cli import main as resume_pdf_main


@command(
    "resume",
    "build",
    description="Build workflow-selected resume PDF into artifacts/<outputs.resume_pdf>.",
)
def resume_build(argv: list[str]) -> int:
    return resume_pdf_main(argv, script_dir=_RESUME_PDF_DIR)
