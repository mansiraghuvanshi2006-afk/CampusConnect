import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import ApiError from "../utils/ApiError.js";
import {
  clearAllAiHistory,
  createAiConversation,
  deleteAiConversation,
  deleteAiMessage,
  editAiPrompt,
  getAiAutocomplete,
  getAiConfigStatus,
  getAiMessages,
  getAiStarters,
  listAiConversations,
  regenerateAiMessage,
  renameAiConversation,
  sendAiMessage,
} from "../services/aiService.js";

const throwAiError = (error) => {
  if (error instanceof ApiError) {
    throw error;
  }

  const statusCode = error.statusCode || 502;
  const apiError = new ApiError(
    statusCode,
    error.message || "Campus AI request failed"
  );
  apiError.code = error.code || "AI_PROVIDER_ERROR";
  throw apiError;
};

const getClientIp = (req) =>
  req.ip ||
  req.headers["x-forwarded-for"]?.toString()?.split(",")[0]?.trim() ||
  null;

/**
 * Write one SSE event. Never throws into the Express pipeline
 * after headers are flushed.
 */
const writeSse = (res, event, data) => {
  if (res.writableEnded) {
    return;
  }

  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

export const getAiStatus = asyncHandler(async (_req, res) => {
  return sendSuccess(
    res,
    200,
    "Campus AI status",
    getAiConfigStatus()
  );
});

export const listConversations = asyncHandler(async (req, res) => {
  const query = req.validatedQuery || req.query;
  const conversations = await listAiConversations(req.user, {
    search: query.search,
    limit: query.limit,
  });

  return sendSuccess(res, 200, "AI conversations loaded", {
    conversations,
  });
});

export const createConversation = asyncHandler(async (req, res) => {
  const conversation = await createAiConversation(req.user, req.body);

  return sendSuccess(res, 201, "AI conversation created", {
    conversation,
  });
});

export const renameConversation = asyncHandler(async (req, res) => {
  const conversation = await renameAiConversation(
    req.user,
    req.params.conversationId,
    req.body.title
  );

  return sendSuccess(res, 200, "AI conversation renamed", {
    conversation,
  });
});

export const removeConversation = asyncHandler(async (req, res) => {
  await deleteAiConversation(req.user, req.params.conversationId);

  return sendSuccess(res, 200, "AI conversation deleted", {});
});

export const clearHistory = asyncHandler(async (req, res) => {
  const result = await clearAllAiHistory(req.user);

  return sendSuccess(res, 200, "AI history cleared", result);
});

export const listMessages = asyncHandler(async (req, res) => {
  const query = req.validatedQuery || {};
  const result = await getAiMessages(
    req.user,
    req.params.conversationId,
    {
      limit: query.limit,
      before: query.before,
    }
  );

  return sendSuccess(res, 200, "AI messages loaded", result);
});

export const removeMessage = asyncHandler(async (req, res) => {
  await deleteAiMessage(
    req.user,
    req.params.conversationId,
    req.params.messageId
  );

  return sendSuccess(res, 200, "AI message deleted", {});
});

export const getStarters = asyncHandler(async (req, res) => {
  return sendSuccess(res, 200, "AI starter prompts", {
    starters: getAiStarters(req.user),
  });
});

export const autocomplete = asyncHandler(async (req, res) => {
  const suggestions = await getAiAutocomplete(req.user, {
    query: req.body.query,
    includeAi: Boolean(req.body.includeAi),
  });

  return sendSuccess(res, 200, "AI autocomplete suggestions", {
    suggestions,
  });
});

/**
 * POST send — JSON or SSE based on Accept / body.stream.
 */
export const sendMessage = asyncHandler(async (req, res) => {
  const wantsStream =
    req.body.stream !== false &&
    (req.headers.accept?.includes("text/event-stream") ||
      req.body.stream === true);

  const ipAddress = getClientIp(req);

  if (!wantsStream) {
    try {
      const result = await sendAiMessage({
        user: req.user,
        conversationId: req.params.conversationId,
        prompt: req.body.prompt,
        model: req.body.model,
        ipAddress,
      });

      return sendSuccess(res, 200, "Campus AI response", result);
    } catch (error) {
      throwAiError(error);
    }
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  const abortController = new AbortController();

  const onClose = () => {
    abortController.abort();
  };

  req.on("close", onClose);
  req.on("aborted", onClose);

  writeSse(res, "status", { state: "started" });

  try {
    const result = await sendAiMessage({
      user: req.user,
      conversationId: req.params.conversationId,
      prompt: req.body.prompt,
      model: req.body.model,
      ipAddress,
      signal: abortController.signal,
      onDelta: (text) => {
        writeSse(res, "delta", { text });
      },
    });

    writeSse(res, "done", result);
  } catch (error) {
    writeSse(res, "error", {
      code: error.code || "AI_PROVIDER_ERROR",
      message:
        error.message ||
        "Campus AI could not complete this request.",
    });
  } finally {
    req.off("close", onClose);
    req.off("aborted", onClose);

    if (!res.writableEnded) {
      res.end();
    }
  }
});

export const editPrompt = asyncHandler(async (req, res) => {
  const wantsStream =
    req.headers.accept?.includes("text/event-stream") ||
    req.body.stream === true;

  const ipAddress = getClientIp(req);

  if (!wantsStream) {
    const result = await editAiPrompt({
      user: req.user,
      conversationId: req.params.conversationId,
      messageId: req.params.messageId,
      prompt: req.body.prompt,
      model: req.body.model,
      ipAddress,
    });

    return sendSuccess(res, 200, "Prompt edited", result);
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  const abortController = new AbortController();
  const onClose = () => abortController.abort();

  req.on("close", onClose);
  req.on("aborted", onClose);

  writeSse(res, "status", { state: "started" });

  try {
    const result = await editAiPrompt({
      user: req.user,
      conversationId: req.params.conversationId,
      messageId: req.params.messageId,
      prompt: req.body.prompt,
      model: req.body.model,
      ipAddress,
      signal: abortController.signal,
      onDelta: (text) => writeSse(res, "delta", { text }),
    });

    writeSse(res, "done", result);
  } catch (error) {
    writeSse(res, "error", {
      code: error.code || "AI_PROVIDER_ERROR",
      message: error.message || "Campus AI could not complete this request.",
    });
  } finally {
    req.off("close", onClose);
    req.off("aborted", onClose);
    if (!res.writableEnded) {
      res.end();
    }
  }
});

export const regenerate = asyncHandler(async (req, res) => {
  const wantsStream =
    req.headers.accept?.includes("text/event-stream") ||
    req.query.stream === "true";

  const ipAddress = getClientIp(req);

  if (!wantsStream) {
    const result = await regenerateAiMessage({
      user: req.user,
      conversationId: req.params.conversationId,
      assistantMessageId: req.params.messageId,
      model: req.body?.model || req.query?.model,
      ipAddress,
    });

    return sendSuccess(res, 200, "Response regenerated", result);
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  const abortController = new AbortController();
  const onClose = () => abortController.abort();

  req.on("close", onClose);
  req.on("aborted", onClose);

  writeSse(res, "status", { state: "started" });

  try {
    const result = await regenerateAiMessage({
      user: req.user,
      conversationId: req.params.conversationId,
      assistantMessageId: req.params.messageId,
      model: req.body?.model || req.query?.model,
      ipAddress,
      signal: abortController.signal,
      onDelta: (text) => writeSse(res, "delta", { text }),
    });

    writeSse(res, "done", result);
  } catch (error) {
    writeSse(res, "error", {
      code: error.code || "AI_PROVIDER_ERROR",
      message: error.message || "Campus AI could not complete this request.",
    });
  } finally {
    req.off("close", onClose);
    req.off("aborted", onClose);
    if (!res.writableEnded) {
      res.end();
    }
  }
});
