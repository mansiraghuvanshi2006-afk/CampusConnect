import rateLimit from "express-rate-limit";

import ApiError from "../utils/ApiError.js";

const windowMs = Number.parseInt(
  process.env.CONTACT_RATE_LIMIT_WINDOW_MS ||
    String(15 * 60 * 1000),
  10
);

const defaultMax =
  process.env.NODE_ENV === "production" ? "5" : "100";

const max = Number.parseInt(
  process.env.CONTACT_RATE_LIMIT_MAX || defaultMax,
  10
);

export const contactRateLimiter = rateLimit({
  windowMs:
    Number.isFinite(windowMs) && windowMs > 0
      ? windowMs
      : 15 * 60 * 1000,
  max: Number.isFinite(max) && max > 0 ? max : 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  validate: { keyGeneratorIpFallback: false },
  handler: (_req, _res, next, options) => {
    next(
      new ApiError(
        options.statusCode || 429,
        "Too many contact requests. Please try again later."
      )
    );
  },
});
