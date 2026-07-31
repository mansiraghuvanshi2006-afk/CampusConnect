/**
 * Isolated Gemini client using the official @google/genai SDK
 * and the Interactions API.
 *
 * Controllers and higher-level AI orchestration should only
 * call these helpers so models / methods can change later.
 */

let clientPromise = null;

const BUILTIN_ALLOWED_MODELS = Object.freeze([
  "gemini-flash-latest",
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
]);

const PREFERRED_MODEL_ORDER = Object.freeze([
  "gemini-flash-latest",
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
]);

const getDefaultModel = () =>
  process.env.GEMINI_MODEL?.trim() || "gemini-flash-latest";

const getSearchModel = () =>
  process.env.GEMINI_SEARCH_MODEL?.trim() ||
  process.env.GEMINI_MODEL?.trim() ||
  "gemini-flash-latest";

export const getAllowedModels = () => {
  const fromEnv = process.env.GEMINI_ALLOWED_MODELS?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return fromEnv?.length ? fromEnv : [...BUILTIN_ALLOWED_MODELS];
};

/**
 * Pick a safe model id from the allowlist (same Google project / API key).
 */
export const resolveModel = (requested, { forSearch = false } = {}) => {
  const allowed = getAllowedModels();
  const fallback = forSearch ? getSearchModel() : getDefaultModel();
  const normalizedFallback = allowed.includes(fallback)
    ? fallback
    : allowed[0];

  if (!requested || typeof requested !== "string" || !requested.trim()) {
    return normalizedFallback;
  }

  const model = requested.trim();

  if (!allowed.includes(model)) {
    const error = new Error(
      `Model "${model}" is not allowed. Available: ${allowed.join(", ")}`
    );
    error.code = "AI_MODEL_NOT_ALLOWED";
    error.statusCode = 400;
    throw error;
  }

  return model;
};

const getModelTryOrder = (requested, { forSearch = false } = {}) => {
  const primary = resolveModel(requested, { forSearch });
  const allowed = getAllowedModels();
  const order = [primary];

  for (const model of PREFERRED_MODEL_ORDER) {
    if (model !== primary && allowed.includes(model) && !order.includes(model)) {
      order.push(model);
    }
  }

  for (const model of allowed) {
    if (!order.includes(model)) {
      order.push(model);
    }
  }

  return order;
};

const isModelUnavailableError = (error) => {
  const message = String(
    error?.cause?.message || error?.message || error || ""
  ).toLowerCase();
  const status =
    error?.status ||
    error?.statusCode ||
    error?.cause?.status ||
    error?.cause?.statusCode;

  if (status === 404 || status === 429) {
    return true;
  }

  return (
    message.includes("404") ||
    message.includes("no longer available") ||
    message.includes("not found") ||
    message.includes("quota") ||
    message.includes("resource_exhausted") ||
    error?.code === "AI_QUOTA_EXCEEDED"
  );
};

export const isGeminiConfigured = () =>
  Boolean(process.env.GEMINI_API_KEY?.trim());

const getClient = async () => {
  if (!isGeminiConfigured()) {
    const error = new Error("Campus AI is not configured.");
    error.code = "AI_NOT_CONFIGURED";
    error.statusCode = 503;
    throw error;
  }

  if (!clientPromise) {
    clientPromise = import("@google/genai").then(({ GoogleGenAI }) => {
      return new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY.trim(),
      });
    });
  }

  return clientPromise;
};

export const classifyGeminiError = (error) => {
  const message = String(error?.message || error || "");
  const status =
    error?.status ||
    error?.statusCode ||
    error?.code ||
    error?.error?.code;

  const lower = message.toLowerCase();

  if (
    error?.code === "AI_NOT_CONFIGURED" ||
    lower.includes("not configured")
  ) {
    return {
      code: "AI_NOT_CONFIGURED",
      statusCode: 503,
      message: "Campus AI is not configured.",
      retryable: false,
    };
  }

  if (
    status === 429 ||
    lower.includes("resource_exhausted") ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("quota_exceeded")
  ) {
    return {
      code: "AI_QUOTA_EXCEEDED",
      statusCode: 429,
      message:
        "Campus AI is temporarily unavailable due to quota limits. Please try again later.",
      retryable: true,
    };
  }

  if (
    lower.includes("grounding") ||
    lower.includes("google_search") ||
    lower.includes("search tool")
  ) {
    return {
      code: "AI_GROUNDING_UNAVAILABLE",
      statusCode: 503,
      message:
        "Live information could not be verified because Google Search grounding is unavailable.",
      retryable: true,
    };
  }

  if (
    status === 401 ||
    status === 403 ||
    lower.includes("api key") ||
    lower.includes("permission")
  ) {
    return {
      code: "AI_AUTH_ERROR",
      statusCode: 503,
      message: "Campus AI could not authenticate with the model provider.",
      retryable: false,
    };
  }

  if (
    status === 404 ||
    lower.includes("no longer available") ||
    lower.includes("not found")
  ) {
    return {
      code: "AI_MODEL_UNAVAILABLE",
      statusCode: 404,
      message:
        "The selected AI model is unavailable. Switch to gemini-flash-latest in the model menu.",
      retryable: true,
    };
  }

  return {
    code: "AI_PROVIDER_ERROR",
    statusCode: 502,
    message:
      "Campus AI could not complete this request. Please try again shortly.",
    retryable: true,
  };
};

