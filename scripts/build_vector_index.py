from __future__ import annotations

import argparse
import json
from pathlib import Path

from docs_chatbot_service.core.vector_search import HashedVectorIndex


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build lightweight vector index from chunks.json")
    parser.add_argument("--chunks-path", required=True)
    parser.add_argument("--output-path", required=True)
    parser.add_argument("--dim", type=int, default=512)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    chunks = json.loads(Path(args.chunks_path).read_text(encoding="utf-8"))
    index = HashedVectorIndex.from_chunks(chunks=chunks, dim=args.dim)
    index.save(Path(args.output_path))


if __name__ == "__main__":
    main()

