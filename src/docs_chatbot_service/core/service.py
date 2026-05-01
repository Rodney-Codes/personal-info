from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import List, Optional

from docs_chatbot_service.core.search import BM25SearchEngine
from docs_chatbot_service.core.storage import CorpusStat, IndexStorage
from docs_chatbot_service.core.vector_search import HashedVectorIndex, build_hybrid_score


@dataclass(frozen=True)
class SearchParams:
    query: str
    corpus_id: str
    doc_ids: Optional[List[str]]
    top_k: int
    min_score: float


class RetrievalService:
    def __init__(self, index_root: Path) -> None:
        self._storage = IndexStorage(index_root=index_root)

    def corpus_exists(self, corpus_id: str) -> bool:
        return self._storage.exists(corpus_id)

    def list_corpora(self) -> List[CorpusStat]:
        return self._storage.list_corpora()

    def get_corpus_stats(self, corpus_id: str) -> CorpusStat:
        for stat in self._storage.list_corpora():
            if stat.corpus_id == corpus_id:
                return stat
        raise FileNotFoundError(f"Corpus not found: {corpus_id}")

    @lru_cache(maxsize=32)
    def _load_corpus(
        self, corpus_id: str
    ) -> tuple[List[dict], BM25SearchEngine, Optional[HashedVectorIndex]]:
        chunks = self._storage.load_chunks(corpus_id)
        engine = BM25SearchEngine(chunks)
        vector_index: Optional[HashedVectorIndex] = None
        if self._storage.vector_index_exists(corpus_id):
            vector_index = HashedVectorIndex.load(self._storage.vector_index_path(corpus_id))
        return chunks, engine, vector_index

    def search(self, params: SearchParams) -> List[dict]:
        chunks, engine, vector_index = self._load_corpus(params.corpus_id)
        allowed_docs = set(params.doc_ids or [])
        has_filter = bool(params.doc_ids)

        scored_results: List[dict] = []
        for chunk in chunks:
            if has_filter and chunk.get("doc_id") not in allowed_docs:
                continue
            bm25_score = engine.score(params.query, chunk)
            vector_score = (
                vector_index.score(params.query, chunk["chunk_id"]) if vector_index else 0.0
            )
            score = (
                build_hybrid_score(bm25_score=bm25_score, vector_score=vector_score)
                if vector_index
                else bm25_score
            )
            if score < params.min_score:
                continue

            scored_results.append(
                {
                    "chunk_id": chunk["chunk_id"],
                    "doc_id": chunk["doc_id"],
                    "title": chunk.get("title", ""),
                    "section": chunk.get("section", "general"),
                    "source": chunk.get("source", ""),
                    "snippet": chunk.get("text", ""),
                    "score": float(score),
                }
            )

        scored_results.sort(key=lambda item: item["score"], reverse=True)
        return scored_results[: params.top_k]

