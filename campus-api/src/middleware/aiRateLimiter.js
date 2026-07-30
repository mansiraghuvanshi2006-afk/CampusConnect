import rateLimit from "express-rate-limit";
import ApiError from "../utils/ApiError.js";

const windowMs = Number.parseInt(
  process.env.AI_RATE_LIMIT_WINDOW_MS || "60000",
  10
);

const max = Number.parseInt(
  process.env.AI_RATE_LIMIT_MAX || "20",
  10
);

const autocompleteMax = Number.parseInt(
  process.env.AI_AUTOCOMPLETE_RATE_LIMIT_MAX || "30",
  10
);

const mutationMax = Number.parseInt(
  process.env.AI_MUTATION_RATE_LIMIT_MAX || "60",
  10
);

const createAiLimiter = ({
  maxRequests,
  keyPrefix,
  message,
}) =>
  rateLimit({
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 60000,
    max:
      Number.isFinite(maxRequests) && maxRequests > 0
        ? maxRequests
        : 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      if (req.user?._id) {
        return `${keyPrefix}:${req.user._id.toString()}`;
      }
      return `${keyPrefix}-ip:${req.ip}`;
    },
    validate: { keyGeneratorIpFallback: false },
    handler: (_req, _res, next, options) => {
      next(
        new ApiError(
          options.statusCode || 429,
          message
        )
      );
    },
  });

/**
 * Stricter limiter for Gemini-generating AI requests.
 */
export const aiRateLimiter = createAiLimiter({
  maxRequests: max,
  keyPrefix: "ai",
  message:
    "Too many Campus AI requests. Please wait and try again.",
});

/**
 * Lighter limiter for DB-only AI mutations
 * (rename / delete conversation / delete message).
 */
export const aiMutationRateLimiter = createAiLimiter({
  maxRequests: Number.isFinite(mutationMax) && mutationMax > 0
    ? mutationMax
    : 60,
  keyPrefix: "ai-mut",
  message:
    "Too many Campus AI updates. Please wait and try again.",
});

/**
 * Autocomplete limiter (local-first; optional Gemini).
 */
export const aiAutocompleteRateLimiter = createAiLimiter({
  maxRequests:
    Number.isFinite(autocompleteMax) && autocompleteMax > 0
      ? autocompleteMax
      : 30,
  keyPrefix: "ai-ac",
  message:
    "Too many autocomplete requests. Please wait and try again.",
});
