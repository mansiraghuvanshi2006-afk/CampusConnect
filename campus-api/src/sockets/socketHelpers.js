/**
 * Shared acknowledgement helpers and safe handler wrapper.
 */

import { toSocketError } from "../utils/chatErrors.js";
import { CHAT_ERROR_CODES } from "../utils/chatErrors.js";

export const ackSuccess = (data = {}) => ({
  success: true,
  data,
});

export const ackError = (
  message,
  {
    statusCode = 500,
    code = CHAT_ERROR_CODES.INTERNAL_ERROR,
    errors = [],
  } = {}
) => ({
  success: false,
  statusCode,
  code,
  message,
  errors,
});

export const withAck = (handler) => {
  return async (payload, callback) => {
    const respond = (result) => {
      if (typeof callback === "function") {
        callback(result);
      }
    };

    try {
      const data = await handler(payload || {});
      respond(ackSuccess(data || {}));
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error(
          "[socket]",
          error?.code || error?.statusCode,
          error?.message
        );
      }

      respond(toSocketError(error));
    }
  };
};

/**
 * Simple per-socket sliding-window rate limit.
 */
export const createSocketRateLimiter = ({
  max = 30,
  windowMs = 10000,
} = {}) => {
  const hits = new Map();

  return (socketId) => {
    const now = Date.now();
    const entry = hits.get(socketId) || {
      count: 0,
      resetAt: now + windowMs,
    };

    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }

    entry.count += 1;
    hits.set(socketId, entry);

    if (entry.count > max) {
      const error = new Error(
        "Too many messages. Please slow down."
      );
      error.statusCode = 429;
      error.code = CHAT_ERROR_CODES.RATE_LIMITED;
      throw error;
    }
  };
};
