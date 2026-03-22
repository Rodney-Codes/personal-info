"""Register and resolve CLI commands (path + handler + help text)."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

Handler = Callable[[list[str]], int]


@dataclass(frozen=True)
class RegisteredCommand:
    path: tuple[str, ...]
    description: str
    handler: Handler


_REGISTRY: list[RegisteredCommand] = []


def command(*path: str, description: str = "") -> Callable[[Handler], Handler]:
    """Decorator: register a handler for e.g. @command(\"resume\", \"build\")."""

    def decorator(fn: Handler) -> Handler:
        desc = (description or (fn.__doc__ or "")).strip()
        _REGISTRY.append(RegisteredCommand(tuple(path), desc, fn))
        return fn

    return decorator


def all_commands() -> list[RegisteredCommand]:
    return list(_REGISTRY)


def find_handler(argv: list[str]) -> tuple[Handler, list[str]] | None:
    """Match the longest registered path prefix; return handler and remaining argv."""
    for reg in sorted(_REGISTRY, key=lambda r: len(r.path), reverse=True):
        n = len(reg.path)
        if len(argv) >= n and tuple(argv[:n]) == reg.path:
            return reg.handler, argv[n:]
    return None
