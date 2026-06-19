from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = REPO_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from fastapi.testclient import TestClient

from docs_chatbot_service.api import app as app_module
from docs_chatbot_service.core import chat_log_store as cls_module
from docs_chatbot_service.core.chat_log_store import (
    ChatEventRecord,
    ChatFeedbackRecord,
    new_event_id,
)


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
]


class ChatLogStoreUnitTests(unittest.TestCase):
    def setUp(self) -> None:
        self.store = cls_module.reset_store_for_tests()

    def tearDown(self) -> None:
        cls_module._GLOBAL_STORE = None

    def test_insert_event_persists_required_columns(self) -> None:
        event_id = new_event_id()
        record = ChatEventRecord(
            event_id=event_id,
            session_id="sess-1",
            corpus_id="portfolio-v1",
            query="what are your skills?",
            answer="I work on data systems.",
            source="/skills.md",
            method="lightweight_nlp",
            retrieval_model="bm25_hashed_vector",
            used_hf=False,
            top_k=3,
            min_score=0.0,
            allow_fallback=True,
            latency_ms=12,
            category="chat",
            bucket="nlp",
            info={"top_results": [{"chunk_id": "skills-1", "score": 0.42}]},
        )
        self.store.insert_event(record)

        events = self.store.fetch_recent_events()
        self.assertEqual(len(events), 1)
        row = events[0]
        for col in {
            "id",
            "event_id",
            "session_id",
            "corpus_id",
            "category",
            "bucket",
            "info",
            "created_at",
            "updated_at",
        }:
            self.assertIn(col, row)
        self.assertEqual(row["event_id"], event_id)
        self.assertEqual(row["category"], "chat")
        self.assertEqual(row["bucket"], "nlp")
        info = json.loads(row["info"])
        self.assertEqual(info["top_results"][0]["chunk_id"], "skills-1")

    def test_insert_feedback_links_to_event(self) -> None:
        event_id = new_event_id()
        self.store.insert_event(
            ChatEventRecord(
                event_id=event_id,
                session_id="sess-2",
                corpus_id="portfolio-v1",
                query="any python?",
                answer="Yes, advanced Python.",
                source="/skills.md",
                method="lightweight_nlp",
                retrieval_model="bm25_hashed_vector",
                used_hf=False,
                top_k=3,
                min_score=0.0,
                allow_fallback=True,
                latency_ms=9,
            )
        )

        self.assertTrue(self.store.event_exists(event_id))
        self.assertFalse(self.store.event_exists("nonexistent"))

        self.store.insert_feedback(
            ChatFeedbackRecord(
                event_id=event_id,
                session_id="sess-2",
                rating=1,
                comment="Spot on",
                bucket="positive",
            )
        )
        feedback = self.store.fetch_recent_feedback()
        self.assertEqual(len(feedback), 1)
        self.assertEqual(feedback[0]["event_id"], event_id)
        self.assertEqual(feedback[0]["rating"], 1)
        self.assertEqual(feedback[0]["bucket"], "positive")


class ChatLogApiTests(unittest.TestCase):
    """Exercise /chat and /chat/feedback with isolated in-memory store."""

    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.index_root = Path(self.tmp.name) / "index"
        corpus_dir = self.index_root / "portfolio-v1"
        corpus_dir.mkdir(parents=True, exist_ok=True)
        (corpus_dir / "chunks.json").write_text(json.dumps(SAMPLE_CHUNKS), encoding="utf-8")
        app_module.service = app_module.RetrievalService(index_root=self.index_root)

        self.store = cls_module.reset_store_for_tests()

        self.client = TestClient(app_module.app)

    def tearDown(self) -> None:
        cls_module._GLOBAL_STORE = None
        self.tmp.cleanup()

    def test_chat_response_includes_event_and_session(self) -> None:
        response = self.client.post(
            "/chat",
            json={
                "query": "chatbot projects",
                "corpus_id": "portfolio-v1",
                "top_k": 3,
                "min_score": 0.0,
                "allow_fallback": True,
                "answer_method": "lightweight_nlp",
                "session_id": "client-sess-1",
            },
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["event_id"])
        self.assertEqual(payload["session_id"], "client-sess-1")

        events = self.store.fetch_recent_events()
        self.assertEqual(len(events), 1)
        stored = events[0]
        self.assertEqual(stored["event_id"], payload["event_id"])
        self.assertEqual(stored["session_id"], "client-sess-1")
        self.assertEqual(stored["corpus_id"], "portfolio-v1")
        self.assertEqual(stored["category"], "chat")
        self.assertIn(stored["bucket"], {"hf", "nlp", "no_results", "none"})
        self.assertGreaterEqual(stored["latency_ms"], 0)

    def test_chat_logs_no_results_bucket_when_query_is_unrelated(self) -> None:
        response = self.client.post(
            "/chat",
            json={
                "query": "zzzz xyz",
                "corpus_id": "portfolio-v1",
                "top_k": 3,
                "min_score": 9999.0,
                "allow_fallback": True,
                "answer_method": "lightweight_nlp",
            },
        )
        self.assertEqual(response.status_code, 200)
        events = self.store.fetch_recent_events()
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["bucket"], "no_results")
        self.assertEqual(events[0]["method"], "none")

    def test_feedback_endpoint_persists_record_for_known_event(self) -> None:
        chat_response = self.client.post(
            "/chat",
            json={
                "query": "python",
                "corpus_id": "portfolio-v1",
                "top_k": 3,
                "min_score": 0.0,
                "allow_fallback": True,
                "answer_method": "lightweight_nlp",
            },
        )
        event_id = chat_response.json()["event_id"]

        for rating, expected_bucket in ((1, "positive"), (-1, "negative"), (0, "neutral")):
            feedback_response = self.client.post(
                "/chat/feedback",
                json={
                    "event_id": event_id,
                    "rating": rating,
                    "comment": f"rating={rating}",
                },
            )
            self.assertEqual(feedback_response.status_code, 200, feedback_response.text)
            payload = feedback_response.json()
            self.assertTrue(payload["accepted"])
            self.assertEqual(payload["bucket"], expected_bucket)

        rows = self.store.fetch_recent_feedback()
        self.assertEqual(len(rows), 3)
        self.assertEqual({row["bucket"] for row in rows}, {"positive", "negative", "neutral"})

    def test_feedback_endpoint_404_for_unknown_event(self) -> None:
        response = self.client.post(
            "/chat/feedback",
            json={"event_id": "does-not-exist", "rating": 1},
        )
        self.assertEqual(response.status_code, 404)

    def test_feedback_endpoint_validation_is_422(self) -> None:
        response = self.client.post(
            "/chat/feedback",
            json={"event_id": "x", "rating": 5},
        )
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
