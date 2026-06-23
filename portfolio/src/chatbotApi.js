import {
  CHATBOT_ALLOW_FALLBACK,
  CHATBOT_ANSWER_METHOD,
  CHATBOT_ANSWER_METHOD_ALLOWED,
  CHATBOT_API_BASE,
  CHATBOT_CORPUS_ID,
  CHATBOT_HEALTH_ATTEMPT_MS,
  CHATBOT_HEALTH_TIMEOUT_MS,
  CHATBOT_RETRIEVAL_MODEL,
  CHATBOT_RETRIEVAL_MODEL_ALLOWED,
} from "./chatbotConfig.js";

const AMA_SESSION_STORAGE_KEY = "pi_ama_session_id:v1";

export function getOrCreateSessionId() {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    const existing = window.sessionStorage.getItem(AMA_SESSION_STORAGE_KEY);
    if (existing && existing.trim()) {
      return existing.trim();
    }
    const fresh = `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(AMA_SESSION_STORAGE_KEY, fresh);
    return fresh;
  } catch (_error) {
    return `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function fetchHealthOnce() {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), CHATBOT_HEALTH_ATTEMPT_MS);
  try {
    const response = await fetch(`${CHATBOT_API_BASE}/health`, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      return false;
    }
    const payload = await response.json();
    return payload?.status === "ok";
  } catch (error) {
    console.debug("[AMA] health check attempt failed:", error);
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Poll until the hosted chatbot API responds OK (wakes Render on first request).
 * Returns false if the deadline passes — caller should keep the widget hidden.
 */
export async function waitForChatbotReady() {
  if (!CHATBOT_API_BASE) {
    return true;
  }
  const deadline = Date.now() + CHATBOT_HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const ready = await fetchHealthOnce();
    if (ready) {
      return true;
    }
    if (Date.now() >= deadline) {
      break;
    }
    await sleep(2000);
  }
  return false;
}

export async function queryBackendChat(question, sessionId) {
  if (!CHATBOT_API_BASE) {
    return null;
  }
  const payload = {
    query: question,
    corpus_id: CHATBOT_CORPUS_ID,
    top_k: 3,
    min_score: 0.0,
    allow_fallback: CHATBOT_ALLOW_FALLBACK,
  };
  if (sessionId) {
    payload.session_id = sessionId;
  }
  if (CHATBOT_ANSWER_METHOD && CHATBOT_ANSWER_METHOD_ALLOWED.has(CHATBOT_ANSWER_METHOD)) {
    payload.answer_method = CHATBOT_ANSWER_METHOD;
  }
  if (
    CHATBOT_RETRIEVAL_MODEL &&
    CHATBOT_RETRIEVAL_MODEL_ALLOWED.has(CHATBOT_RETRIEVAL_MODEL)
  ) {
    payload.retrieval_model = CHATBOT_RETRIEVAL_MODEL;
  }
  const response = await fetch(`${CHATBOT_API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Backend chat failed (${response.status})`);
  }
  return response.json();
}

export async function submitChatFeedback({ eventId, sessionId, rating, comment }) {
  if (!CHATBOT_API_BASE || !eventId) {
    return { accepted: false };
  }
  const payload = {
    event_id: eventId,
    rating,
    comment: comment || "",
  };
  if (sessionId) {
    payload.session_id = sessionId;
  }
  try {
    const response = await fetch(`${CHATBOT_API_BASE}/chat/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      return { accepted: false };
    }
    return await response.json();
  } catch (_error) {
    return { accepted: false };
  }
}

export async function loadChatbotIndex(chatbotIndexFile) {
  const base = import.meta.env.BASE_URL || "/";
  const bustParam = import.meta.env.VITE_SITE_DATA_BUST
    ? `?v=${encodeURIComponent(String(import.meta.env.VITE_SITE_DATA_BUST))}`
    : "";
  const indexUrl = `${base}${chatbotIndexFile}${bustParam}`;
  const response = await fetch(indexUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load ${chatbotIndexFile} (${response.status})`);
  }
  return response.json();
}
