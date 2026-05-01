from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import List


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Ingest raw docs into docs.json")
    parser.add_argument("--raw-dir", required=True)
    parser.add_argument("--output-path", required=True)
    parser.add_argument("--source-prefix", default="/portfolio")
    return parser.parse_args()


def normalize_text(text: str) -> str:
    return " ".join(text.split())


def collect_docs(raw_dir: Path, source_prefix: str) -> List[dict]:
    records: List[dict] = []
    for path in sorted(raw_dir.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in {".md", ".txt"}:
            continue
        text = normalize_text(path.read_text(encoding="utf-8"))
        rel = path.relative_to(raw_dir).as_posix()
        stem = path.stem.lower().replace(" ", "-").replace("_", "-")
        records.append(
            {
                "doc_id": stem,
                "title": path.stem.replace("_", " ").replace("-", " ").title(),
                "section": "general",
                "source": f"{source_prefix}/{rel}",
                "text": text,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        )
    return records


def main() -> None:
    args = parse_args()
    raw_dir = Path(args.raw_dir)
    output_path = Path(args.output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    docs = collect_docs(raw_dir=raw_dir, source_prefix=args.source_prefix.rstrip("/"))
    output_path.write_text(json.dumps(docs, ensure_ascii=True, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()

