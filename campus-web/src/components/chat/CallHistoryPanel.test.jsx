import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import CallHistoryPanel from "./CallHistoryPanel.jsx";

vi.mock("../../services/chatService.js", () => ({
  listConversationCalls: vi.fn(async () => ({
    calls: [
      {
        id: "call-1",
        type: "audio",
        status: "ended",
        duration: 95,
        caller: { id: "u1", name: "Alice" },
        participants: [
          { userId: "u1", user: { id: "u1", name: "Alice" } },
          { userId: "u2", user: { id: "u2", name: "Bob" } },
        ],
        startedAt: "2026-07-30T10:00:00.000Z",
        createdAt: "2026-07-30T10:00:00.000Z",
      },
      {
        id: "call-2",
        type: "video",
        status: "missed",
        duration: 0,
        caller: { id: "u2", name: "Bob" },
        participants: [
          { userId: "u1", user: { id: "u1", name: "Alice" } },
          { userId: "u2", user: { id: "u2", name: "Bob" } },
        ],
        startedAt: "2026-07-30T11:00:00.000Z",
        createdAt: "2026-07-30T11:00:00.000Z",
      },
    ],
    pagination: { page: 1, total: 2 },
  })),
}));

afterEach(() => {
  cleanup();
});

describe("CallHistoryPanel", () => {
  it("renders call history entries for the conversation", async () => {
    render(
      <CallHistoryPanel
        conversationId="conv-1"
        currentUserId="u1"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Outgoing audio/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Incoming video/i)).toBeInTheDocument();
    expect(screen.getByText(/Missed/i)).toBeInTheDocument();
    expect(screen.getByText(/1:35/)).toBeInTheDocument();
  });
});
