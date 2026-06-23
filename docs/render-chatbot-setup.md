# Render + GitHub Pages AMA setup

Pattern A integration: corpus artifacts on **GitHub Pages**, chatbot API on **Render free tier**, AMA widget **hidden until `/health` succeeds**.

**Docs-chatbot service AI README:** https://raw.githubusercontent.com/Rodney-Codes/docs-chatbot/main/AI_README.md

**Production API:** https://docs-chatbot-ku9h.onrender.com

## Architecture

```
CI builds corpus → portfolio/dist/chatbot/chunks.json (Pages)
                 → portfolio/dist/chatbot/index.main_release.json (browser fallback)

Visitor opens Pages → GET /health (wake Render) → widget appears → POST /chat
```

## What you need to provide

### 1. Render account (free, no card)

1. Sign in at [render.com](https://render.com).
2. **New → Web Service** from repo [Rodney-Codes/docs-chatbot](https://github.com/Rodney-Codes/docs-chatbot).
3. Settings:
   - **Environment:** Docker (or Python if using their buildpack; Docker is recommended).
   - **Instance type:** Free.
   - **Health check path:** `/health`
   - **Start command (if not Docker):** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

4. **Environment variables** on Render:

| Variable | Value |
|----------|--------|
| `CHATBOT_AUTO_INGEST` | `false` |
| `CHATBOT_DEFAULT_CORPUS_ID` | `default` |
| `CHATBOT_CHUNKS_URL` | `https://rodney-codes.github.io/personal-info/chatbot/chunks.json` |
| `CHATBOT_VECTOR_INDEX_URL` | `https://rodney-codes.github.io/personal-info/chatbot/vector_index.json` |
| `CHAT_ALLOW_FALLBACK` | `true` |
| `HF_API_ENABLED` | `false` |
| `CORS_ALLOW_ORIGINS` | `https://rodney-codes.github.io` |

After the first **portfolio deploy** with chatbot artifacts, confirm those URLs return JSON in a browser.

5. Production URL (this deployment): `https://docs-chatbot-ku9h.onrender.com` (no trailing slash).

### 2. GitHub repository variables (personal-info)

In **Settings → Secrets and variables → Actions → Variables**, add:

| Variable | Example |
|----------|---------|
| `VITE_CHATBOT_API_BASE` | `https://docs-chatbot-ku9h.onrender.com` |
| `VITE_CHATBOT_CORPUS_ID` | `default` |
| `VITE_CHATBOT_ALLOW_FALLBACK` | `true` |
| `VITE_CHATBOT_ANSWER_METHOD` | `lightweight_nlp` |

Optional: leave `VITE_CHATBOT_RETRIEVAL_MODEL` empty to use API default (`bm25_hashed_vector`).

Push to `main` — the Portfolio workflow builds corpus, syncs chatbot files, and bakes `VITE_CHATBOT_*` into the Pages bundle.

### 3. Local development (optional)

```bash
# Terminal 1 — API (from docs-chatbot repo or this repo)
pip install -r requirements.txt
python scripts/build_corpus_from_workflow.py   # in personal-info
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Terminal 2 — portfolio
cd portfolio
cp .env.example .env.local
# Set VITE_CHATBOT_API_BASE=http://localhost:8000
npm run sync
npm run dev
```

With `VITE_CHATBOT_API_BASE` set locally, the widget waits for `/health` then mounts. With it empty, the widget mounts immediately (client-only fallback).

## Smoke test checklist

After deploy:

1. `GET https://<render-host>/health` → `{"status":"ok"}`
2. `GET https://rodney-codes.github.io/personal-info/chatbot/chunks.json` → JSON array
3. Open portfolio — **no AMA button for ~30–60s** if Render was cold, then button appears
4. Ask a question — answer returns within a few seconds
5. Browser devtools: no CORS errors on `/health` or `/chat`

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Widget never appears | Render still waking or health timeout; check `/health` URL and CORS |
| CORS error | Add exact Pages origin to `CORS_ALLOW_ORIGINS` on Render |
| `method: none` answers | Set `CHAT_ALLOW_FALLBACK=true` on Render |
| `404 Corpus not found` | Check `CHATBOT_CHUNKS_URL` loads; restart Render after Pages deploy |
| Widget on local but not prod | Set GitHub Actions variable `VITE_CHATBOT_API_BASE` |

## Notes

- Portfolio stays on **GitHub Pages** (not Render). Only the chatbot API uses Render.
- Render free tier spins down after 15 minutes idle; the first visitor triggers wake-up. The widget stays hidden until wake completes.
- Corpus updates: edit resume/portfolio/FAQ → push to `main` → CI rebuilds `chunks.json` on Pages → Render reloads corpus on next cold start (or manual redeploy).
