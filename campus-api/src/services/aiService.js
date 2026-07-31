import AiConversation from "../models/AiConversation.js";
import AiMessage, {
  AI_MESSAGE_ROLES,
  AI_MODES,
} from "../models/AiMessage.js";
import ApiError from "../utils/ApiError.js";
import {
  detectAiMode,
  buildToolArgsFromPrompt,
  filterLocalSuggestions,
  getFollowUpSuggestions,
  getStarterPrompts,
  sanitizePrompt,
} from "./aiIntentService.js";
import {
  formatToolContextForPrompt,
  runCampusTools,
} from "./aiToolsService.js";
import {
  createInteraction,
  generateShortText,
  getGeminiStatus,
  isGeminiConfigured,
  streamInteraction,
} from "./geminiService.js";

const MAX_HISTORY_MESSAGES = Number.parseInt(
  process.env.AI_MAX_HISTORY_MESSAGES || "20",
  10
);

const MAX_PROMPT_LENGTH = Number.parseInt(
  process.env.AI_MAX_PROMPT_LENGTH || "8000",
  10
);

const SYSTEM_PROMPT = `You are Campus AI, the helpful assistant built into CampusConnect.
Be concise, accurate and friendly.
Use markdown when helpful (lists, tables, code fences with language tags).
Never invent campus-specific private data. When campus context is provided below, treat it as the only authoritative campus data and answer directly from it.
When Authorized campus data is included, NEVER say you lack access to the user's department, year, or profile — that data is already fetched for you.
The user may type casual or misspelled English (e.g. "stundet", "naem", "depatment") — still answer from the authorized campus data when it is present.
You MAY share from authorized campus data: the user's name, role (student/teacher/admin), department, academic year, teaching years, designation, student/teacher names they are allowed to see, and counts (how many students, teachers, etc.).
For messy questions that ask for several things at once (name + student count + basic info), answer all parts in one clear reply using the tool results.
Teachers: use department and teachingYears from the data (teachers do not have a student year field). Include how many students are in each teaching year when that data is present.
Students: use department and year from the data.
Admins: use platform and department summaries for totals across the campus.
NEVER reveal, ask for, or discuss passwords, password hashes, JWT tokens, API keys, refresh tokens, or other secrets — not for any user.
If live web grounding is unavailable, clearly say current information could not be verified instead of inventing current facts.`;

const serializeConversation = (conversation) => ({
  id: conversation._id.toString(),
  title: conversation.title,
  titleGenerated: conversation.titleGenerated,
  model: conversation.model,
  totalPromptTokens: conversation.totalPromptTokens || 0,
  totalCompletionTokens: conversation.totalCompletionTokens || 0,
  messageCount: conversation.messageCount || 0,
  lastMessageAt: conversation.lastMessageAt,
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt,
});

const serializeMessage = (message) => ({
  id: message._id.toString(),
  conversationId: message.conversation.toString(),
  role: message.role,
  content: message.content,
  mode: message.mode,
  model: message.model,
  promptTokens: message.promptTokens || 0,
  completionTokens: message.completionTokens || 0,
  citations: message.citations || [],
  toolsUsed: message.toolsUsed || [],
  followUpSuggestions: message.followUpSuggestions || [],
  status: message.status,
  errorCode: message.errorCode,
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
});

const assertOwnsConversation = async (userId, conversationId) => {
  const conversation = await AiConversation.findOne({
    _id: conversationId,
    user: userId,
    isArchived: false,
  });

  if (!conversation) {
    throw new ApiError(404, "AI conversation not found");
  }

  return conversation;
};

export const getAiConfigStatus = () => getGeminiStatus();

export const listAiConversations = async (user, { search = "", limit = 50 } = {}) => {
  const query = {
    user: user._id,
    isArchived: false,
  };

  if (search?.trim()) {
    const safe = sanitizePrompt(search, 80).replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
    query.title = { $regex: safe, $options: "i" };
  }

  const conversations = await AiConversation.find(query)
    .sort({ updatedAt: -1 })
    .limit(Math.min(Number(limit) || 50, 100))
    .lean();

  return conversations.map(serializeConversation);
};

export const createAiConversation = async (user, { title } = {}) => {
  const conversation = await AiConversation.create({
    user: user._id,
    title: title?.trim()?.slice(0, 120) || "New conversation",
  });

  return serializeConversation(conversation);
};

