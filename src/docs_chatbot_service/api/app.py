from __future__ import annotations

import json
import os
from pathlib import Path
from typing import List, Optional
from urllib import error, request

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel, Field

from docs_chatbot_service.core.service import RetrievalService, SearchParams

load_dotenv()

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


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() not in {"0", "false", "no", "off"}


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
    allow_fallback: Optional[bool] = Field(default=None)


class ChatResponse(BaseModel):
    query: str
    corpus_id: str
    answer: str
    source: str
    used_hf: bool


NO_ANSWER_MESSAGE = (
    "I'm unable to answer this query, please contact Rohit to get an answer for this query"
)


class CorpusStatsResponse(BaseModel):
    corpus_id: str
    total_chunks: int
    total_docs: int


class CorpusExistsResponse(BaseModel):
    corpus_id: str
    exists: bool


def _tokenize(text: str) -> List[str]:
    return [tok for tok in "".join(c.lower() if c.isalnum() else " " for c in text).split() if tok]


def _detect_intent(tokens: List[str]) -> str:
    token_set = set(tokens)
    if token_set.intersection({"sql", "python", "skills", "skill", "tools", "stack"}):
        return "skills"
    if token_set.intersection({"experience", "years", "worked", "background", "career"}):
        return "experience"
    if token_set.intersection({"project", "projects", "built", "build"}):
        return "projects"
    if token_set.intersection({"education", "degree", "college", "university"}):
        return "education"
    if token_set.intersection({"contact", "email", "linkedin", "github", "reach"}):
        return "contact"
    return "general"


def _extract_best_sentences(text: str, query_tokens: List[str], max_sentences: int = 2) -> List[str]:
    clean = " ".join(text.split()).strip()
    if not clean:
        return []
    sentences = [s.strip() for s in clean.replace("\n", " ").split(". ") if s.strip()]
    if not sentences:
        return []
    scored: List[tuple[int, str]] = []
    for sentence in sentences:
        sentence_tokens = set(_tokenize(sentence))
        score = sum(1 for tok in query_tokens if tok in sentence_tokens)
        scored.append((score, sentence))
    scored.sort(key=lambda item: item[0], reverse=True)
    picked = [s for score, s in scored if score > 0][:max_sentences]
    if picked:
        return picked
    return sentences[:max_sentences]


def _extract_years_value(text: str) -> str:
    import re

    match = re.search(r"(\d+\+?)\s+years?", text, re.IGNORECASE)
    return match.group(1) if match else ""


def _detect_skill_entity(query: str) -> str:
    q = query.lower()
    for skill in ["sql", "python", "aws", "tableau", "power bi", "mongodb", "postgresql", "mysql"]:
        if skill in q:
            return skill
    return ""


def _build_fallback_answer(query: str, results: List[dict]) -> str:
    query_tokens = _tokenize(query)
    intent = _detect_intent(query_tokens)
    asks_years = "year" in query_tokens or "years" in query_tokens
    skill_entity = _detect_skill_entity(query)
    top = results[0]
    second = results[1] if len(results) > 1 else {}

    lines = _extract_best_sentences(str(top.get("snippet", "")), query_tokens, 2)
    if len(lines) < 2 and second:
        lines.extend(_extract_best_sentences(str(second.get("snippet", "")), query_tokens, 1))
    concise = " ".join(lines).strip()
    years_value = _extract_years_value(
        f"{top.get('snippet', '')} {second.get('snippet', '') if second else ''}"
    )

    if asks_years and skill_entity and years_value:
        tech_label = "AWS" if skill_entity.lower() == "aws" else skill_entity.upper()
        evidence = concise or "my portfolio highlights practical hands-on usage in project work."
        return f"I have about {years_value} years of experience working with {tech_label}. {evidence}"[:420]

    prefix_by_intent = {
        "skills": "Based on my profile,",
        "experience": "Based on my experience,",
        "projects": "Based on my projects,",
        "education": "From my education background,",
        "contact": "You can reach me via the details in my profile,",
        "general": "Here is what matches your question,",
    }
    prefix = prefix_by_intent.get(intent, prefix_by_intent["general"])
    if not concise:
        concise = str(top.get("snippet", ""))[:260]
    return f"{prefix} {concise}".strip()[:420]


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


def _extract_chat_completion_text(payload: object) -> str:
    if not isinstance(payload, dict):
        return ""
    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        return ""
    first = choices[0]
    if not isinstance(first, dict):
        return ""
    message = first.get("message")
    if not isinstance(message, dict):
        return ""
    # Some providers return an empty `content` while filling `reasoning_content`.
    # We intentionally prefer user-facing content and only fall back if needed.
    content = str(message.get("content", "")).strip()
    if content:
        return content
    reasoning = str(message.get("reasoning_content", "")).strip()
    return reasoning


