import { describe, expect, it } from "vitest";

import {
  applyDeliveryReceipt,
  applyMemberRemoved,
  applyMessageNew,
  applyOptimisticReplace,
  applyReadReceipt,
  applyStopTyping,
  applyTypingUsers,
} from "./chatRealtimeState.js";

describe("chatRealtimeState", () => {
  it("deduplicates conversation-room and personal-room copies", () => {
    const message = {
      id: "m1",
      conversationId: "c1",
      text: "hello",
      sender: { id: "u2" },
      createdAt: "2026-01-01T00:00:00.000Z",
      deliveredTo: [],
      seenBy: [],
    };

    const first = applyMessageNew({
      conversations: [
        {
          id: "c1",
          unreadCount: 0,
          lastMessage: null,
        },
      ],
      messages: [],
      activeConversationId: "c1",
      currentUserId: "u1",
      message,
    });

    const second = applyMessageNew({
      conversations: first.conversations,
      messages: first.messages,
      activeConversationId: "c1",
      currentUserId: "u1",
      message,
    });

    expect(second.messages).toHaveLength(1);
  });

  it("increments unread once for inactive conversations", () => {
    const result = applyMessageNew({
      conversations: [
        {
          id: "c1",
          unreadCount: 0,
          lastMessage: null,
        },
      ],
      messages: [],
      activeConversationId: "c2",
      currentUserId: "u1",
      message: {
        id: "m1",
        conversationId: "c1",
        text: "hi",
        sender: { id: "u2" },
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    });

    expect(result.conversations[0].unreadCount).toBe(1);

    const duplicate = applyMessageNew({
      conversations: result.conversations,
      messages: [],
      activeConversationId: "c2",
      currentUserId: "u1",
      message: {
        id: "m1",
        conversationId: "c1",
        text: "hi",
        sender: { id: "u2" },
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    });

    expect(duplicate.conversations[0].unreadCount).toBe(1);
  });

  it("replaces optimistic messages by temporaryId", () => {
    const merged = applyOptimisticReplace({
      messages: [
        {
          id: "tmp-1",
          temporaryId: "tmp-1",
          conversationId: "c1",
          text: "hi",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      temporaryId: "tmp-1",
      savedMessage: {
        id: "m1",
        temporaryId: "tmp-1",
        conversationId: "c1",
        text: "hi",
        createdAt: "2026-01-01T00:00:01.000Z",
      },
    });

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("m1");
  });

  it("updates delivered and read receipt UI state", () => {
    const withDelivery = applyDeliveryReceipt({
      messages: [
        {
          id: "m1",
          deliveredTo: [],
          seenBy: [],
        },
      ],
      payload: {
        messageIds: ["m1"],
        userId: "u2",
        deliveredAt: "2026-01-01T00:00:02.000Z",
      },
    });

    expect(withDelivery[0].deliveredTo).toHaveLength(1);

    const withRead = applyReadReceipt({
      messages: withDelivery,
      conversations: [
        {
          id: "c1",
          unreadCount: 3,
        },
      ],
      payload: {
        conversationId: "c1",
        messageIds: ["m1"],
        userId: "u1",
        seenAt: "2026-01-01T00:00:03.000Z",
      },
      currentUserId: "u1",
    });

    expect(withRead.messages[0].seenBy).toHaveLength(1);
    expect(withRead.conversations[0].unreadCount).toBe(0);
  });

  it("manages typing indicators and member removal", () => {
    const typing = applyTypingUsers({
      typingUsers: [],
      payload: {
        conversationId: "c1",
        user: { id: "u2", name: "Alex" },
      },
      currentUserId: "u1",
      activeConversationId: "c1",
    });

    expect(typing).toHaveLength(1);

    const stopped = applyStopTyping({
      typingUsers: typing,
      payload: {
        conversationId: "c1",
        user: { id: "u2" },
      },
      activeConversationId: "c1",
    });

    expect(stopped).toHaveLength(0);

    const removed = applyMemberRemoved({
      conversations: [{ id: "c1" }, { id: "c2" }],
      activeConversationId: "c1",
      payload: {
        conversationId: "c1",
        removedUserId: "u1",
      },
      currentUserId: "u1",
    });

    expect(removed.shouldNavigateAway).toBe(true);
    expect(removed.conversations).toHaveLength(1);
  });
});
