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
