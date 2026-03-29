"""Workflow commands: validate active profile and resolve content/template paths."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from tools.registry import command
from tools.workflow_v2 import ACTIVE_WORKFLOW_CONFIG, resolve_active_workflow


@command(
    "workflow",
    "validate-config",
    description="Validate config/workflow.active.json and resolve selected content/template IDs.",
)
def workflow_validate_config(argv: list[str]) -> int:
    config_path = Path(argv[0]) if argv else ACTIVE_WORKFLOW_CONFIG
    try:
        resolved = resolve_active_workflow(config_path)
    except Exception as exc:  # noqa: BLE001
        print(f"workflow validate-config failed: {exc}", file=sys.stderr)
        return 1

    payload = {
        "profile_id": resolved.profile_id,
        "resume_content": str(resolved.resume_content_path),
        "portfolio_content": str(resolved.portfolio_content_path),
        "resume_format": str(resolved.resume_format_path),
        "portfolio_format": str(resolved.portfolio_format_path),
        "outputs": resolved.outputs,
    }
    print(json.dumps(payload, indent=2))
    return 0

