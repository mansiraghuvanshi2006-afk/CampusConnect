import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import fs from "node:fs";
import path from "node:path";

import User, {
  USER_ROLES,
  TEACHER_APPROVAL_STATUSES,
} from "../src/models/User.js";

import "../src/models/Department.js";

import Conversation from "../src/models/Conversation.js";
import Message from "../src/models/Message.js";
import Notification from "../src/models/Notification.js";
import Call from "../src/models/Call.js";

import * as chatService from "../src/services/chatService.js";
import * as messageAdvancedService from "../src/services/messageAdvancedService.js";
import * as notificationService from "../src/services/notificationService.js";
import * as callService from "../src/services/callService.js";
import { CHAT_UPLOAD_DIR } from "../src/middleware/uploadMiddleware.js";

let mongoServer;

const createStudent = async ({
  email,
  year = 2,
  department,
}) => {
  const user = await User.create({
    name: `Student ${email.split("@")[0]}`,
    email,
    password: "Password1!",
    role: USER_ROLES.STUDENT,
  });

  user.isEmailVerified = true;
  user.isActive = true;
  user.profileCompleted = true;
  user.department = department;
  user.year = year;
  user.teacherApprovalStatus =
    TEACHER_APPROVAL_STATUSES.NOT_REQUIRED;

  await user.save();
  return user;
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Conversation.deleteMany({}),
    Message.deleteMany({}),
    Notification.deleteMany({}),
    Call.deleteMany({}),
  ]);
});

