/** Build-time chatbot / AMA settings (Vite env). */

export const CHATBOT_API_BASE = String(import.meta.env.VITE_CHATBOT_API_BASE || "")
  .trim()
  .replace(/\/+$/, "");

export const CHATBOT_CORPUS_ID = String(
  import.meta.env.VITE_CHATBOT_CORPUS_ID || "default",
).trim();

export const CHATBOT_ALLOW_FALLBACK =
  String(import.meta.env.VITE_CHATBOT_ALLOW_FALLBACK || "true")
    .trim()
    .toLowerCase() !== "false";

export const CHATBOT_ANSWER_METHOD = String(
  import.meta.env.VITE_CHATBOT_ANSWER_METHOD || "",
).trim();

export const CHATBOT_ANSWER_METHOD_ALLOWED = new Set([
  "hugging_face_lightweight_nlp",
  "hugging_face",
  "lightweight_nlp",
]);

export const CHATBOT_RETRIEVAL_MODEL = String(
  import.meta.env.VITE_CHATBOT_RETRIEVAL_MODEL || "",
).trim();

export const CHATBOT_RETRIEVAL_MODEL_ALLOWED = new Set([
  "bm25",
  "hashed_vector",
  "bm25_hashed_vector",
  "rule_lexicon_tfidf",
]);

/** Max time to wait for Render cold start before hiding the widget. */
export const CHATBOT_HEALTH_TIMEOUT_MS = Number(
  import.meta.env.VITE_CHATBOT_HEALTH_TIMEOUT_MS || 180000,
);

/** Per-attempt fetch timeout (single wake request can take ~60–90s on Render free). */
export const CHATBOT_HEALTH_ATTEMPT_MS = Number(
  import.meta.env.VITE_CHATBOT_HEALTH_ATTEMPT_MS || 120000,
);
