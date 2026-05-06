from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = REPO_ROOT / "src"
SCRIPTS_ROOT = REPO_ROOT / "scripts"
for p in (SRC_ROOT, SCRIPTS_ROOT, REPO_ROOT):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

import scripts.eval_retrieval as eval_retrieval  # noqa: E402


SAMPLE_CHUNKS = [
    {
        "chunk_id": "projects-1",
        "doc_id": "projects",
        "title": "Projects",
        "section": "general",
        "source": "/portfolio/projects.md",
        "text": "Built a retrieval first chatbot service with BM25 ranking.",
    },
    {
        "chunk_id": "skills-1",
        "doc_id": "skills",
        "title": "Skills",
        "section": "general",
        "source": "/portfolio/skills.md",
        "text": "Python, FastAPI, and search systems.",
    },
    {
        "chunk_id": "tools-1",
        "doc_id": "tools",
        "title": "Tools",
        "section": "general",
        "source": "/portfolio/tools.md",
        "text": "Tableau dashboards and Metabase analytics.",
    },
]


class EvalRetrievalTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        base = Path(self.tmp.name)
        self.index_root = base / "index"
        corpus_dir = self.index_root / "default"
        corpus_dir.mkdir(parents=True, exist_ok=True)
        (corpus_dir / "chunks.json").write_text(json.dumps(SAMPLE_CHUNKS), encoding="utf-8")

        self.eval_path = base / "eval.json"
        self.eval_path.write_text(
            json.dumps(
                {
                    "_meta": {"default_corpus_id": "default", "default_top_k": 3},
                    "examples": [
                        {
                            "id": "skills-q",
                            "query": "what python skills do you have",
                            "expected_doc_ids": ["skills"],
                        },
                        {
                            "id": "tools-q",
                            "query": "tableau dashboards",
                            "expected_doc_ids": ["tools"],
                        },
                        {
                            "id": "unsatisfiable",
                            "query": "zzzzz nonexistent space probe",
                            "expected_doc_ids": ["nonexistent"],
                        },
                    ],
                }
            ),
            encoding="utf-8",
        )

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_run_evaluation_computes_metrics_per_model(self) -> None:
        report = eval_retrieval.run_evaluation(
            eval_path=self.eval_path,
            index_root=self.index_root,
            retrieval_models=["bm25", "bm25_hashed_vector"],
            top_k=3,
            gate_hit=0.0,
            gate_mrr=0.0,
        )
        self.assertIn("bm25", report["models"])
        self.assertIn("bm25_hashed_vector", report["models"])
        for summary in report["models"].values():
            self.assertEqual(summary["total"], 3)
            self.assertGreater(summary["hit_at_k"], 0.0)
            self.assertLessEqual(summary["hit_at_k"], 1.0)
            self.assertGreaterEqual(summary["mrr"], 0.0)

    def test_gate_failure_when_threshold_too_high(self) -> None:
        report = eval_retrieval.run_evaluation(
            eval_path=self.eval_path,
            index_root=self.index_root,
            retrieval_models=["bm25"],
            top_k=3,
            gate_hit=0.99,
            gate_mrr=0.99,
        )
        self.assertFalse(report["overall_passes_gate"])
        self.assertFalse(report["models"]["bm25"]["passes_gate"])

    def test_misses_are_recorded_for_unsatisfiable_examples(self) -> None:
        report = eval_retrieval.run_evaluation(
            eval_path=self.eval_path,
            index_root=self.index_root,
            retrieval_models=["bm25"],
            top_k=3,
            gate_hit=0.0,
            gate_mrr=0.0,
        )
        misses = report["models"]["bm25"]["misses"]
        self.assertTrue(any(m["id"] == "unsatisfiable" for m in misses))

    def test_unknown_retrieval_model_is_skipped(self) -> None:
        report = eval_retrieval.run_evaluation(
            eval_path=self.eval_path,
            index_root=self.index_root,
            retrieval_models=["bm25", "nope"],
            top_k=3,
            gate_hit=0.0,
            gate_mrr=0.0,
        )
        self.assertNotIn("nope", report["models"])
        self.assertIn("bm25", report["models"])


if __name__ == "__main__":
    unittest.main()
