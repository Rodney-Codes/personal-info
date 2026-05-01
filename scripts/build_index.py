from __future__ import annotations

import argparse
import json
from pathlib import Path

from docs_chatbot_service.core.indexer import build_index


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build corpus index from chunks.json")
    parser.add_argument("--corpus-id", required=True)
    parser.add_argument("--chunks-path", required=True)
    parser.add_argument("--index-root", required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    chunks = json.loads(Path(args.chunks_path).read_text(encoding="utf-8"))
    build_index(corpus_id=args.corpus_id, chunks=chunks, index_root=Path(args.index_root))


if __name__ == "__main__":
    main()

