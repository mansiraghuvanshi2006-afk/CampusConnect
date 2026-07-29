import { describe, expect, it } from "vitest";

import { SocketAckError } from "../socket/socketClient.js";
import { getStructuredErrorFeedback } from "./getErrorMessage.js";

describe("structured socket errors", () => {
  it("maps 403 to permission feedback", () => {
    const feedback = getStructuredErrorFeedback(
      new SocketAckError({
        message: "Access denied",
        statusCode: 403,
        code: "CHAT_ACCESS_DENIED",
      })
    );

    expect(feedback.action).toBe("permission");
    expect(feedback.statusCode).toBe(403);
  });

  it("maps 429 to rate limit feedback", () => {
    const feedback = getStructuredErrorFeedback(
      new SocketAckError({
        message: "Too many messages",
        statusCode: 429,
        code: "RATE_LIMITED",
      })
    );

    expect(feedback.action).toBe("rate_limit");
  });
});
