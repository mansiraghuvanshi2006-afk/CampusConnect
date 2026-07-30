import { describe, expect, it } from "vitest";

import {
  getMessageActionPermissions,
  getMessagePinPermission,
  MESSAGE_EDIT_WINDOW_MS,
} from "./messagePermissions.js";

const baseMessage = {
  id: "m1",
  type: "text",
  text: "hello",
  createdAt: new Date().toISOString(),
};

describe("getMessageActionPermissions", () => {
  it("hides edit for other users", () => {
    const permissions = getMessageActionPermissions({
      message: baseMessage,
      isMine: false,
      canSend: true,
    });

    expect(permissions.canEdit).toBe(false);
    expect(permissions.canReply).toBe(true);
    expect(permissions.canDeleteEveryone).toBe(false);
  });

  it("shows edit for own recent text messages", () => {
    const permissions = getMessageActionPermissions({
      message: baseMessage,
      isMine: true,
      canSend: true,
    });

    expect(permissions.canEdit).toBe(true);
    expect(permissions.canDeleteEveryone).toBe(true);
  });

  it("hides delete for everyone unless sender, manager, or admin", () => {
    expect(
      getMessageActionPermissions({
        message: baseMessage,
        isMine: false,
        canManage: false,
        userRole: "student",
      }).canDeleteEveryone
    ).toBe(false);

    expect(
      getMessageActionPermissions({
        message: baseMessage,
        isMine: false,
        canManage: true,
      }).canDeleteEveryone
    ).toBe(true);

    expect(
      getMessageActionPermissions({
        message: baseMessage,
        isMine: false,
        userRole: "admin",
      }).canDeleteEveryone
    ).toBe(true);
  });

  it("hides actions on deleted-for-everyone messages", () => {
    const permissions = getMessageActionPermissions({
      message: { ...baseMessage, deletedForEveryone: true },
      isMine: true,
      canSend: true,
    });

    expect(permissions.canReply).toBe(false);
    expect(permissions.canReact).toBe(false);
    expect(permissions.canEdit).toBe(false);
    expect(permissions.canDeleteEveryone).toBe(false);
  });

  it("hides edit outside the edit window", () => {
    const old = new Date(
      Date.now() - MESSAGE_EDIT_WINDOW_MS - 1000
    ).toISOString();

    expect(
      getMessageActionPermissions({
        message: { ...baseMessage, createdAt: old },
        isMine: true,
        canSend: true,
      }).canEdit
    ).toBe(false);
  });
});

describe("getMessagePinPermission", () => {
  it("allows any member in direct chats", () => {
    expect(
      getMessagePinPermission({
        message: baseMessage,
        conversationType: "direct",
        isMember: true,
      })
    ).toBe(true);
  });

  it("requires manage or admin in groups", () => {
    expect(
      getMessagePinPermission({
        message: baseMessage,
        conversationType: "teacher_group",
        canManage: false,
        userRole: "student",
      })
    ).toBe(false);

    expect(
      getMessagePinPermission({
        message: baseMessage,
        conversationType: "teacher_group",
        canManage: true,
      })
    ).toBe(true);
  });
});
