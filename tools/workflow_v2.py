"""Resolve and validate config/workflow.active.json (active profile)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from __root__ import REPO_ROOT

ACTIVE_WORKFLOW_CONFIG = REPO_ROOT / "config" / "workflow.active.json"

_REQUIRED_TOP_LEVEL = (
    "profile_id",
    "resume_content_id",
    "portfolio_content_id",
    "resume_format_id",
    "portfolio_format_id",
    "outputs",
)

_REQUIRED_OUTPUT_KEYS = ("site_json", "resume_pdf", "build_manifest")


@dataclass(frozen=True)
class ResolvedWorkflow:
    profile_id: str
    resume_content_id: str
    portfolio_content_id: str
    resume_format_id: str
    portfolio_format_id: str
    outputs: dict[str, str]
    resume_content_path: Path
    portfolio_content_path: Path
    resume_format_path: Path
    portfolio_format_path: Path


def _load_json_object(path: Path) -> dict[str, Any]:
    data = _read_json(path)
    return {str(k): v for k, v in data.items()}


def _require_nonempty_string(value: Any, field_name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"Missing or invalid string field: {field_name}")
    return value.strip()


def _read_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError(f"Expected JSON object at: {path}")
    return data


def _validate_output_file_name(value: str, key: str) -> None:
    if not value or not isinstance(value, str):
        raise ValueError(f"outputs.{key} must be a non-empty string")
    candidate = Path(value)
    if candidate.name != value or "\\" in value or "/" in value:
        raise ValueError(f"outputs.{key} must be a file name only, got: {value}")


def resolve_active_workflow(config_path: Path = ACTIVE_WORKFLOW_CONFIG) -> ResolvedWorkflow:
    if not config_path.is_file():
        raise FileNotFoundError(f"Missing workflow config: {config_path}")

    cfg = _read_json(config_path)
    for key in _REQUIRED_TOP_LEVEL:
        if key not in cfg:
            raise ValueError(f"Missing key in workflow config: {key}")

    outputs = cfg["outputs"]
    if not isinstance(outputs, dict):
        raise ValueError("outputs must be a JSON object")

    for key in _REQUIRED_OUTPUT_KEYS:
        if key not in outputs:
            raise ValueError(f"Missing outputs key: {key}")
        _validate_output_file_name(str(outputs[key]), key)

    for key in _REQUIRED_TOP_LEVEL:
        if key == "outputs":
            continue
        if not isinstance(cfg[key], str) or not cfg[key].strip():
            raise ValueError(f"{key} must be a non-empty string")

    profile_id = cfg["profile_id"].strip()
    resume_content_id = cfg["resume_content_id"].strip()
    portfolio_content_id = cfg["portfolio_content_id"].strip()
    resume_format_id = cfg["resume_format_id"].strip()
    portfolio_format_id = cfg["portfolio_format_id"].strip()

    resolved = ResolvedWorkflow(
        profile_id=profile_id,
        resume_content_id=resume_content_id,
        portfolio_content_id=portfolio_content_id,
        resume_format_id=resume_format_id,
        portfolio_format_id=portfolio_format_id,
        outputs={k: str(v) for k, v in outputs.items()},
        resume_content_path=REPO_ROOT / "content" / "resumes" / f"{resume_content_id}.md",
        portfolio_content_path=REPO_ROOT
        / "content"
        / "portfolios"
        / f"{portfolio_content_id}.md",
        resume_format_path=REPO_ROOT
        / "templates"
        / "resume_formats"
        / f"{resume_format_id}.json",
        portfolio_format_path=REPO_ROOT
        / "templates"
        / "portfolio_formats"
        / f"{portfolio_format_id}.json",
    )

    _validate_references_exist(resolved)
    return resolved


def _validate_references_exist(resolved: ResolvedWorkflow) -> None:
    checks = (
        resolved.resume_content_path,
        resolved.portfolio_content_path,
        resolved.resume_format_path,
        resolved.portfolio_format_path,
    )
    for path in checks:
        if not path.is_file():
            raise FileNotFoundError(f"Referenced file does not exist: {path}")


def resolve_resume_build_overrides(
    resolved: ResolvedWorkflow,
) -> dict[str, Any]:
    """Map active workflow + resume format manifest to resume_pdf config keys."""
    template = _load_json_object(resolved.resume_format_path)

    row_templates_raw = template.get("row_templates")
    if not isinstance(row_templates_raw, dict):
        raise ValueError("resume format manifest must define row_templates object")
    row_templates = {str(k): v for k, v in row_templates_raw.items()}

    css_path = _require_nonempty_string(template.get("css_path"), "css_path")
    document_template_path = _require_nonempty_string(
        template.get("document_template_path"),
        "document_template_path",
    )
    education_row_template = _require_nonempty_string(
        row_templates.get("education"),
        "row_templates.education",
    )
    experience_row_template = _require_nonempty_string(
        row_templates.get("experience"),
        "row_templates.experience",
    )
    document_title = template.get("document_title", "Resume")

    output_pdf_path = REPO_ROOT / "artifacts" / resolved.outputs["resume_pdf"]
    return {
        "input_md": resolved.resume_content_path,
        "output_pdf": output_pdf_path,
        "css": REPO_ROOT / css_path,
        "document_template": REPO_ROOT / document_template_path,
        "education_row_template": REPO_ROOT / str(education_row_template),
        "experience_row_template": REPO_ROOT / str(experience_row_template),
        "document_title": str(document_title),
    }

