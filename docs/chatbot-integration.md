# Chatbot Integration Guide

## Service context (AI agents)

**Docs-chatbot service AI README (source of truth, no clone required):**  
https://raw.githubusercontent.com/Rodney-Codes/docs-chatbot/main/AI_README.md

**Production API (Render):** https://docs-chatbot-ku9h.onrender.com  
- Health: https://docs-chatbot-ku9h.onrender.com/health  
- Swagger: https://docs-chatbot-ku9h.onrender.com/docs

## Current status

- **Portfolio:** AMA widget re-enabled with **health-gated** mount (hidden until Render `/health` OK).
- **Artifacts:** `chatbot/index.<profile_id>.json` (browser fallback) + `chatbot/chunks.json` (API Pattern A) published on GitHub Pages.
- **Hosted API:** [docs-chatbot](https://github.com/Rodney-Codes/docs-chatbot) on **Render** (free). See **`docs/render-chatbot-setup.md`** for deploy steps.
- **This repo owns:** content, corpus build, portfolio widget, CI wiring.

## Widget behavior

1. Page loads on GitHub Pages (instant).
2. If `VITE_CHATBOT_API_BASE` is set, `GET /health` starts immediately (parallel with site render).
3. AMA bubble **does not appear** until health check passes (avoids typing with no backend).
4. User opens widget → `POST /chat` on warm API; client-side index used as fallback if API answer empty.

## Local development

### Portfolio + optional local API

```bash
cd portfolio
npm install
npm run sync
# optional: .env.local with VITE_CHATBOT_API_BASE=http://localhost:8000
npm run dev
```

### Corpus rebuild

```bash
pip install -e .
python scripts/build_corpus_from_workflow.py
cd portfolio && npm run sync
```

### Standalone docs-chatbot repo

```bash
cd ../docs-chatbot
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Production checklist

1. Deploy docs-chatbot to Render (`docs/render-chatbot-setup.md`).
2. Set GitHub Actions variables: `VITE_CHATBOT_API_BASE`, `VITE_CHATBOT_CORPUS_ID`, etc.
3. Push to `main` — CI builds corpus + deploys Pages with chatbot artifacts.
4. Smoke-test `/health`, Pages `chunks.json`, gated widget, `/chat`.

## Q&A logging and feedback (optional)

When the API runs with `CHAT_LOG_ENABLED=true`, exchanges are kept in-memory for the process only.

- `python -m scripts.eval_retrieval --eval data/eval/retrieval_eval.json --index-root data/index`
- `.github/workflows/chatbot-improvement.yml` — weekly retrieval eval (offline).
