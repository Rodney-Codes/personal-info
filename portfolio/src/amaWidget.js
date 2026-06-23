import { buildTailoredAnswer, searchIndex } from "./chatbotNlp.js";
import { CHATBOT_API_BASE } from "./chatbotConfig.js";
import {
  getOrCreateSessionId,
  loadChatbotIndex,
  queryBackendChat,
  submitChatFeedback,
  waitForChatbotReady,
} from "./chatbotApi.js";

function buildFeedbackControls({ eventId, sessionId }) {
  const wrapper = document.createElement("div");
  wrapper.className = "ama-feedback";
  wrapper.setAttribute("role", "group");
  wrapper.setAttribute("aria-label", "Was this answer helpful?");

  const status = document.createElement("span");
  status.className = "ama-feedback-status";
  status.setAttribute("aria-live", "polite");

  const sendRating = async (rating, button) => {
    const buttons = wrapper.querySelectorAll("button.ama-feedback-btn");
    for (const b of buttons) {
      b.disabled = true;
    }
    button.classList.add("is-active");
    status.textContent = "Thanks for the feedback.";
    const result = await submitChatFeedback({ eventId, sessionId, rating });
    if (!result?.accepted) {
      status.textContent = "Could not record feedback.";
    }
  };

  const upBtn = document.createElement("button");
  upBtn.type = "button";
  upBtn.className = "ama-feedback-btn ama-feedback-up";
  upBtn.setAttribute("aria-label", "Helpful answer");
  upBtn.textContent = "Helpful";
  upBtn.addEventListener("click", () => sendRating(1, upBtn));

  const downBtn = document.createElement("button");
  downBtn.type = "button";
  downBtn.className = "ama-feedback-btn ama-feedback-down";
  downBtn.setAttribute("aria-label", "Not helpful answer");
  downBtn.textContent = "Not helpful";
  downBtn.addEventListener("click", () => sendRating(-1, downBtn));

  wrapper.appendChild(upBtn);
  wrapper.appendChild(downBtn);
  wrapper.appendChild(status);
  return wrapper;
}

export function mountAmaWidget(runtime) {
  const existing = document.getElementById("ama-widget");
  if (existing) {
    return;
  }

  const chatbotIndexFile =
    runtime?.chatbot_index_file && typeof runtime.chatbot_index_file === "string"
      ? runtime.chatbot_index_file
      : "";
  if (!chatbotIndexFile) {
    return;
  }

  let indexPromise = null;

  const host = document.createElement("div");
  host.id = "ama-widget";
  host.className = "ama-widget";
  host.innerHTML = `
    <div class="ama-panel" hidden>
      <div class="ama-panel-header">
        <h3>Ask Me Anything</h3>
        <button type="button" class="ama-close" aria-label="Close AMA chat">x</button>
      </div>
      <div class="ama-messages">
        <div class="ama-msg ama-msg-assistant">Hi, feel free to ask me anything that you would want to know about me</div>
      </div>
      <form class="ama-input-row">
        <input type="text" name="question" placeholder="Type your question..." aria-label="Type your question" />
        <button type="submit" class="ama-send">Send</button>
      </form>
    </div>
    <button type="button" class="ama-bubble" aria-expanded="false" aria-controls="ama-chat-panel">
      <svg class="ama-bubble-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M21 12a8.5 8.5 0 0 1-8.5 8.5H5l-2 2v-10.5A8.5 8.5 0 1 1 21 12Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      </svg>
      <span class="ama-bubble-label">AMA</span>
      <span class="ama-bubble-tooltip">Ask me anything</span>
    </button>
  `;

  const panel = host.querySelector(".ama-panel");
  panel.id = "ama-chat-panel";
  const bubble = host.querySelector(".ama-bubble");
  const closeBtn = host.querySelector(".ama-close");
  const form = host.querySelector(".ama-input-row");
  const input = form.querySelector('input[name="question"]');
  const messages = host.querySelector(".ama-messages");
  const sessionId = getOrCreateSessionId();

  const appendMessage = (text, role, options = {}) => {
    const node = document.createElement("div");
    node.className = `ama-msg ${role === "user" ? "ama-msg-user" : "ama-msg-assistant"}`;
    const textNode = document.createElement("div");
    textNode.className = "ama-msg-text";
    textNode.textContent = text;
    node.appendChild(textNode);
    if (role === "assistant" && options.eventId && CHATBOT_API_BASE) {
      node.appendChild(
        buildFeedbackControls({
          eventId: options.eventId,
          sessionId,
        }),
      );
    }
    messages.appendChild(node);
    messages.scrollTop = messages.scrollHeight;
  };

  const setSubmitState = (isSubmitting) => {
    input.disabled = isSubmitting;
    form.querySelector(".ama-send").disabled = isSubmitting;
  };

  const openPanel = () => {
    panel.hidden = false;
    bubble.setAttribute("aria-expanded", "true");
    input.focus();
  };

  const closePanel = () => {
    panel.hidden = true;
    bubble.setAttribute("aria-expanded", "false");
  };

  bubble.addEventListener("click", () => {
    if (panel.hidden) {
      openPanel();
    } else {
      closePanel();
    }
  });
  closeBtn.addEventListener("click", closePanel);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) {
      return;
    }
    appendMessage(question, "user");
    input.value = "";
    setSubmitState(true);
    try {
      indexPromise = indexPromise || loadChatbotIndex(chatbotIndexFile);
      const index = await indexPromise;
      const results = searchIndex(index, question, 3);
      if (!results.length) {
        appendMessage(
          "I'm unable to answer this, please contact Rohit for clarity on this query",
          "assistant",
        );
      } else {
        let answer = "";
        let backendEventId = "";
        try {
          const backend = await queryBackendChat(question, sessionId);
          if (backend && typeof backend.answer === "string" && backend.answer.trim()) {
            answer = backend.answer.trim();
          }
          if (backend && typeof backend.event_id === "string") {
            backendEventId = backend.event_id;
          }
        } catch (_error) {
          answer = "";
          backendEventId = "";
        }
        const fallback = buildTailoredAnswer(results, question);
        appendMessage(answer || fallback, "assistant", { eventId: backendEventId });
      }
    } catch (error) {
      appendMessage(
        "Search index is unavailable right now. Please try again shortly.",
        "assistant",
      );
      console.error(error);
    } finally {
      setSubmitState(false);
      input.focus();
    }
  });

  document.body.appendChild(host);
}

/**
 * Start warming the hosted API immediately; mount the widget only after /health OK.
 * When VITE_CHATBOT_API_BASE is unset (local dev), mount without waiting.
 */
export function startChatbotWarmup() {
  if (!CHATBOT_API_BASE) {
    return Promise.resolve(true);
  }
  return waitForChatbotReady();
}

export async function tryMountAmaWidget(runtime, warmupPromise) {
  const chatbotIndexFile =
    runtime?.chatbot_index_file && typeof runtime.chatbot_index_file === "string"
      ? runtime.chatbot_index_file.trim()
      : "";
  if (!chatbotIndexFile) {
    return;
  }

  if (CHATBOT_API_BASE) {
    const ready = warmupPromise ? await warmupPromise : await waitForChatbotReady();
    if (!ready) {
      console.info("[AMA] Chatbot API not ready; widget hidden.");
      return;
    }
  }

  mountAmaWidget(runtime);
}
