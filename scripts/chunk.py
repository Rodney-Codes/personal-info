from __future__ import annotations

import argparse
import json
from pathlib import Path

from docs_chatbot_service.core.chunking import chunk_text


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Chunk docs.json into chunks.json")
    parser.add_argument("--docs-path", required=True)
    parser.add_argument("--output-path", required=True)
    parser.add_argument("--chunk-size-words", type=int, default=450)
    parser.add_argument("--overlap-words", type=int, default=70)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    docs_path = Path(args.docs_path)
    output_path = Path(args.output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    docs = json.loads(docs_path.read_text(encoding="utf-8"))
    chunks: list[dict] = []
    for doc in docs:
        for idx, text in enumerate(
            chunk_text(
                doc.get("text", ""),
                chunk_size_words=args.chunk_size_words,
                overlap_words=args.overlap_words,
            ),
            start=1,
        ):
            chunks.append(
                {
                    "chunk_id": f"{doc['doc_id']}-{idx}",
                    "doc_id": doc["doc_id"],
                    "title": doc.get("title", ""),
                    "section": doc.get("section", "general"),
                    "source": doc.get("source", ""),
                    "text": text,
                }
            )

    output_path.write_text(json.dumps(chunks, ensure_ascii=True, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()