const extractTextFromInteraction = (interaction) => {
  if (!interaction) {
    return "";
  }

  if (typeof interaction.output_text === "string") {
    return interaction.output_text;
  }

  const outputs = interaction.outputs || interaction.output || [];

  if (Array.isArray(outputs)) {
    return outputs
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item?.type === "text" && item.text) {
          return item.text;
        }
        if (item?.text) {
          return item.text;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
};

const extractCitations = (interaction) => {
  const citations = [];
  const seen = new Set();

  const pushCitation = (title, uri) => {
    if (!uri || seen.has(uri)) {
      return;
    }
    seen.add(uri);
    citations.push({
      title: String(title || uri).slice(0, 300),
      uri: String(uri).slice(0, 2000),
    });
  };

  const walk = (node) => {
    if (!node || typeof node !== "object") {
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    if (node.uri || node.url) {
      pushCitation(node.title || node.name, node.uri || node.url);
    }

    if (node.groundingChunks) {
      walk(node.groundingChunks);
    }

    if (node.web) {
      pushCitation(node.web.title, node.web.uri || node.web.url);
    }

    for (const value of Object.values(node)) {
      if (value && typeof value === "object") {
        walk(value);
      }
    }
  };

  walk(interaction);
  return citations.slice(0, 12);
};

const extractUsage = (interaction) => {
  const usage =
    interaction?.usage ||
    interaction?.usage_metadata ||
    interaction?.usageMetadata ||
    {};

  return {
    promptTokens:
      Number(
        usage.prompt_tokens ||
          usage.promptTokens ||
          usage.input_tokens ||
          0
      ) || 0,
    completionTokens:
      Number(
        usage.completion_tokens ||
          usage.completionTokens ||
          usage.output_tokens ||
          0
      ) || 0,
  };
};

/**
 * Non-streaming interaction.
 */
export const createInteraction = async ({
  input,
  systemInstruction,
  tools = [],
  useSearch = false,
  previousInteractionId = null,
  signal = null,
  model: requestedModel = null,
}) => {
  const client = await getClient();
  const modelsToTry = getModelTryOrder(requestedModel, { forSearch: useSearch });
  let lastError = null;

  for (let index = 0; index < modelsToTry.length; index += 1) {
    const model = modelsToTry[index];

    const request = {
      model,
      input,
      stream: false,
    };

    if (systemInstruction) {
      request.system_instruction = systemInstruction;
    }

    if (previousInteractionId) {
      request.previous_interaction_id = previousInteractionId;
    }

    const toolList = [...tools];

    if (useSearch) {
      toolList.push({ type: "google_search" });
    }

    if (toolList.length > 0) {
      request.tools = toolList;
    }

    try {
      const interaction = await client.interactions.create(request, {
        signal,
      });

      return {
        text: extractTextFromInteraction(interaction),
        citations: useSearch ? extractCitations(interaction) : [],
        usage: extractUsage(interaction),
        interactionId: interaction?.id || null,
        model,
        groundingUsed: useSearch,
        modelFallbackFrom:
          index > 0 ? modelsToTry[0] : null,
      };
    } catch (error) {
      lastError = error;

      if (
        index < modelsToTry.length - 1 &&
        isModelUnavailableError(error)
      ) {
        continue;
      }

      const classified = classifyGeminiError(error);
      const wrapped = new Error(classified.message);
      wrapped.code = classified.code;
      wrapped.statusCode = classified.statusCode;
      wrapped.retryable = classified.retryable;
      wrapped.cause = error;
      throw wrapped;
    }
  }

  const classified = classifyGeminiError(lastError);
  const wrapped = new Error(classified.message);
  wrapped.code = classified.code;
  wrapped.statusCode = classified.statusCode;
  wrapped.retryable = classified.retryable;
  wrapped.cause = lastError;
  throw wrapped;
};

/**
 * Streaming interaction. Yields { type, text?, citations?, usage?, done? }.
 */
export const streamInteraction = async function* ({
  input,
  systemInstruction,
  useSearch = false,
  previousInteractionId = null,
  signal = null,
  model: requestedModel = null,
}) {
  const client = await getClient();
  const modelsToTry = getModelTryOrder(requestedModel, { forSearch: useSearch });
  let lastError = null;

  for (let modelIndex = 0; modelIndex < modelsToTry.length; modelIndex += 1) {
    const model = modelsToTry[modelIndex];

    const request = {
      model,
      input,
      stream: true,
    };

    if (systemInstruction) {
      request.system_instruction = systemInstruction;
    }

    if (previousInteractionId) {
      request.previous_interaction_id = previousInteractionId;
    }

    if (useSearch) {
      request.tools = [{ type: "google_search" }];
    }

    let fullText = "";
    let interactionId = null;
    let finalInteraction = null;
    let streamError = null;

    try {
      const stream = await client.interactions.create(request, {
        signal,
      });

      for await (const event of stream) {
        if (signal?.aborted) {
          break;
        }

        if (event?.interaction?.id) {
          interactionId = event.interaction.id;
        }

        if (event?.event_type === "error" || event?.error) {
          streamError = {
            message: event.error?.message || "Gemini stream error",
            code: event.error?.code,
            status: event.error?.code === "quota_exceeded" ? 429 : undefined,
          };
          break;
        }

        if (event?.event_type === "step.delta") {
          const delta = event.delta;

          if (delta?.type === "text" && delta.text) {
            fullText += delta.text;
            yield { type: "delta", text: delta.text };
          }
        }

        const inlineDelta =
          (typeof event?.delta?.text === "string" && event.delta.text) ||
          (typeof event?.output_text_delta === "string" &&
            event.output_text_delta) ||
          (typeof event?.text === "string" && event.text) ||
          "";

        if (
          inlineDelta &&
          event?.event_type !== "step.delta"
        ) {
          fullText += inlineDelta;
          yield { type: "delta", text: inlineDelta };
        }

        if (
          event?.event_type === "interaction.completed" ||
          event?.event_type === "interaction.complete"
        ) {
          finalInteraction = event.interaction || event;
          const completedText = extractTextFromInteraction(finalInteraction);

          if (completedText && completedText.length > fullText.length) {
            const remainder = completedText.slice(fullText.length);

            if (remainder) {
              fullText = completedText;
              yield { type: "delta", text: remainder };
            } else {
              fullText = completedText;
            }
          }
        }
      }

      if (streamError) {
        if (
          !fullText &&
          modelIndex < modelsToTry.length - 1 &&
          isModelUnavailableError(streamError)
        ) {
          lastError = streamError;
          continue;
        }

        const classified = classifyGeminiError(streamError);
        yield {
          type: "error",
          code: classified.code,
          message: classified.message,
          retryable: classified.retryable,
          text: fullText,
        };

        return;
      }

      if (!fullText && finalInteraction) {
        fullText = extractTextFromInteraction(finalInteraction);
      }

      const citations = useSearch
        ? extractCitations(finalInteraction || { outputs: [{ text: fullText }] })
        : [];
      const usage = extractUsage(finalInteraction || {});

      yield {
        type: "done",
        text: fullText,
        citations,
        usage,
        interactionId,
        model,
        groundingUsed: useSearch,
        aborted: Boolean(signal?.aborted),
        modelFallbackFrom:
          modelIndex > 0 ? modelsToTry[0] : null,
      };

      return;
    } catch (error) {
      if (signal?.aborted) {
        yield {
          type: "done",
          text: fullText,
          citations: [],
          usage: { promptTokens: 0, completionTokens: 0 },
          interactionId,
          model,
          groundingUsed: useSearch,
          aborted: true,
        };
        return;
      }

      lastError = error;

      if (
        modelIndex < modelsToTry.length - 1 &&
        isModelUnavailableError(error)
      ) {
        continue;
      }

      const classified = classifyGeminiError(error);
      yield {
        type: "error",
        code: classified.code,
        message: classified.message,
        retryable: classified.retryable,
        text: fullText,
      };

      return;
    }
  }

  const classified = classifyGeminiError(lastError);
  yield {
    type: "error",
    code: classified.code,
    message: classified.message,
    retryable: classified.retryable,
    text: "",
  };
};

/**
 * Lightweight completion for title generation / autocomplete.
 * Uses a short timeout and never throws past classification.
 */
export const generateShortText = async ({
  prompt,
  systemInstruction,
  maxRetries = 1,
  model = null,
}) => {
  let attempt = 0;
  let lastError = null;

  while (attempt <= maxRetries) {
    attempt += 1;

    try {
      const result = await createInteraction({
        input: prompt,
        systemInstruction,
        useSearch: false,
        model,
      });

      return result.text?.trim() || "";
    } catch (error) {
      lastError = error;
      if (!error.retryable || attempt > maxRetries) {
        break;
      }
    }
  }

  throw lastError;
};

export const getGeminiStatus = () => {
  const allowedModels = getAllowedModels();
  const defaultModel = resolveModel(null, { forSearch: false });

  return {
    configured: isGeminiConfigured(),
    model: defaultModel,
    searchModel: resolveModel(null, { forSearch: true }),
    defaultModel,
    allowedModels,
  };
};
