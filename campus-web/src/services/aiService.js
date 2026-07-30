import api from "./api.js";
import { ACCESS_TOKEN_KEY } from "./api.js";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api/v1";

const getAuthHeaders = () => {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const headers = {
    Accept: "text/event-stream",
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
};

/**
 * Parse an SSE byte stream from fetch().
 */
const consumeSse = async (response, { onDelta, onDone, onError, signal }) => {
  if (!response.ok) {
    let message = "Campus AI request failed";
    let code = null;

    try {
      const payload = await response.json();
      message = payload?.message || message;
      code = payload?.code || null;
    } catch {
      // ignore parse errors
    }

    const error = new Error(message);
    error.code = code;
    error.status = response.status;
    throw error;
  }

  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error("Streaming is not supported in this browser");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "message";

  const flushEvent = (raw) => {
    const lines = raw.split("\n");
    let eventName = currentEvent;
    const dataLines = [];

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      }
    }

    if (dataLines.length === 0) {
      return;
    }

    let parsed;

    try {
      parsed = JSON.parse(dataLines.join("\n"));
    } catch {
      return;
    }

    if (eventName === "delta" && onDelta) {
      onDelta(parsed.text || "");
    }

    if (eventName === "done" && onDone) {
      onDone(parsed);
    }

    if (eventName === "error" && onError) {
      onError(parsed);
    }
  };

  while (true) {
    if (signal?.aborted) {
      await reader.cancel();
      break;
    }

    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    let separatorIndex = buffer.indexOf("\n\n");

    while (separatorIndex !== -1) {
      const chunk = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      flushEvent(chunk);
      separatorIndex = buffer.indexOf("\n\n");
    }
  }
};

export const getAiStatus = async () => {
  const response = await api.get("/ai/status");
  return response.data?.data || { configured: false };
};

export const getAiStarters = async () => {
  const response = await api.get("/ai/starters");
  return response.data?.data?.starters || [];
};

export const getAiAutocomplete = async ({ query, includeAi = false }) => {
  const response = await api.post("/ai/autocomplete", {
    query,
    includeAi,
  });
  return response.data?.data?.suggestions || [];
};

export const listAiConversations = async ({ search = "", limit = 50 } = {}) => {
  const response = await api.get("/ai/conversations", {
    params: { search: search || undefined, limit },
  });
  return response.data?.data?.conversations || [];
};

export const createAiConversation = async ({ title } = {}) => {
  const response = await api.post("/ai/conversations", { title });
  return response.data?.data?.conversation;
};

export const renameAiConversation = async (conversationId, title) => {
  const response = await api.patch(`/ai/conversations/${conversationId}`, {
    title,
  });
  return response.data?.data?.conversation;
};

export const deleteAiConversation = async (conversationId) => {
  await api.delete(`/ai/conversations/${conversationId}`);
};

export const clearAiHistory = async () => {
  const response = await api.delete("/ai/conversations");
  return response.data?.data;
};

export const getAiMessages = async (
  conversationId,
  { limit = 30, before } = {}
) => {
  const response = await api.get(
    `/ai/conversations/${conversationId}/messages`,
    {
      params: {
        limit,
        before: before || undefined,
      },
    }
  );
  return (
    response.data?.data || {
      messages: [],
      pagination: { hasMore: false, nextCursor: null },
    }
  );
};

export const deleteAiMessage = async (conversationId, messageId) => {
  await api.delete(
    `/ai/conversations/${conversationId}/messages/${messageId}`
  );
};

/**
 * Stream a Campus AI reply via fetch + SSE (supports Authorization).
 */
export const streamAiMessage = async ({
  conversationId,
  prompt,
  signal,
  onDelta,
  onDone,
  onError,
}) => {
  const response = await fetch(
    `${API_URL}/ai/conversations/${conversationId}/messages`,
    {
      method: "POST",
      credentials: "include",
      headers: getAuthHeaders(),
      body: JSON.stringify({ prompt, stream: true }),
      signal,
    }
  );

  await consumeSse(response, { onDelta, onDone, onError, signal });
};

export const streamEditAiPrompt = async ({
  conversationId,
  messageId,
  prompt,
  signal,
  onDelta,
  onDone,
  onError,
}) => {
  const response = await fetch(
    `${API_URL}/ai/conversations/${conversationId}/messages/${messageId}/edit`,
    {
      method: "POST",
      credentials: "include",
      headers: getAuthHeaders(),
      body: JSON.stringify({ prompt, stream: true }),
      signal,
    }
  );

  await consumeSse(response, { onDelta, onDone, onError, signal });
};

export const streamRegenerateAiMessage = async ({
  conversationId,
  messageId,
  signal,
  onDelta,
  onDone,
  onError,
}) => {
  const response = await fetch(
    `${API_URL}/ai/conversations/${conversationId}/messages/${messageId}/regenerate?stream=true`,
    {
      method: "POST",
      credentials: "include",
      headers: getAuthHeaders(),
      body: JSON.stringify({}),
      signal,
    }
  );

  await consumeSse(response, { onDelta, onDone, onError, signal });
};

export const sendAiMessageJson = async (conversationId, prompt) => {
  const response = await api.post(
    `/ai/conversations/${conversationId}/messages`,
    { prompt, stream: false },
    { timeout: 120000 }
  );
  return response.data?.data;
};
