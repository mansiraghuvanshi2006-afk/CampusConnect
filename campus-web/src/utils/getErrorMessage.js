const getErrorMessage = (
  error,
  fallback = "Something went wrong"
) => {
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
};

/**
 * Map structured socket/API errors to user feedback hints.
 */
export const getStructuredErrorFeedback = (error) => {
  const statusCode =
    error?.statusCode ||
    error?.response?.status ||
    null;

  const code =
    error?.code ||
    error?.response?.data?.code ||
    null;

  const message = getErrorMessage(error);

  if (statusCode === 401 || code === "SOCKET_UNAUTHORIZED") {
    return {
      statusCode: 401,
      code,
      message,
      action: "auth",
    };
  }

  if (statusCode === 403 || code === "CHAT_ACCESS_DENIED") {
    return {
      statusCode: 403,
      code,
      message,
      action: "permission",
    };
  }

  if (statusCode === 404) {
    return {
      statusCode: 404,
      code,
      message,
      action: "not_found",
    };
  }

  if (statusCode === 429 || code === "RATE_LIMITED") {
    return {
      statusCode: 429,
      code,
      message:
        message ||
        "You are sending messages too quickly. Please wait.",
      action: "rate_limit",
    };
  }

  return {
    statusCode: statusCode || 500,
    code,
    message,
    action: "generic",
  };
};

export default getErrorMessage;
