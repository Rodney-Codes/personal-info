from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = REPO_ROOT / "src"
SCRIPTS_ROOT = REPO_ROOT / "scripts"
for p in (SRC_ROOT, SCRIPTS_ROOT, REPO_ROOT):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

from docs_chatbot_service.core.chat_log_store import (  # noqa: E402
    ChatEventRecord,
    ChatFeedbackRecord,
    new_event_id,
    reset_store_for_tests,
)

import scripts.analyze_chat_logs as analyzer  # noqa: E402


class AnalyzeChatLogsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.store = reset_store_for_tests()
        self._seed_dataset()

    def tearDown(self) -> None:
        pass

    def _seed_dataset(self) -> None:
        # Successful answer with high confidence.
        good_id = new_event_id()
        self.store.insert_event(
            ChatEventRecord(
                event_id=good_id,
                session_id="s-1",
                corpus_id="default",
                query="what python skills do you have",
                answer="Strong Python and FastAPI.",
                source="/skills.md",
                method="hugging_face",
                retrieval_model="bm25_hashed_vector",
                used_hf=True,
                top_k=3,
                min_score=0.0,
                allow_fallback=True,
                latency_ms=42,
                bucket="hf",
                info={
                    "score_stats": {"max": 0.81, "min": 0.20, "mean": 0.50, "count": 3},
                    "top_results": [{"chunk_id": "skills-1", "score": 0.81}],
                },
            )
        )
        # Low confidence answer (below threshold).
        weak_id = new_event_id()
        self.store.insert_event(
            ChatEventRecord(
                event_id=weak_id,
                session_id="s-2",
                corpus_id="default",
                query="how is your kubernetes experience",
                answer="Some exposure to containers.",
                source="/experience.md",
                method="lightweight_nlp",
                retrieval_model="bm25",
                used_hf=False,
                top_k=3,
                min_score=0.0,
                allow_fallback=True,
                latency_ms=15,
                bucket="nlp",
                info={
                    "score_stats": {"max": 0.05, "min": 0.0, "mean": 0.02, "count": 3},
                    "top_results": [{"chunk_id": "exp-1", "score": 0.05}],
                },
            )
        )
        # Failed query (no results).
        self.store.insert_event(
            ChatEventRecord(
                event_id=new_event_id(),
                session_id="s-3",
                corpus_id="default",
                query="zzzzz unknown",
                answer="I could not find a grounded answer in the current portfolio documents.",
                source="",
                method="none",
                retrieval_model="bm25_hashed_vector",
                used_hf=False,
                top_k=3,
                min_score=0.0,
                allow_fallback=True,
                latency_ms=8,
                bucket="no_results",
                info={"score_stats": {"max": 0.0, "min": 0.0, "mean": 0.0, "count": 0}},
            )
        )
        # Add positive feedback for the good event, negative for the weak event.
        self.store.insert_feedback(
            ChatFeedbackRecord(
                event_id=good_id,
                session_id="s-1",
                rating=1,
                bucket="positive",
                comment="great",
            )
        )
        self.store.insert_feedback(
            ChatFeedbackRecord(
                event_id=weak_id,
                session_id="s-2",
                rating=-1,
                bucket="negative",
                comment="not what I asked",
            )
        )

    def test_build_report_summarizes_events_and_feedback(self) -> None:
        report = analyzer.build_report_from_rows(
            events=self.store.fetch_recent_events(limit=1000),
            feedback=self.store.fetch_recent_feedback(limit=1000),
            source_label="in_memory_test",
            since_days=0,
            threshold=0.20,
            max_samples=10,
        )
        self.assertEqual(report["totals"]["events"], 3)
        self.assertEqual(report["totals"]["feedback"], 2)
        self.assertEqual(report["buckets"].get("no_results", 0), 1)
        self.assertEqual(report["feedback_summary"]["by_bucket"]["positive"], 1)
        self.assertEqual(report["feedback_summary"]["by_bucket"]["negative"], 1)

    def test_build_report_surfaces_low_confidence_and_failed_samples(self) -> None:
        report = analyzer.build_report_from_rows(
            events=self.store.fetch_recent_events(limit=1000),
            feedback=self.store.fetch_recent_feedback(limit=1000),
            source_label="in_memory_test",
            since_days=0,
            threshold=0.20,
            max_samples=10,
        )
        failed = report["samples"]["failed_queries"]
        low_conf = report["samples"]["low_confidence_queries"]
        positives = report["samples"]["positive_examples"]
        negatives = report["samples"]["negative_examples"]
        self.assertTrue(any("zzzzz" in s["query"] for s in failed))
        self.assertTrue(any("kubernetes" in s["query"] for s in low_conf))
        self.assertTrue(any("python" in p["query"] for p in positives))
        self.assertTrue(any("kubernetes" in n["query"] for n in negatives))

    def test_build_report_emits_recommendations(self) -> None:
        report = analyzer.build_report_from_rows(
            events=self.store.fetch_recent_events(limit=1000),
            feedback=self.store.fetch_recent_feedback(limit=1000),
            source_label="in_memory_test",
            since_days=0,
            threshold=0.20,
            max_samples=10,
        )
        recs = report["recommendations"]
        self.assertIn("suggestions", recs)
        self.assertGreater(recs["failed_query_count"], 0)
        self.assertGreater(recs["low_confidence_count"], 0)
        self.assertIsInstance(recs["frequent_tokens_in_low_quality_queries"], list)

    def test_build_report_writes_json_file(self) -> None:
        report = analyzer.build_report_from_rows(
            events=self.store.fetch_recent_events(limit=1000),
            feedback=self.store.fetch_recent_feedback(limit=1000),
            source_label="in_memory_test",
            since_days=0,
            threshold=0.20,
            max_samples=10,
        )
        out_path = REPO_ROOT / "data" / "chat_reports" / "test_report.json"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        roundtrip = json.loads(out_path.read_text(encoding="utf-8"))
        self.assertEqual(roundtrip["totals"]["events"], 3)
        out_path.unlink(missing_ok=True)


if __name__ == "__main__":
    unittest.main()
