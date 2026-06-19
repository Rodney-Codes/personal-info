# Chatbot Integration Guide

## Current status (paused)

- **Portfolio site:** no AMA widget, no `VITE_CHATBOT_*` env vars, no static `public/chatbot/` index from sync.
- **Hosted API:** no production backend (Render deployment retired). Do not point the site at a public chatbot URL until integration is re-enabled deliberately.
- **This repo still owns:** resume/portfolio content, `content/chatbot_faq.md`, corpus build scripts, and optional local API code under `src/docs_chatbot_service/`.
- **Standalone service repo:** [Rodney-Codes/docs-chatbot](https://github.com/Rodney-Codes/docs-chatbot) — run locally for API/HF experiments; not required for the live portfolio.

## Scope when re-enabled

- Retrieval-first chatbot (cloud LLM optional on the backend only, not required for static NLP fallback).
- App-specific corpus artifacts in this repo (`data/index/...`, FAQ markdown).
- Portfolio widget + optional backend in `docs-chatbot` (host TBD when you confirm).

## Local development (optional)

### Portfolio (site only)

```bash
cd portfolio
npm install
npm run sync
npm run dev
```

### In-repo API (legacy / parity with docs-chatbot)

```bash
pip install -e .
python scripts/build_corpus_from_workflow.py
uvicorn docs_chatbot_service.main:app --reload
```

### Standalone docs-chatbot repo

```bash
cd ../docs-chatbot
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Re-integration checklist (when you confirm)

1. Improve corpus (FAQ, chunks, eval) in this repo.
2. Choose a host for `docs-chatbot` (or client-only AMA with no host).
3. Re-add portfolio sync/index + AMA UI if using a backend or static index.
4. Set CORS on the API for `https://rodney-codes.github.io` (or your Pages origin).
5. Smoke-test `/health`, `/search`, `/chat` before shipping.

## Q&A logging and feedback (optional backend)

When a backend runs with `CHAT_LOG_ENABLED=true`, exchanges are kept in an in-memory store for the current process (tests and local debugging). There is no external database.

- `python -m scripts.eval_retrieval --eval data/eval/retrieval_eval.json --index-root data/index`
- `.github/workflows/chatbot-improvement.yml` — weekly retrieval eval report (offline only).
