"""Central task runner for this repository (see __main__.py)."""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure repo root is importable (for __root__ and consistent paths).
_TOOLS_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _TOOLS_DIR.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))
