from __future__ import annotations

import json
import os
from pathlib import Path
from typing import List, Optional
from urllib import error, request

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from docs_chatbot_service.core.service import RetrievalService, SearchParams

INDEX_ROOT = Path("data/index")
app = FastAPI(title="Docs Chatbot Service")
service = RetrievalService(index_root=INDEX_ROOT)

cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOW_ORIGINS", "").split(",")
    if origin.strip()
]
if cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=2)
    corpus_id: str = Field(default="default")
    doc_ids: Optional[List[str]] = None
    top_k: int = Field(default=5, ge=1, le=20)
    min_score: float = Field(default=0.0, ge=0.0)


class SearchResult(BaseModel):
    chunk_id: str
    doc_id: str
    title: str
    section: str
    source: str
    snippet: str
    score: float


class SearchResponse(BaseModel):
    query: str
    corpus_id: str
    total_results: int
    results: List[SearchResult]


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=2)
    corpus_id: str = Field(default="default")
    doc_ids: Optional[List[str]] = None
    top_k: int = Field(default=3, ge=1, le=20)
    min_score: float = Field(default=0.0, ge=0.0)


class ChatResponse(BaseModel):
    query: str
    corpus_id: str
    answer: str
    source: str
    used_hf: bool


class CorpusStatsResponse(BaseModel):
    corpus_id: str
    total_chunks: int
    total_docs: int


class CorpusExistsResponse(BaseModel):
    corpus_id: str
    exists: bool


def _parse_hf_text(payload: object) -> str:
    if isinstance(payload, list) and payload:
        first = payload[0]
        if isinstance(first, str):
            return first.strip()
        if isinstance(first, dict):
            val = first.get("generated_text") or first.get("summary_text")
            return str(val).strip() if val else ""
    if isinstance(payload, dict):
        val = payload.get("generated_text") or payload.get("summary_text")
        return str(val).strip() if val else ""
    return ""


def _generate_with_hf(query: str, results: List[dict]) -> str:
    hf_api_url = os.getenv("HF_API_URL", "").strip()
    hf_api_token = os.getenv("HF_API_TOKEN", "").strip()
    if not hf_api_url:
        return ""

    context = "\n".join(
        [
            f"Context {idx + 1}: {str(item.get('snippet', ''))[:420]}"
            for idx, item in enumerate(results[:3])
        ]
    )
    prompt = "\n".join(
        [
            "Answer the question in 1-2 concise sentences.",
            "Only use facts from context. If unknown, say you do not have enough information.",
            f"Question: {query}",
            context,
            "Answer:",
        ]
    )
    payload = json.dumps(
        {
            "inputs": prompt,
            "parameters": {
                "max_new_tokens": 90,
                "temperature": 0.2,
                "return_full_text": False,
            },
        }
    ).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if hf_api_token:
        headers["Authorization"] = f"Bearer {hf_api_token}"

    req = request.Request(hf_api_url, data=payload, headers=headers, method="POST")
    try:
        with request.urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        text = _parse_hf_text(body)
        return text.replace("Answer:", "").strip()
    except (error.URLError, TimeoutError, ValueError, json.JSONDecodeError):
        return ""


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/search", response_model=SearchResponse)
def search(request: SearchRequest) -> SearchResponse:
    if not service.corpus_exists(request.corpus_id):
        raise HTTPException(status_code=404, detail=f"Corpus not found: {request.corpus_id}")

    results = service.search(
        SearchParams(
            query=request.query,
            corpus_id=request.corpus_id,
            doc_ids=request.doc_ids,
            top_k=request.top_k,
            min_score=request.min_score,
        )
    )
    return SearchResponse(
        query=request.query,
        corpus_id=request.corpus_id,
        total_results=len(results),
        results=[SearchResult(**item) for item in results],
    )


@app.post("/chat", response_model=ChatResponse)
def chat(request_body: ChatRequest) -> ChatResponse:
    if not service.corpus_exists(request_body.corpus_id):
        raise HTTPException(
            status_code=404, detail=f"Corpus not found: {request_body.corpus_id}"
        )
    results = service.search(
        SearchParams(
            query=request_body.query,
            corpus_id=request_body.corpus_id,
            doc_ids=request_body.doc_ids,
            top_k=request_body.top_k,
            min_score=request_body.min_score,
        )
    )
    if not results:
        return ChatResponse(
            query=request_body.query,
            corpus_id=request_body.corpus_id,
            answer="I could not find a grounded answer in the current portfolio documents.",
            source="",
            used_hf=False,
        )

    hf_answer = _generate_with_hf(request_body.query, results)
    top = results[0]
    fallback = str(top.get("snippet", "")).strip()
    answer = hf_answer or fallback
    return ChatResponse(
        query=request_body.query,
        corpus_id=request_body.corpus_id,
        answer=answer,
        source=str(top.get("source", "")),
        used_hf=bool(hf_answer),
    )


@app.get("/corpora", response_model=List[CorpusStatsResponse])
def list_corpora() -> List[CorpusStatsResponse]:
    return [
        CorpusStatsResponse(
            corpus_id=stat.corpus_id,
            total_chunks=stat.total_chunks,
            total_docs=stat.total_docs,
        )
        for stat in service.list_corpora()
    ]


@app.get("/corpora/{corpus_id}", response_model=CorpusStatsResponse)
def get_corpus(corpus_id: str) -> CorpusStatsResponse:
    try:
        stat = service.get_corpus_stats(corpus_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return CorpusStatsResponse(
        corpus_id=stat.corpus_id,
        total_chunks=stat.total_chunks,
        total_docs=stat.total_docs,
    )


@app.get("/corpora/{corpus_id}/exists", response_model=CorpusExistsResponse)
def corpus_exists(corpus_id: str) -> CorpusExistsResponse:
    return CorpusExistsResponse(corpus_id=corpus_id, exists=service.corpus_exists(corpus_id))

