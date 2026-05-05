# Chatbot Service Migration Status

## Completed (Phases 1-3)

- Published standalone chatbot repository:
  - [Rodney-Codes/docs-chatbot](https://github.com/Rodney-Codes/docs-chatbot)
- Pushed migration content and deployment hardening commits:
  - `bcd0672` (phase-2 layout migration)
  - `c0e2dde` (Dockerfile, pyproject, gitignore, README and app path fixes)
  - `7d730e3` (artifact URL loading API)
  - `2930159` (AI_README + docs updates)
- Verified standalone tests pass in split repo:
  - `python -m unittest tests.test_api_contracts tests.test_query_nlp -q`
- Removed temporary in-repo migration workspace (`services/chatbot`) from this repository.

## Current behavior

- Standalone service source of truth is `docs-chatbot` repo.
- This `personal-info` repo remains the app/content owner.
- Chatbot artifacts can be kept app-specific in this repo and loaded by URL via:
  - `POST /corpora/load`
  - or `chunks_url` / `vector_index_url` in `/search` and `/chat` requests.

## Next migration steps

1. Deploy `docs-chatbot` service (Render/Railway/Fly.io or container host).
2. Create and populate production corpus/index files for `CHATBOT_INDEX_ROOT`.
3. Set portfolio `VITE_CHATBOT_API_BASE` to deployed service URL.
4. Run smoke checks: `/health`, `/search`, `/chat` against production corpus.
