# Chatbot Integration Guide

This repo includes portfolio frontend integration. The chatbot service can run either:

- in-repo (legacy/local mode), or
- as standalone service repo: [Rodney-Codes/docs-chatbot](https://github.com/Rodney-Codes/docs-chatbot).

## Scope

- Retrieval-only chatbot (no cloud LLM in the request path)
- Static search index generation during `portfolio` sync
- Portfolio `AMA` floating chat widget integrated in both template paths

## Runtime components

- Static index generator: `portfolio/scripts/sync-site.mjs`
- Optional backend API: `src/docs_chatbot_service/api/app.py` (`/search`, `/chat`)
- Frontend integration:
  - `portfolio/src/main.js` (format1 path)
  - `portfolio/src/format2/upstream/App.tsx` (format2 path)

## Recommended local workflow

1. Configure portfolio env (optional):
   - Copy `portfolio/.env.example` -> `portfolio/.env`
2. (Optional backend mode) run API:
   - `.\.venv\Scripts\python -m uvicorn docs_chatbot_service.main:app --reload`
3. Run portfolio:
   - `cd portfolio && npm run dev`

`npm run sync` now generates a static chatbot index in:

- `portfolio/public/chatbot/index.<profile_id>.json`

And records it in runtime metadata:

- `portfolio/public/workflow.runtime.json` -> `chatbot_index_file`

## Environment variables

- `VITE_SITE_DATA_BUST`:
  - optional cache-busting value for static JSON assets
- `VITE_CHATBOT_API_BASE`:
  - backend API origin (for example `https://your-backend.onrender.com`)
- `VITE_CHATBOT_CORPUS_ID`:
  - corpus ID to query from backend (`default` recommended)

## Deployment notes

- Single GitHub Pages deployment is supported (no runtime API required).
- Standalone chatbot backend deployment is supported and recommended:
  - Set `VITE_CHATBOT_API_BASE` to deployed chatbot API URL.
  - Keep app-specific corpus artifacts in this repo and load them into chatbot service by URL:
    - `POST /corpora/load` (recommended preload step), or
    - `chunks_url` / `vector_index_url` in request payloads.
- Re-run `npm run sync` whenever active workflow content changes.

## Q&A logging and feedback (continuous improvement loop)

The backend persists every chat exchange to Supabase Postgres so we can
analyze quality over time and continuously improve retrieval. There is no LLM
fine-tuning in this loop - it is retrieval-improvement only.

### Storage

- Primary DB: Supabase Postgres (configured via `SUPABASE_DB_URL`).
- Logging can be disabled with `CHAT_LOG_ENABLED=false`.
- Tables:
  - `chat_events` (id, event_id, session_id, corpus_id, category, bucket,
    query, answer, source, method, retrieval_model, used_hf, top_k, min_score,
    allow_fallback, latency_ms, info, created_at, updated_at).
  - `chat_feedback` (id, event_id, session_id, category, bucket, rating,
    comment, info, created_at, updated_at).

### API

- `POST /chat` now returns `event_id` and `session_id` so the UI can submit
  feedback for a specific exchange.
- `POST /chat/feedback` accepts `{ event_id, rating (-1|0|1), comment?,
  session_id? }`. Returns `404` if the `event_id` is unknown.
- The frontend AMA widget renders `Helpful` / `Not helpful` buttons under
  every assistant message (when the backend API is configured).

### Offline analysis

- `python -m scripts.analyze_chat_logs --db-url "$SUPABASE_DB_URL"`
  emits a JSON report under `data/chat_reports/` covering bucket distribution,
  failed/low-confidence queries, retrieval-model quality by feedback, and
  rule-driven tuning suggestions.
- `python -m scripts.eval_retrieval --eval data/eval/retrieval_eval.json
  --index-root data/index` runs the offline retrieval eval set and reports
  hit@k / MRR per retrieval model. Use `--gate-hit-at-k` and `--gate-mrr` to
  enforce a quality gate (exit code 3 on failure).

### Scheduled workflow

- `.github/workflows/chatbot-improvement.yml` runs weekly (and on demand) in
  report-only mode. It executes the eval harness on the committed corpus,
  analyzes chat logs from Supabase when `SUPABASE_DB_URL` is configured as a
  GitHub Actions secret, and uploads JSON reports as a
  `chatbot-improvement-reports` artifact for review. No retrieval config is
  changed automatically.

