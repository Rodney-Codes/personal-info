"""Text parsing helpers."""


def split_three_pipe_fields(rest: str) -> tuple[str, str, str] | None:
    parts = [p.strip() for p in rest.split("|")]
    if len(parts) < 2:
        return None
    while len(parts) < 3:
        parts.append("")
    if len(parts) > 3:
        parts = [parts[0], "|".join(parts[1:-1]), parts[-1]]
    return parts[0], parts[1], parts[2]


def split_proj_fields(rest: str) -> tuple[str, str, str, str, str] | None:
    """Title | stack | description | year | url (description may contain pipes)."""
    parts = [p.strip() for p in rest.split("|")]
    if len(parts) < 5:
        return None
    title = parts[0]
    stack = parts[1]
    year = parts[-2]
    url = parts[-1]
    desc = " | ".join(parts[2:-2]).strip()
    if not title or not url:
        return None
    return title, stack, desc, year, url
