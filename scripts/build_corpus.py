from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build searchable corpus from raw docs")
    parser.add_argument("--corpus-id", required=True)
    parser.add_argument("--raw-dir", required=True)
    parser.add_argument("--source-prefix", required=True)
    parser.add_argument("--processed-dir", default="data/processed")
    parser.add_argument("--index-root", default="data/index")
    parser.add_argument("--chunk-size-words", type=int, default=450)
    parser.add_argument("--overlap-words", type=int, default=70)
    return parser.parse_args()


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def main() -> None:
    args = parse_args()
    processed_dir = Path(args.processed_dir)
    docs_path = processed_dir / "docs.json"
    chunks_path = processed_dir / "chunks.json"

    run(
        [
            sys.executable,
            "scripts/ingest.py",
            "--raw-dir",
            args.raw_dir,
            "--output-path",
            str(docs_path),
            "--source-prefix",
            args.source_prefix,
        ]
    )
    run(
        [
            sys.executable,
            "scripts/chunk.py",
            "--docs-path",
            str(docs_path),
            "--output-path",
            str(chunks_path),
            "--chunk-size-words",
            str(args.chunk_size_words),
            "--overlap-words",
            str(args.overlap_words),
        ]
    )
    run(
        [
            sys.executable,
            "scripts/build_index.py",
            "--corpus-id",
            args.corpus_id,
            "--chunks-path",
            str(chunks_path),
            "--index-root",
            args.index_root,
        ]
    )
    run(
        [
            sys.executable,
            "scripts/build_vector_index.py",
            "--chunks-path",
            str(chunks_path),
            "--output-path",
            str(Path(args.index_root) / args.corpus_id / "vector_index.json"),
        ]
    )


if __name__ == "__main__":
    main()

