"""Command-line interface."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from resume_pdf.build_service import run_build
from resume_pdf.config import (
    apply_cli_to_paths,
    load_build_configuration,
    paths_from_config,
    validate_paths,
)
from tools.workflow_v2 import resolve_active_workflow, resolve_resume_build_overrides


def _default_script_dir() -> Path:
    """resume_pdf/ project root (contains build_config.json)."""
    try:
        from __root__ import REPO_ROOT

        return REPO_ROOT / "resume_pdf"
    except ImportError:
        return Path(__file__).resolve().parent.parent.parent


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Build PDF from Markdown (config-driven, optional resume preprocessors).",
    )
    p.add_argument(
        "--config",
        type=Path,
        default=None,
        help="Path to build_config.json (default: resume_pdf/build_config.json)",
    )
    p.add_argument("--input", type=Path, default=None, help="Override input .md path")
    p.add_argument("--output", type=Path, default=None, help="Override output .pdf path")
    p.add_argument("--css", type=Path, default=None, help="Override stylesheet path")
    p.add_argument(
        "--document-template",
        type=Path,
        default=None,
        help="Override HTML shell template path",
    )
    p.add_argument("--title", default=None, help="Override <title> / document title")
    p.add_argument(
        "--no-edu-tech",
        action="store_true",
        help="Disable @edu / @tech row expansion (generic Markdown)",
    )
    p.add_argument(
        "--no-experience-rows",
        action="store_true",
        help="Disable **Co** | loc | dates row expansion",
    )
    p.add_argument(
        "--no-contact-class",
        action="store_true",
        help="Do not add resume-contact to first <p> after <h1>",
    )
    p.add_argument(
        "--no-trim-blank-pages",
        action="store_true",
        help="Disable pypdf trailing blank-page removal",
    )
    return p.parse_args(argv)


def main(argv: list[str] | None = None, *, script_dir: Path | None = None) -> int:
    args = parse_args(argv)
    base = script_dir if script_dir is not None else _default_script_dir()
    cfg, config_base_dir = load_build_configuration(args.config, script_dir=base)
    workflow_overrides: dict[str, object] = {}
    if args.config is None:
        resolved = resolve_active_workflow()
        workflow_overrides = resolve_resume_build_overrides(resolved)
    paths = paths_from_config(cfg, config_base_dir, workflow_overrides)
    paths = apply_cli_to_paths(paths, args)

    errors = validate_paths(paths)
    if errors:
        for e in errors:
            print(e, file=sys.stderr)
        return 1

    return run_build(paths)


if __name__ == "__main__":
    sys.exit(main())
