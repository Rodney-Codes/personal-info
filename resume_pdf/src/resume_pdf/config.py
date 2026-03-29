"""Build configuration: defaults, JSON merge, resolved paths, validation."""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


# Defaults when build_config.json is missing; paths are relative to resume_pdf/ (tool root).
DEFAULT_CONFIG: dict[str, Any] = {
    "input_md": "../content/resumes/resume_1.md",
    "output_pdf": "../artifacts/resume.main_release.pdf",
    "css": "assets/resume.css",
    "document_template": "assets/templates/document.html",
    "education_row_template": "assets/templates/education_row.html",
    "experience_row_template": "assets/templates/experience_row.html",
    "document_title": "Resume",
    "preprocessors": {
        "edu_and_tech_rows": True,
        "experience_pipe_rows": True,
        "first_h1_contact_paragraph": True,
    },
    "postprocessors": {
        "trim_trailing_blank_pages": True,
    },
}


def deep_merge(base: dict, override: dict) -> dict:
    out = dict(base)
    for k, v in override.items():
        if k in out and isinstance(out[k], dict) and isinstance(v, dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def _load_config_file(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def load_build_configuration(
    config_path: Path | None,
    *,
    script_dir: Path,
) -> tuple[dict[str, Any], Path]:
    """
    Merge DEFAULT_CONFIG with optional JSON file. Paths in JSON are relative to
    the config file's directory (or script_dir if no file).
    """
    if config_path is None:
        config_path = script_dir / "build_config.json"
    if config_path.is_file():
        raw = _load_config_file(config_path)
        merged = deep_merge(DEFAULT_CONFIG, raw)
        base_dir = config_path.resolve().parent
        return merged, base_dir
    return dict(DEFAULT_CONFIG), script_dir


def resolve_path(base_dir: Path, value: str | Path) -> Path:
    p = Path(value)
    return p.resolve() if p.is_absolute() else (base_dir / p).resolve()


def _resolve_cfg_path(
    base_dir: Path,
    cfg: dict[str, Any],
    overrides: dict[str, Any],
    key: str,
) -> Path:
    """Narrow JSON/config values to str | Path before resolve_path (satisfies type checkers)."""
    raw: object = overrides.get(key, cfg[key])
    if isinstance(raw, Path):
        segment: str | Path = raw
    elif isinstance(raw, str):
        segment = raw
    else:
        segment = str(raw)
    return resolve_path(base_dir, segment)


@dataclass
class BuildPaths:
    """Resolved filesystem paths and feature flags for one build run."""

    base_dir: Path
    input_md: Path
    output_pdf: Path
    css: Path
    document_template: Path
    education_row_template: Path
    experience_row_template: Path
    document_title: str
    preprocess_edu_tech: bool
    preprocess_experience: bool
    contact_class_after_h1: bool
    trim_blank_pages: bool


def paths_from_config(
    cfg: dict[str, Any],
    base_dir: Path,
    overrides: dict[str, Any],
) -> BuildPaths:
    pre = cfg.get("preprocessors") or {}
    post = cfg.get("postprocessors") or {}
    return BuildPaths(
        base_dir=base_dir,
        input_md=_resolve_cfg_path(base_dir, cfg, overrides, "input_md"),
        output_pdf=_resolve_cfg_path(base_dir, cfg, overrides, "output_pdf"),
        css=_resolve_cfg_path(base_dir, cfg, overrides, "css"),
        document_template=_resolve_cfg_path(base_dir, cfg, overrides, "document_template"),
        education_row_template=_resolve_cfg_path(
            base_dir, cfg, overrides, "education_row_template"
        ),
        experience_row_template=_resolve_cfg_path(
            base_dir, cfg, overrides, "experience_row_template"
        ),
        document_title=str(overrides.get("document_title", cfg.get("document_title", "Document"))),
        preprocess_edu_tech=bool(pre.get("edu_and_tech_rows", True)),
        preprocess_experience=bool(pre.get("experience_pipe_rows", True)),
        contact_class_after_h1=bool(pre.get("first_h1_contact_paragraph", True)),
        trim_blank_pages=bool(post.get("trim_trailing_blank_pages", True)),
    )


def apply_cli_to_paths(paths: BuildPaths, args: argparse.Namespace) -> BuildPaths:
    if args.input is not None:
        paths.input_md = Path(args.input).resolve()
    if args.output is not None:
        paths.output_pdf = Path(args.output).resolve()
    if args.css is not None:
        paths.css = Path(args.css).resolve()
    if args.document_template is not None:
        paths.document_template = Path(args.document_template).resolve()
    if args.title is not None:
        paths.document_title = args.title
    if args.no_edu_tech:
        paths.preprocess_edu_tech = False
    if args.no_experience_rows:
        paths.preprocess_experience = False
    if args.no_contact_class:
        paths.contact_class_after_h1 = False
    if args.no_trim_blank_pages:
        paths.trim_blank_pages = False
    return paths


def validate_paths(paths: BuildPaths) -> list[str]:
    """Return list of error messages; empty if OK."""
    errors: list[str] = []
    if not paths.input_md.is_file():
        errors.append(f"Input Markdown not found: {paths.input_md}")
    if not paths.css.is_file():
        errors.append(f"Stylesheet not found: {paths.css}")
    if not paths.document_template.is_file():
        errors.append(f"Document template not found: {paths.document_template}")
    if paths.preprocess_edu_tech and not paths.education_row_template.is_file():
        errors.append(
            f"edu_and_tech_rows enabled but template missing: {paths.education_row_template}"
        )
    if paths.preprocess_experience and not paths.experience_row_template.is_file():
        errors.append(
            f"experience_pipe_rows enabled but template missing: {paths.experience_row_template}"
        )
    return errors
