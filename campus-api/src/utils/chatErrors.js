import ApiError from "../utils/ApiError.js";

export const CHAT_ERROR_CODES = Object.freeze({
  SOCKET_UNAUTHORIZED: "SOCKET_UNAUTHORIZED",
  CHAT_NOT_AVAILABLE: "CHAT_NOT_AVAILABLE",
  INVALID_CONVERSATION_ID: "INVALID_CONVERSATION_ID",
  CONVERSATION_NOT_FOUND: "CONVERSATION_NOT_FOUND",
  CHAT_ACCESS_DENIED: "CHAT_ACCESS_DENIED",
  MESSAGE_NOT_ALLOWED: "MESSAGE_NOT_ALLOWED",
  INVALID_MESSAGE: "INVALID_MESSAGE",
  RATE_LIMITED: "RATE_LIMITED",
  MEMBER_NOT_ELIGIBLE: "MEMBER_NOT_ELIGIBLE",
  MEMBER_NOT_FOUND: "MEMBER_NOT_FOUND",
  MEMBER_ALREADY_EXISTS: "MEMBER_ALREADY_EXISTS",
  LAST_ADMIN_REMOVAL_BLOCKED: "LAST_ADMIN_REMOVAL_BLOCKED",
  CONVERSATION_INACTIVE: "CONVERSATION_INACTIVE",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  INTERNAL_ERROR: "INTERNAL_ERROR",
});

/**
 * Attach a stable chat error code to an ApiError.
 */
export const chatError = (
  statusCode,
  message,
  code,
  details = null
) => {
  const error = new ApiError(statusCode, message, details);
  error.code = code;
  return error;
};

/**
 * Normalize thrown errors into socket acknowledgement payloads.
 */
export const toSocketError = (error) => {
  const statusCode =
    error?.statusCode ||
    (error?.code === 11000 ? 409 : 500);

  let code = error?.code;

  if (
    typeof code === "number" ||
    !code ||
    String(code).length < 3
  ) {
    if (statusCode === 401) {
      code = CHAT_ERROR_CODES.SOCKET_UNAUTHORIZED;
    } else if (statusCode === 403) {
      code = CHAT_ERROR_CODES.CHAT_ACCESS_DENIED;
    } else if (statusCode === 404) {
      code = CHAT_ERROR_CODES.CONVERSATION_NOT_FOUND;
    } else if (statusCode === 429) {
      code = CHAT_ERROR_CODES.RATE_LIMITED;
    } else {
      code = CHAT_ERROR_CODES.INTERNAL_ERROR;
    }
  }

  const message =
    statusCode >= 500 && process.env.NODE_ENV === "production"
      ? "Something went wrong"
      : error?.message || "Something went wrong";

  const errors = Array.isArray(error?.details)
    ? error.details
    : [];

  return {
    success: false,
    statusCode,
    code,
    message,
    errors,
  };
};
