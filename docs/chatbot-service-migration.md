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
- Retired portfolio ↔ hosted API wiring (AMA UI removed; no `VITE_CHATBOT_*` in Pages build).
- Retired Render as the production chatbot host (service to be deleted or left suspended in Render dashboard).

## Current behavior

- Standalone service source of truth is `docs-chatbot` repo (local dev only until a new host is chosen).
- This `personal-info` repo is the app/content owner; live site is portfolio-only.
- Chatbot artifacts (`content/chatbot_faq.md`, `data/index/...`) remain for future load via:
  - `POST /corpora/load`, or
  - `chunks_url` / `vector_index_url` on `/search` and `/chat`.

## Next steps (when re-enabling)

1. Finalize corpus/FAQ and retrieval eval in this repo.
2. Decide integration shape: client-only AMA vs hosted `docs-chatbot` (host TBD — not Render unless you explicitly choose it again).
3. Re-add portfolio widget and sync/index generation if needed.
4. Run smoke checks: `/health`, `/search`, `/chat` against the chosen deployment.