export const renameAiConversation = async (user, conversationId, title) => {
  const conversation = await assertOwnsConversation(user._id, conversationId);
  conversation.title = sanitizePrompt(title, 120) || "New conversation";
  conversation.titleGenerated = true;
  await conversation.save();
  return serializeConversation(conversation);
};

export const deleteAiConversation = async (user, conversationId) => {
  const conversation = await assertOwnsConversation(user._id, conversationId);
  await AiMessage.deleteMany({ conversation: conversation._id });
  await conversation.deleteOne();
  return true;
};

export const clearAllAiHistory = async (user) => {
  const conversations = await AiConversation.find({ user: user._id }).select(
    "_id"
  );
  const ids = conversations.map((item) => item._id);

  if (ids.length > 0) {
    await AiMessage.deleteMany({ conversation: { $in: ids } });
    await AiConversation.deleteMany({ user: user._id });
  }

  return { deletedConversations: ids.length };
};

export const getAiMessages = async (
  user,
  conversationId,
  { limit = 30, before = null } = {}
) => {
  await assertOwnsConversation(user._id, conversationId);

  const pageSize = Math.min(
    Math.max(Number(limit) || 30, 1),
    100
  );

  const filter = {
    conversation: conversationId,
    isDeleted: false,
  };

  if (before) {
    const pivot = await AiMessage.findOne({
      _id: before,
      conversation: conversationId,
      user: user._id,
      isDeleted: false,
    })
      .select("_id createdAt")
      .lean();

    if (!pivot) {
      throw new ApiError(404, "AI message not found");
    }

    filter.$or = [
      { createdAt: { $lt: pivot.createdAt } },
      {
        createdAt: pivot.createdAt,
        _id: { $lt: pivot._id },
      },
    ];
  }

  // Fetch newest-first, then reverse for chronological UI order.
  const messages = await AiMessage.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(pageSize + 1)
    .lean();

  const hasMore = messages.length > pageSize;
  const page = hasMore ? messages.slice(0, pageSize) : messages;
  page.reverse();

  const serialized = page.map(serializeMessage);

  return {
    messages: serialized,
    pagination: {
      limit: pageSize,
      hasMore,
      nextCursor:
        serialized.length > 0 ? serialized[0].id : null,
    },
  };
};

export const deleteAiMessage = async (user, conversationId, messageId) => {
  await assertOwnsConversation(user._id, conversationId);

  const message = await AiMessage.findOneAndUpdate(
    {
      _id: messageId,
      conversation: conversationId,
      user: user._id,
    },
    { isDeleted: true },
    { new: true }
  );

  if (!message) {
    throw new ApiError(404, "AI message not found");
  }

  return true;
};

const loadHistoryForContext = async (conversationId) => {
  const messages = await AiMessage.find({
    conversation: conversationId,
    isDeleted: false,
    status: { $ne: "aborted" },
  })
    .sort({ createdAt: -1 })
    .limit(
      Number.isFinite(MAX_HISTORY_MESSAGES) && MAX_HISTORY_MESSAGES > 0
        ? MAX_HISTORY_MESSAGES
        : 20
    )
    .lean();

  return messages.reverse();
};

const buildGeminiInput = ({ history, prompt, toolContext, mode }) => {
  const parts = [];

  for (const message of history) {
    parts.push({
      type: "text",
      role: message.role === AI_MESSAGE_ROLES.ASSISTANT ? "model" : "user",
      text: message.content,
    });
  }

  let userText = prompt;

  if (mode === AI_MODES.CAMPUS && toolContext) {
    userText = `${prompt}\n\n---\nAuthorized campus data (trusted):\n${toolContext}\n---\nAnswer using only this campus data for campus facts.`;
  }

  if (mode === AI_MODES.LIVE_INTERNET) {
    userText = `${prompt}\n\nUse Google Search grounding for current facts. Cite sources. If search is unavailable, say live information could not be verified.`;
  }

  parts.push({
    type: "text",
    role: "user",
    text: userText,
  });

  // Interactions API accepts a string or structured input.
  // Prefer a single concatenated transcript for reliability.
  return parts
    .map((part) => `${part.role === "model" ? "Assistant" : "User"}: ${part.text}`)
    .join("\n\n");
};