describe("Phase 5 advanced messaging", () => {
  it("edits a message within the edit window and keeps history", async () => {
    const department = new mongoose.Types.ObjectId();
    const alice = await createStudent({
      email: "alice@test.com",
      department,
    });
    const bob = await createStudent({
      email: "bob@test.com",
      department,
    });

    const { conversation } =
      await chatService.createOrGetDirectConversation(
        alice,
        bob._id
      );

    const sent = await chatService.sendTextMessage(
      alice,
      conversation.id,
      { text: "Hello world" }
    );

    const edited = await messageAdvancedService.editMessage(
      alice,
      sent.message.id,
      "Hello campus"
    );

    expect(edited.text).toBe("Hello campus");
    expect(edited.edited).toBe(true);
    expect(edited.editHistory).toHaveLength(1);
    expect(edited.editHistory[0].text).toBe("Hello world");
  });

  it("supports delete for me and delete for everyone", async () => {
    const department = new mongoose.Types.ObjectId();
    const alice = await createStudent({
      email: "alice2@test.com",
      department,
    });
    const bob = await createStudent({
      email: "bob2@test.com",
      department,
    });

    const { conversation } =
      await chatService.createOrGetDirectConversation(
        alice,
        bob._id
      );

    const sent = await chatService.sendTextMessage(
      alice,
      conversation.id,
      { text: "Secret" }
    );

    await messageAdvancedService.deleteMessageForMe(
      bob,
      sent.message.id
    );

    const bobView = await chatService.getMessages(
      bob,
      conversation.id
    );

    expect(
      bobView.messages.find((m) => m.id === sent.message.id)
    ).toBeUndefined();

    const aliceView = await chatService.getMessages(
      alice,
      conversation.id
    );

    expect(
      aliceView.messages.find((m) => m.id === sent.message.id)
    ).toBeTruthy();

    const deleted =
      await messageAdvancedService.deleteMessageForEveryone(
        alice,
        sent.message.id
      );

    expect(deleted.deletedForEveryone).toBe(true);
    expect(deleted.text).toBeNull();
  });

  it("toggles reactions with one reaction per user", async () => {
    const department = new mongoose.Types.ObjectId();
    const alice = await createStudent({
      email: "alice3@test.com",
      department,
    });
    const bob = await createStudent({
      email: "bob3@test.com",
      department,
    });

    const { conversation } =
      await chatService.createOrGetDirectConversation(
        alice,
        bob._id
      );

    const sent = await chatService.sendTextMessage(
      alice,
      conversation.id,
      { text: "React to me" }
    );

    let reacted = await messageAdvancedService.reactToMessage(
      bob,
      sent.message.id,
      "👍"
    );

    expect(reacted.reactions).toHaveLength(1);
    expect(reacted.reactions[0].emoji).toBe("👍");

    reacted = await messageAdvancedService.reactToMessage(
      bob,
      sent.message.id,
      "🔥"
    );

    expect(reacted.reactions).toHaveLength(1);
    expect(reacted.reactions[0].emoji).toBe("🔥");

    reacted = await messageAdvancedService.reactToMessage(
      bob,
      sent.message.id,
      "🔥"
    );

    expect(reacted.reactions).toHaveLength(0);
  });

  it("pins messages in direct chat and searches by text/sender", async () => {
    const department = new mongoose.Types.ObjectId();
    const alice = await createStudent({
      email: "alice4@test.com",
      department,
    });
    const bob = await createStudent({
      email: "bob4@test.com",
      department,
    });

    const { conversation } =
      await chatService.createOrGetDirectConversation(
        alice,
        bob._id
      );

    const first = await chatService.sendTextMessage(
      alice,
      conversation.id,
      { text: "Find this needle" }
    );

    await chatService.sendTextMessage(bob, conversation.id, {
      text: "Other msg",
    });

    const pinned = await messageAdvancedService.pinMessage(
      alice,
      first.message.id,
      true
    );

    expect(pinned.pinned).toBe(true);

    const pinnedList =
      await messageAdvancedService.listPinnedMessages(
        bob,
        conversation.id
      );

    expect(pinnedList).toHaveLength(1);

    const search = await messageAdvancedService.searchMessages(
      alice,
      conversation.id,
      { q: "needle" }
    );

    expect(search.messages).toHaveLength(1);
    expect(search.messages[0].id).toBe(first.message.id);

    const bySender = await messageAdvancedService.searchMessages(
      alice,
      conversation.id,
      { senderId: bob._id.toString() }
    );

    expect(bySender.messages).toHaveLength(1);
  });

  it("forwards a message to another conversation", async () => {
    const department = new mongoose.Types.ObjectId();
    const alice = await createStudent({
      email: "alice5@test.com",
      department,
    });
    const bob = await createStudent({
      email: "bob5@test.com",
      department,
    });
    const cara = await createStudent({
      email: "cara5@test.com",
      department,
    });

    const { conversation: ab } =
      await chatService.createOrGetDirectConversation(
        alice,
        bob._id
      );

    const { conversation: ac } =
      await chatService.createOrGetDirectConversation(
        alice,
        cara._id
      );

    const sent = await chatService.sendTextMessage(
      alice,
      ab.id,
      { text: "Forward me" }
    );

    const results = await messageAdvancedService.forwardMessage(
      alice,
      sent.message.id,
      [ac.id]
    );

    expect(results).toHaveLength(1);
    expect(results[0].message.forwardedFrom).toBeTruthy();
    expect(results[0].message.text).toBe("Forward me");
  });

  it("stores attachment metadata for uploaded files", async () => {
    const department = new mongoose.Types.ObjectId();
    const alice = await createStudent({
      email: "alice6@test.com",
      department,
    });
    const bob = await createStudent({
      email: "bob6@test.com",
      department,
    });

    const { conversation } =
      await chatService.createOrGetDirectConversation(
        alice,
        bob._id
      );

    fs.mkdirSync(CHAT_UPLOAD_DIR, { recursive: true });
    const fileName = `test-${Date.now()}.txt`;
    const filePath = path.join(CHAT_UPLOAD_DIR, fileName);
    fs.writeFileSync(filePath, "hello attachment");

    const fakeFile = {
      originalname: "notes.txt",
      filename: fileName,
      mimetype: "text/plain",
      size: 16,
      path: filePath,
    };

    const result =
      await messageAdvancedService.sendAttachmentMessage(
        alice,
        conversation.id,
        {
          files: [fakeFile],
          text: "See file",
        }
      );

    expect(result.message.type).toBe("file");
    expect(result.message.attachments).toHaveLength(1);
    expect(result.message.attachments[0].originalName).toBe(
      "notes.txt"
    );

    fs.unlinkSync(filePath);
  });

  it("creates and marks notifications as read", async () => {
    const department = new mongoose.Types.ObjectId();
    const alice = await createStudent({
      email: "alice7@test.com",
      department,
    });
    const bob = await createStudent({
      email: "bob7@test.com",
      department,
    });

    const notification = await notificationService.createNotification({
      userId: bob._id,
      type: "message",
      title: "Alice",
      body: "Hi",
      actorId: alice._id,
    });

    expect(notification.isRead).toBe(false);

    const listed = await notificationService.listNotifications(bob);
    expect(listed.unreadCount).toBe(1);

    await notificationService.markNotificationRead(
      bob,
      notification.id
    );

    const after = await notificationService.getUnreadNotificationCount(
      bob
    );

    expect(after.unreadCount).toBe(0);
  });

  it("starts, accepts, and ends a direct audio call", async () => {
    const department = new mongoose.Types.ObjectId();
    const alice = await createStudent({
      email: "alice8@test.com",
      department,
    });
    const bob = await createStudent({
      email: "bob8@test.com",
      department,
    });

    const { conversation } =
      await chatService.createOrGetDirectConversation(
        alice,
        bob._id
      );

    const started = await callService.startCall(
      alice,
      conversation.id,
      { type: "audio" }
    );

    expect(started.status).toBe("ringing");
    expect(started.iceServers.length).toBeGreaterThan(0);

    const accepted = await callService.acceptCall(
      bob,
      started.id
    );

    expect(accepted.status).toBe("active");

    const ended = await callService.endCall(alice, started.id);

    expect(ended.call.isActive).toBe(false);
    expect(ended.call.status).toBe("ended");
    expect(ended.message?.type).toBe("call");
  });

  it("rejects a ringing call as missed/rejected", async () => {
    const department = new mongoose.Types.ObjectId();
    const alice = await createStudent({
      email: "alice9@test.com",
      department,
    });
    const bob = await createStudent({
      email: "bob9@test.com",
      department,
    });

    const { conversation } =
      await chatService.createOrGetDirectConversation(
        alice,
        bob._id
      );

    const started = await callService.startCall(
      alice,
      conversation.id,
      { type: "video" }
    );

    const rejected = await callService.rejectCall(
      bob,
      started.id
    );

    expect(rejected.call.status).toBe("rejected");
    expect(rejected.call.isActive).toBe(false);
  });

  it("lists call history only for participants and omits ICE servers", async () => {
    const department = new mongoose.Types.ObjectId();
    const alice = await createStudent({
      email: "alice.history@test.com",
      department,
    });
    const bob = await createStudent({
      email: "bob.history@test.com",
      department,
    });
    const eve = await createStudent({
      email: "eve.history@test.com",
      department,
    });

    const { conversation } =
      await chatService.createOrGetDirectConversation(
        alice,
        bob._id
      );

    const started = await callService.startCall(
      alice,
      conversation.id,
      { type: "audio" }
    );

    await callService.acceptCall(bob, started.id);
    await callService.endCall(alice, started.id);

    const aliceHistory = await callService.listCallsForUser(
      alice,
      { conversationId: conversation.id }
    );

    expect(aliceHistory.calls).toHaveLength(1);
    expect(aliceHistory.calls[0].iceServers).toBeUndefined();
    expect(aliceHistory.calls[0].status).toBe("ended");
    expect(aliceHistory.calls[0].caller.id).toBe(
      alice._id.toString()
    );

    const eveHistory = await callService.listCallsForUser(eve, {});

    expect(eveHistory.calls).toHaveLength(0);

    await expect(
      callService.getCallById(eve, started.id)
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("rejects WebRTC signal targets outside the call", async () => {
    const department = new mongoose.Types.ObjectId();
    const alice = await createStudent({
      email: "alice.signal.unit@test.com",
      department,
    });
    const bob = await createStudent({
      email: "bob.signal.unit@test.com",
      department,
    });
    const eve = await createStudent({
      email: "eve.signal.unit@test.com",
      department,
    });

    const { conversation } =
      await chatService.createOrGetDirectConversation(
        alice,
        bob._id
      );

    const started = await callService.startCall(
      alice,
      conversation.id,
      { type: "audio" }
    );

    const call = await callService.assertCallParticipant(
      alice._id,
      started.id
    );

    expect(() =>
      callService.assertCallSignalPermission({
        call,
        actorUserId: alice._id,
        targetUserId: eve._id,
      })
    ).toThrow(/not a participant/i);

    expect(() =>
      callService.assertCallSignalPermission({
        call,
        actorUserId: alice._id,
        targetUserId: alice._id,
      })
    ).toThrow(/yourself/i);

    const allowed = callService.assertCallSignalPermission({
      call,
      actorUserId: alice._id,
      targetUserId: bob._id,
    });

    expect(allowed.targetId).toBe(bob._id.toString());
  });
});
