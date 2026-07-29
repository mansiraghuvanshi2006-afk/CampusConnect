import { describe, expect, it } from "vitest";

import {
  applyCallState,
  applyMessageDeletedForEveryone,
  applyMessageDeletedForMe,
  applyMessageUpdated,
  applyNotificationNew,
} from "./chatPhase5State.js";

describe("chatPhase5State", () => {
  it("updates an edited message in place", () => {
    const messages = [
      { id: "1", text: "old" },
      { id: "2", text: "other" },
    ];

    const next = applyMessageUpdated({
      messages,
      message: { id: "1", text: "new", edited: true },
    });

    expect(next[0].text).toBe("new");
    expect(next[0].edited).toBe(true);
    expect(next[1].text).toBe("other");
  });

  it("removes delete-for-me messages", () => {
    const next = applyMessageDeletedForMe({
      messages: [{ id: "1" }, { id: "2" }],
      messageId: "1",
    });

    expect(next).toHaveLength(1);
    expect(next[0].id).toBe("2");
  });

  it("soft-deletes for everyone", () => {
    const next = applyMessageDeletedForEveryone({
      messages: [{ id: "1", text: "hello", reactions: [{ emoji: "👍" }] }],
      message: {
        id: "1",
        deletedForEveryone: true,
        text: null,
      },
    });

    expect(next[0].deletedForEveryone).toBe(true);
    expect(next[0].text).toBeNull();
    expect(next[0].reactions).toEqual([]);
  });

  it("prepends notifications and tracks unread", () => {
    const result = applyNotificationNew({
      notifications: [{ id: "a", isRead: true }],
      notification: { id: "b", isRead: false },
    });

    expect(result.notifications[0].id).toBe("b");
    expect(result.unreadCount).toBe(1);
  });

  it("tracks call lifecycle state", () => {
    let state = applyCallState({
      call: null,
      incomingCall: null,
      event: "call:incoming",
      payload: { call: { id: "c1", status: "ringing" } },
    });

    expect(state.incomingCall.id).toBe("c1");

    state = applyCallState({
      ...state,
      event: "call:accept",
      payload: { call: { id: "c1", status: "active" } },
    });

    expect(state.call.status).toBe("active");
    expect(state.incomingCall).toBeNull();

    state = applyCallState({
      ...state,
      event: "call:end",
      payload: { call: { id: "c1", status: "ended" } },
    });

    expect(state.call).toBeNull();
  });
});
