"""
Repository root marker. Other code resolves the repo via REPO_ROOT or repo_root_from().

Walk upward from any file or directory until __root__/__init__.py exists in the candidate.
"""

from __future__ import annotations

from pathlib import Path

__all__ = ["REPO_ROOT", "repo_root_from"]


def repo_root_from(anchor: Path | None = None) -> Path:
    """
    Starting from anchor (file, directory, or cwd), walk parents until this package's
    __init__.py is found; return the repository root directory.
    """
    p = (anchor or Path.cwd()).resolve()
    if p.is_file():
        p = p.parent
    for d in [p, *p.parents]:
        marker = d / "__root__" / "__init__.py"
        if marker.is_file():
            return d
    raise FileNotFoundError(
        "Could not find repo root: no __root__/__init__.py in any parent of "
        f"{p}."
    )


# This file lives at <repo>/__root__/__init__.py
REPO_ROOT: Path = Path(__file__).resolve().parent.parent

if REPO_ROOT != repo_root_from(Path(__file__)):
    raise RuntimeError("__root__: REPO_ROOT and repo_root_from(__file__) disagree")