def _generate_with_hf(query: str, results: List[dict]) -> str:
    hf_api_url = os.getenv(
        "HF_CHAT_API_URL", "https://router.huggingface.co/v1/chat/completions"
    ).strip()
    hf_api_token = os.getenv("HF_API_TOKEN", "").strip()
    hf_model = os.getenv("HF_MODEL", "").strip()
    hf_model_fallbacks = [
        model.strip()
        for model in os.getenv(
            "HF_MODEL_FALLBACKS", "meta-llama/Llama-3.1-8B-Instruct:novita"
        ).split(",")
        if model.strip()
    ]
    model_candidates = [model for model in [hf_model, *hf_model_fallbacks] if model]
    if not hf_api_url or not model_candidates:
        return ""

    query_tokens = _tokenize(query)
    asks_years = "year" in query_tokens or "years" in query_tokens
    skill_entity = _detect_skill_entity(query)
    combined = " ".join(str(item.get("snippet", "")) for item in results[:2])
    years_value = _extract_years_value(combined)
    has_skill_evidence = bool(skill_entity and skill_entity.lower() in combined.lower())
    concise_hint = _build_fallback_answer(query, results)

    # Provide short, highly relevant evidence lines instead of full chunks.
    evidence_lines: List[str] = []
    for item in results[:3]:
        best = _extract_best_sentences(str(item.get("snippet", "")), query_tokens, 2)
        evidence_lines.extend(best)
    if not evidence_lines:
        evidence_lines = [str(item.get("snippet", ""))[:220] for item in results[:2]]
    context = "\n".join(f"- {line.strip()}" for line in evidence_lines[:6] if line.strip())

    rules: List[str] = [
        "You are an assistant for Rohit's portfolio chatbot.",
        "Answer in first person as Rohit and keep the answer to 1-2 concise sentences.",
        "Default to at most 2 short sentences unless the user explicitly asks for more detail.",
        "Use only the provided evidence. Do not invent facts.",
        "If the evidence clearly supports an answer, do not reply with uncertainty.",
    ]
    if asks_years and skill_entity and years_value and has_skill_evidence:
        tech_label = "AWS" if skill_entity.lower() == "aws" else skill_entity.upper()
        rules.append(
            f"If asked about years with {tech_label}, use the evidence and answer as approximately {years_value} years."
        )
    prompt = "\n".join(
        [
            "\n".join(rules),
            f"Question: {query}",
            "Evidence:",
            context,
            f"Hint: {concise_hint}",
            "Final answer:",
        ]
    )
    headers = {"Content-Type": "application/json"}
    if hf_api_token:
        headers["Authorization"] = f"Bearer {hf_api_token}"

    for model in model_candidates:
        payload = json.dumps(
            {
                "model": model,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
                "stream": False,
                "temperature": 0.2,
                "max_tokens": 120,
            }
        ).encode("utf-8")
        req = request.Request(hf_api_url, data=payload, headers=headers, method="POST")
        try:
            with request.urlopen(req, timeout=15) as resp:
                body = json.loads(resp.read().decode("utf-8"))
            text = _extract_chat_completion_text(body) or _parse_hf_text(body)
            cleaned = text.replace("Answer:", "").strip()
            if cleaned:
                return " ".join(cleaned.split())[:420]
        except (error.URLError, TimeoutError, ValueError, json.JSONDecodeError):
            continue
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
    allow_fallback_env = _env_bool("CHAT_ALLOW_FALLBACK", True)
    allow_fallback = allow_fallback_env
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
            answer=(
                NO_ANSWER_MESSAGE
                if not allow_fallback
                else "I could not find a grounded answer in the current portfolio documents."
            ),
            source="",
            used_hf=False,
        )

    hf_answer = _generate_with_hf(request_body.query, results)
    top = results[0]
    if hf_answer:
        return ChatResponse(
            query=request_body.query,
            corpus_id=request_body.corpus_id,
            answer=hf_answer,
            source=str(top.get("source", "")),
            used_hf=True,
        )

    if not allow_fallback:
        return ChatResponse(
            query=request_body.query,
            corpus_id=request_body.corpus_id,
            answer=NO_ANSWER_MESSAGE,
            source="",
            used_hf=False,
        )

    answer = _build_fallback_answer(request_body.query, results)
    return ChatResponse(
        query=request_body.query,
        corpus_id=request_body.corpus_id,
        answer=answer,
        source=str(top.get("source", "")),
        used_hf=False,
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

