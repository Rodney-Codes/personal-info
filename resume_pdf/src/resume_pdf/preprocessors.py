"""Resume-specific Markdown line transforms before the common Markdown pass."""

from __future__ import annotations

import html
import re
import sys
from pathlib import Path

from resume_pdf.utils.text import split_three_pipe_fields


_EDU_LINE = re.compile(r"^\s*@edu\s+(.+?)\s*$", re.IGNORECASE)
_TECH_LINE = re.compile(r"^\s*@tech\s+(.+?)\s*$", re.IGNORECASE)
_EXP_LINE = re.compile(
    r"^\*\*(?P<company>.+?)\*\*\s*\|\s*(?P<location>.+?)\s*\|\s*(?P<dates>.+?)\s*$"
)


def preprocess_edu_and_tech_rows(md_text: str, template_path: Path) -> str:
    if not template_path.is_file():
        print(
            f"Missing education row template: {template_path}",
            file=sys.stderr,
        )
        return md_text

    template = template_path.read_text(encoding="utf-8")
    lines_out: list[str] = []
    for line in md_text.splitlines():
        m_edu = _EDU_LINE.match(line)
        m_tech = _TECH_LINE.match(line)
        if m_edu:
            rest = m_edu.group(1).strip()
        elif m_tech:
            rest = m_tech.group(1).strip()
        else:
            lines_out.append(line)
            continue

        triple = split_three_pipe_fields(rest)
        if triple is None:
            lines_out.append(line)
            continue
        school, detail, year = triple
        row = (
            template.replace("{{school}}", html.escape(school))
            .replace("{{detail}}", html.escape(detail))
            .replace("{{year}}", html.escape(year))
        )
        lines_out.append(row)
    return "\n".join(lines_out)


def preprocess_experience_rows(md_text: str, template_path: Path) -> str:
    if not template_path.is_file():
        print(
            f"Missing experience row template: {template_path}",
            file=sys.stderr,
        )
        return md_text

    template = template_path.read_text(encoding="utf-8")
    lines_out: list[str] = []
    for line in md_text.splitlines():
        m = _EXP_LINE.match(line)
        if not m:
            lines_out.append(line)
            continue
        company = m.group("company").strip()
        location = m.group("location").strip()
        dates = m.group("dates").strip()
        row = (
            template.replace("{{company}}", html.escape(company))
            .replace("{{location}}", html.escape(location))
            .replace("{{dates}}", html.escape(dates))
        )
        lines_out.append(row)
    return "\n".join(lines_out)
