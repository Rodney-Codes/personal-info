from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build chatbot corpus from active workflow content selection"
    )
    parser.add_argument("--corpus-id", default="default")
    parser.add_argument("--workflow-path", default="config/workflow.active.json")
    parser.add_argument("--source-prefix", default="/content")
    parser.add_argument("--processed-dir", default="data/processed")
    parser.add_argument("--index-root", default="data/index")
    parser.add_argument("--chunk-size-words", type=int, default=450)
    parser.add_argument("--overlap-words", type=int, default=70)
    return parser.parse_args()


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def main() -> None:
    args = parse_args()
    repo_root = Path(__file__).resolve().parents[1]
    workflow_path = (repo_root / args.workflow_path).resolve()
    workflow = json.loads(workflow_path.read_text(encoding="utf-8"))

    resume_id = str(workflow["resume_content_id"]).strip()
    portfolio_id = str(workflow["portfolio_content_id"]).strip()

    source_files = [
        repo_root / "content" / "resumes" / f"{resume_id}.md",
        repo_root / "content" / "portfolios" / f"{portfolio_id}.md",
    ]
    missing = [str(path) for path in source_files if not path.exists()]
    if missing:
        raise FileNotFoundError(
            "Workflow-selected content file(s) not found: " + ", ".join(missing)
        )

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_raw = Path(tmp_dir)
        for src in source_files:
            (tmp_raw / src.name).write_text(src.read_text(encoding="utf-8"), encoding="utf-8")

        run(
            [
                sys.executable,
                str(repo_root / "scripts" / "build_corpus.py"),
                "--corpus-id",
                args.corpus_id,
                "--raw-dir",
                str(tmp_raw),
                "--source-prefix",
                args.source_prefix.rstrip("/"),
                "--processed-dir",
                str((repo_root / args.processed_dir).resolve()),
                "--index-root",
                str((repo_root / args.index_root).resolve()),
                "--chunk-size-words",
                str(args.chunk_size_words),
                "--overlap-words",
                str(args.overlap_words),
            ]
        )


if __name__ == "__main__":
    main()

