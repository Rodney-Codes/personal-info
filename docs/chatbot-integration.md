# Chatbot Integration Guide

This repo includes the portfolio chatbot and frontend integration in one codebase.

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
- Render backend deployment is supported and recommended for secure Hugging Face token usage.
- Re-run `npm run sync` whenever active workflow content changes.

