"""Portfolio site (Vite): sync resume MD, dev server, production build."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

from __root__ import REPO_ROOT
from tools.registry import command

_PORTFOLIO = REPO_ROOT / "portfolio"


def _npm_executable() -> str | None:
    """
    Windows: `npm` is usually npm.cmd; subprocess list form often fails with WinError 2
    if the bare name does not resolve to an .exe.
    """
    for name in ("npm", "npm.cmd"):
        found = shutil.which(name)
        if found:
            return found
    return None


def _npm(args: list[str]) -> int:
    if not _PORTFOLIO.is_dir():
        print(f"Missing portfolio directory: {_PORTFOLIO}", file=sys.stderr)
        return 1
    npm = _npm_executable()
    if not npm:
        print(
            "npm not found on PATH. Install Node.js and restart the terminal (or Cursor).",
            file=sys.stderr,
        )
        return 1
    return subprocess.call([npm, *args], cwd=_PORTFOLIO)


@command(
    "portfolio",
    "sync",
    description="Generate portfolio/public/site.json (and PDF copy) from content/*.md",
)
def portfolio_sync(argv: list[str]) -> int:
    return _npm(["run", "sync", *argv])


@command(
    "portfolio",
    "dev",
    description="Start portfolio dev server (localhost; runs sync first via npm predev)",
)
def portfolio_dev(argv: list[str]) -> int:
    return _npm(["run", "dev", *argv])


@command(
    "portfolio",
    "build",
    description="Production static build to portfolio/dist (runs sync first)",
)
def portfolio_build(argv: list[str]) -> int:
    return _npm(["run", "build", *argv])


@command(
    "portfolio",
    "preview",
    description="Preview production build (run portfolio build first)",
)
def portfolio_preview(argv: list[str]) -> int:
    return _npm(["run", "preview", *argv])
