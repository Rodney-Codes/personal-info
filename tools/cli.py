"""Dispatch argv to registered commands."""

from __future__ import annotations

import sys

from tools.registry import all_commands, find_handler


def _print_help() -> None:
    lines = [
        "Usage: python -m tools <command> [subcommand ...] [-- args-for-handler...]",
        "",
        "Run from the repository root. Registered commands:",
        "",
    ]
    for reg in sorted(all_commands(), key=lambda r: r.path):
        path_s = " ".join(reg.path)
        desc = reg.description or "(no description)"
        lines.append(f"  {path_s}")
        lines.append(f"      {desc}")
        lines.append("")
    lines.append(
        "Any arguments after the registered path are passed to that command "
        "(e.g. resume PDF flags)."
    )
    print("\n".join(lines).rstrip())


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)

    import tools.commands  # noqa: F401 — loads modules that call @command

    if not argv or argv[0] in ("-h", "--help", "help"):
        _print_help()
        return 0

    matched = find_handler(argv)
    if matched is None:
        print(f"Unknown command: {' '.join(argv)}", file=sys.stderr)
        _print_help()
        return 1

    handler, rest = matched
    return handler(rest)


if __name__ == "__main__":
    raise SystemExit(main())