const maybeGenerateTitle = async (conversation, firstUserPrompt) => {
  if (conversation.titleGenerated || conversation.messageCount > 2) {
    return;
  }

  try {
    if (!isGeminiConfigured()) {
      conversation.title = firstUserPrompt.slice(0, 60) || "New conversation";
      conversation.titleGenerated = true;
      await conversation.save();
      return;
    }

    const title = await generateShortText({
      prompt: `Create a short chat title (max 6 words) for this user message. Reply with the title only.\n\n${firstUserPrompt.slice(0, 400)}`,
      systemInstruction: "Return only a concise title without quotes.",
    });

    conversation.title =
      sanitizePrompt(title, 80).replace(/^["']|["']$/g, "") ||
      firstUserPrompt.slice(0, 60);
    conversation.titleGenerated = true;
    await conversation.save();
  } catch {
    conversation.title = firstUserPrompt.slice(0, 60) || "New conversation";
    conversation.titleGenerated = true;
    await conversation.save();
  }
};

/**
 * Core send flow used by both JSON and SSE endpoints.
 * onDelta is optional for streaming.
 */
export const sendAiMessage = async ({
  user,
  conversationId,
  prompt: rawPrompt,
  regenerateFromMessageId = null,
  ipAddress = null,
  signal = null,
  onDelta = null,
  model: requestedModel = null,
}) => {
  if (!isGeminiConfigured()) {
    throw Object.assign(new Error("Campus AI is not configured."), {
      code: "AI_NOT_CONFIGURED",
      statusCode: 503,
    });
  }

  const prompt = sanitizePrompt(rawPrompt, MAX_PROMPT_LENGTH);

  if (!prompt || prompt.length < 1) {
    throw new ApiError(400, "Prompt is required");
  }

  const conversation = await assertOwnsConversation(
    user._id,
    conversationId
  );

  const detection = detectAiMode(prompt);
  let toolsUsed = [];
  let toolContext = "";

  if (detection.mode === AI_MODES.CAMPUS) {
    const toolRun = await runCampusTools({
      user,
      toolNames: detection.tools,
      argsByTool: buildToolArgsFromPrompt(prompt, detection.tools),
      conversationId: conversation._id,
      ipAddress,
    });
    toolsUsed = toolRun.usage;
    toolContext = formatToolContextForPrompt(toolRun.results);
  }

  let history = await loadHistoryForContext(conversation._id);
  let userMessage = null;
  let reusedUserMessage = false;

  if (regenerateFromMessageId) {
    const pivot = await AiMessage.findOne({
      _id: regenerateFromMessageId,
      conversation: conversation._id,
      user: user._id,
      role: AI_MESSAGE_ROLES.USER,
    });

    if (!pivot) {
      throw new ApiError(404, "Message to regenerate was not found");
    }

    // Soft-delete assistant replies after the pivot user message.
    await AiMessage.updateMany(
      {
        conversation: conversation._id,
        createdAt: { $gte: pivot.createdAt },
        role: AI_MESSAGE_ROLES.ASSISTANT,
        isDeleted: false,
      },
      { isDeleted: true }
    );

    history = await loadHistoryForContext(conversation._id);
    userMessage = pivot;
    reusedUserMessage = true;
  } else {
    userMessage = await AiMessage.create({
      conversation: conversation._id,
      user: user._id,
      role: AI_MESSAGE_ROLES.USER,
      content: prompt,
      mode: detection.mode,
      status: "complete",
    });

    conversation.messageCount += 1;
    conversation.lastMessageAt = new Date();
    await conversation.save();
  }

  const input = buildGeminiInput({
    history: reusedUserMessage
      ? history.filter(
          (message) => String(message._id) !== String(userMessage._id)
        )
      : history,
    prompt,
    toolContext,
    mode: detection.mode,
  });

  let assistantText = "";
  let citations = [];
  let usage = { promptTokens: 0, completionTokens: 0 };
  let model = null;
  let interactionId = null;
  let status = "complete";
  let errorCode = null;
  let groundingUnavailable = false;

  const tryStream = async (useSearch) => {
    for await (const event of streamInteraction({
      input,
      systemInstruction: SYSTEM_PROMPT,
      useSearch,
      previousInteractionId: null,
      signal,
      model: requestedModel,
    })) {
      if (event.type === "delta" && event.text) {
        assistantText += event.text;
        if (onDelta) {
          onDelta(event.text);
        }
      }

      if (event.type === "error") {
        if (event.code === "AI_GROUNDING_UNAVAILABLE" && useSearch) {
          groundingUnavailable = true;
          return { retryWithoutSearch: true };
        }

        errorCode = event.code;
        status = "error";
        if (!assistantText) {
          assistantText = event.message;
        }
        return { retryWithoutSearch: false };
      }

      if (event.type === "done") {
        if (event.aborted) {
          status = "aborted";
        }
        if (event.text) {
          assistantText = event.text;
        }
        citations = event.citations || [];
        usage = event.usage || usage;
        model = event.model;
        interactionId = event.interactionId;
      }
    }

    return { retryWithoutSearch: false };
  };

  try {
    if (detection.mode === AI_MODES.LIVE_INTERNET) {
      const result = await tryStream(true);

      if (result.retryWithoutSearch || groundingUnavailable) {
        assistantText = "";
        const fallback = await tryStream(false);
        void fallback;
        if (!assistantText.includes("could not be verified")) {
          assistantText = `${assistantText}\n\n_Note: Live information could not be verified because Google Search grounding was unavailable._`;
        }
      }
    } else {
      await tryStream(false);

      if (!assistantText.trim() && status !== "error") {
        const fallback = await createInteraction({
          input,
          systemInstruction: SYSTEM_PROMPT,
          useSearch: false,
          previousInteractionId: conversation.lastInteractionId || null,
          signal,
          model: requestedModel,
        });

        assistantText = fallback.text || "";
        citations = fallback.citations || citations;
        usage = fallback.usage || usage;
        model = fallback.model || model;
        interactionId = fallback.interactionId || interactionId;
      }
    }
  } catch (error) {
    status = "error";
    errorCode = error.code || "AI_PROVIDER_ERROR";
    assistantText =
      error.message ||
      "Campus AI could not complete this request. Please try again shortly.";

    if (onDelta && assistantText) {
      onDelta(assistantText);
    }
  }

  // Do not persist incomplete aborted streams as assistant replies
  // when no content was produced (avoids duplicate empty messages).
  if (status === "aborted" && !assistantText.trim()) {
    if (!reusedUserMessage) {
      await AiMessage.findByIdAndUpdate(userMessage._id, {
        isDeleted: true,
      });
      conversation.messageCount = Math.max(0, conversation.messageCount - 1);
      await conversation.save();
    }

    return {
      aborted: true,
      userMessage: null,
      assistantMessage: null,
      conversation: serializeConversation(conversation),
    };
  }

  const followUps = getFollowUpSuggestions(detection.mode, user.role);

  const assistantMessage = await AiMessage.create({
    conversation: conversation._id,
    user: user._id,
    role: AI_MESSAGE_ROLES.ASSISTANT,
    content: assistantText || "Campus AI could not complete this request. Please wait a moment and try again.",
    mode: detection.mode,
    model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    citations,
    toolsUsed,
    followUpSuggestions: followUps,
    status,
    errorCode,
    parentMessage: userMessage._id,
  });

  conversation.messageCount += 1;
  conversation.lastMessageAt = new Date();
  conversation.model = model || conversation.model;
  conversation.totalPromptTokens += usage.promptTokens || 0;
  conversation.totalCompletionTokens += usage.completionTokens || 0;

  if (interactionId) {
    conversation.lastInteractionId = interactionId;
  }

  await conversation.save();
  await maybeGenerateTitle(conversation, prompt);

  return {
    aborted: status === "aborted",
    userMessage: serializeMessage(userMessage),
    assistantMessage: serializeMessage(assistantMessage),
    conversation: serializeConversation(
      await AiConversation.findById(conversation._id)
    ),
    mode: detection.mode,
  };
};

/**
 * Edit a prior user prompt: soft-delete subsequent messages and resend.
 */
export const editAiPrompt = async ({
  user,
  conversationId,
  messageId,
  prompt,
  ipAddress,
  signal,
  onDelta,
  model = null,
}) => {
  const conversation = await assertOwnsConversation(
    user._id,
    conversationId
  );

  const original = await AiMessage.findOne({
    _id: messageId,
    conversation: conversation._id,
    user: user._id,
    role: AI_MESSAGE_ROLES.USER,
    isDeleted: false,
  });

  if (!original) {
    throw new ApiError(404, "User message not found");
  }

  await AiMessage.updateMany(
    {
      conversation: conversation._id,
      createdAt: { $gte: original.createdAt },
      isDeleted: false,
    },
    { isDeleted: true }
  );

  return sendAiMessage({
    user,
    conversationId,
    prompt,
    ipAddress,
    signal,
    onDelta,
    model,
  });
};

export const regenerateAiMessage = async ({
  user,
  conversationId,
  assistantMessageId,
  ipAddress,
  signal,
  onDelta,
  model = null,
}) => {
  await assertOwnsConversation(user._id, conversationId);

  const assistant = await AiMessage.findOne({
    _id: assistantMessageId,
    conversation: conversationId,
    user: user._id,
    role: AI_MESSAGE_ROLES.ASSISTANT,
    isDeleted: false,
  });

  if (!assistant) {
    throw new ApiError(404, "Assistant message not found");
  }

  const parent = await AiMessage.findOne({
    _id: assistant.parentMessage,
    conversation: conversationId,
    user: user._id,
    role: AI_MESSAGE_ROLES.USER,
  });

  if (!parent) {
    throw new ApiError(400, "Cannot regenerate without the original prompt");
  }

  await AiMessage.findByIdAndUpdate(assistant._id, { isDeleted: true });

  return sendAiMessage({
    user,
    conversationId,
    prompt: parent.content,
    regenerateFromMessageId: parent._id,
    ipAddress,
    signal,
    onDelta,
    model,
  });
};

export const getAiStarters = (user) => getStarterPrompts(user.role);

/**
 * Autocomplete: local + recent first. Optional lightweight Gemini
 * only after debounce/min-length/rate-limit (enforced by caller).
 */
export const getAiAutocomplete = async (
  user,
  { query, includeAi = false } = {}
) => {
  const q = sanitizePrompt(query, 120);
  const local = filterLocalSuggestions(q);

  const recentMessages = await AiMessage.find({
    user: user._id,
    role: AI_MESSAGE_ROLES.USER,
    isDeleted: false,
    content: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" },
  })
    .sort({ createdAt: -1 })
    .limit(8)
    .select("content")
    .lean();

  const recent = [
    ...new Set(
      recentMessages
        .map((message) => message.content.trim().slice(0, 120))
        .filter(Boolean)
    ),
  ].slice(0, 5);

  const popular = filterLocalSuggestions(q.slice(0, 3), 4);

  const suggestions = [];
  const seen = new Set();

  for (const item of [...local, ...recent, ...popular]) {
    const key = item.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    suggestions.push({ text: item, source: "local" });
  }

  if (includeAi && isGeminiConfigured() && q.length >= 16 && suggestions.length < 6) {
    try {
      const text = await generateShortText({
        prompt: `Suggest 3 short autocomplete completions for a campus AI chat box. Query: "${q}". Reply as a plain list, one per line, no numbering.`,
        systemInstruction:
          "Return only short prompt suggestions. No secrets. No private data.",
        maxRetries: 0,
      });

      for (const line of text.split("\n")) {
        const cleaned = line.replace(/^[-*\d.)\s]+/, "").trim();
        if (!cleaned || cleaned.length > 120) {
          continue;
        }
        const key = cleaned.toLowerCase();
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        suggestions.push({ text: cleaned, source: "ai" });
      }
    } catch {
      // Autocomplete must never fail the request.
    }
  }

  return suggestions.slice(0, 8);
};

/**
 * Non-stream helper used by tests / simple clients.
 */
export const sendAiMessageJson = async (params) => {
  // Prefer non-stream path for reliability when no onDelta.
  if (!params.onDelta) {
    const originalStream = streamInteraction;
    void originalStream;

    try {
      return await sendAiMessage(params);
    } catch (error) {
      // Fallback non-stream createInteraction if stream fails early
      if (error.code === "AI_NOT_CONFIGURED") {
        throw error;
      }
      throw error;
    }
  }

  return sendAiMessage(params);
};

export { createInteraction };
