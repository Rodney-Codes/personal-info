from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = REPO_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from docs_chatbot_service.api import app as app_module


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


class ApiContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.index_root = Path(self.tmp.name) / "index"
        corpus_dir = self.index_root / "portfolio-v1"
        corpus_dir.mkdir(parents=True, exist_ok=True)
        (corpus_dir / "chunks.json").write_text(json.dumps(SAMPLE_CHUNKS), encoding="utf-8")
        app_module.service = app_module.RetrievalService(index_root=self.index_root)
        self.client = TestClient(app_module.app)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_search_contract_shape(self) -> None:
        response = self.client.post(
            "/search",
            json={
                "query": "chatbot projects",
                "corpus_id": "portfolio-v1",
                "doc_ids": ["projects", "skills"],
                "top_k": 5,
                "min_score": 0.0,
            },
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["query"], "chatbot projects")
        self.assertEqual(payload["corpus_id"], "portfolio-v1")
        self.assertIn("total_results", payload)
        self.assertIsInstance(payload["results"], list)
        self.assertGreaterEqual(len(payload["results"]), 1)

        result = payload["results"][0]
        self.assertEqual(
            set(result.keys()),
            {"chunk_id", "doc_id", "title", "section", "source", "snippet", "score"},
        )

    def test_search_missing_corpus_is_404(self) -> None:
        response = self.client.post("/search", json={"query": "x1", "corpus_id": "missing"})
        self.assertEqual(response.status_code, 404)

    def test_search_validation_is_422(self) -> None:
        response = self.client.post("/search", json={"query": "a", "top_k": 100})
        self.assertEqual(response.status_code, 422)

    def test_corpora_endpoints_contract(self) -> None:
        list_response = self.client.get("/corpora")
        self.assertEqual(list_response.status_code, 200)
        item = list_response.json()[0]
        self.assertEqual(set(item.keys()), {"corpus_id", "total_chunks", "total_docs"})

        one_response = self.client.get("/corpora/portfolio-v1")
        self.assertEqual(one_response.status_code, 200)
        self.assertEqual(one_response.json()["corpus_id"], "portfolio-v1")

        missing_response = self.client.get("/corpora/missing")
        self.assertEqual(missing_response.status_code, 404)

        exists_response = self.client.get("/corpora/portfolio-v1/exists")
        self.assertEqual(exists_response.status_code, 200)
        self.assertEqual(exists_response.json(), {"corpus_id": "portfolio-v1", "exists": True})

    def test_chat_endpoint_contract(self) -> None:
        response = self.client.post(
            "/chat",
            json={
                "query": "chatbot projects",
                "corpus_id": "portfolio-v1",
                "top_k": 3,
                "min_score": 0.0,
            },
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["query"], "chatbot projects")
        self.assertEqual(payload["corpus_id"], "portfolio-v1")
        self.assertIn("answer", payload)
        self.assertIn("source", payload)
        self.assertIn("used_hf", payload)


if __name__ == "__main__":
    unittest.main()

