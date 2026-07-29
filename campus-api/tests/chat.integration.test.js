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

import User, {
  USER_ROLES,
  TEACHER_APPROVAL_STATUSES,
} from "../src/models/User.js";

import "../src/models/Department.js";

import Conversation, {
  CONVERSATION_TYPES,
  CONVERSATION_MEMBER_ROLES,
} from "../src/models/Conversation.js";

import Message from "../src/models/Message.js";
import MessageReceipt from "../src/models/MessageReceipt.js";

import * as chatService from "../src/services/chatService.js";
import {
  upsertDeliveredReceipts,
  upsertSeenReceipts,
} from "../src/services/chatSocketEmitter.js";

import {
  addSocket,
  removeSocket,
  isUserOnline,
} from "../src/sockets/socketPresence.js";

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

const createTeacher = async ({
  email,
  department,
  teachingYears = [2],
  approval = TEACHER_APPROVAL_STATUSES.APPROVED,
  isActive = true,
}) => {
  const user = await User.create({
    name: `Teacher ${email.split("@")[0]}`,
    email,
    password: "Password1!",
    role: USER_ROLES.TEACHER,
  });

  user.isEmailVerified = true;
  user.isActive = isActive;
  user.profileCompleted = true;
  user.department = department;
  user.teachingYears = teachingYears;
  user.teacherApprovalStatus = approval;

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
    MessageReceipt.deleteMany({}),
  ]);
});

describe("chat integration", () => {
  it("reuses direct conversations and reports wasCreated", async () => {
    const department = new mongoose.Types.ObjectId();
    const studentA = await createStudent({
      email: "a@campus.test",
      department,
    });
    const studentB = await createStudent({
      email: "b@campus.test",
      department,
    });

    const first =
      await chatService.createOrGetDirectConversation(
        studentA,
        studentB._id
      );

    const second =
      await chatService.createOrGetDirectConversation(
        studentA,
        studentB._id
      );

    expect(first.wasCreated).toBe(true);
    expect(second.wasCreated).toBe(false);
    expect(second.conversation.id).toBe(
      first.conversation.id
    );

    const count = await Conversation.countDocuments({
      type: CONVERSATION_TYPES.DIRECT,
    });

    expect(count).toBe(1);
  });

  it("saves the same temporaryId message exactly once", async () => {
    const department = new mongoose.Types.ObjectId();
    const studentA = await createStudent({
      email: "c@campus.test",
      department,
    });
    const studentB = await createStudent({
      email: "d@campus.test",
      department,
    });

    const { conversation } =
      await chatService.createOrGetDirectConversation(
        studentA,
        studentB._id
      );

    const temporaryId = "tmp-idempotent-1";

    const first = await chatService.sendTextMessage(
      studentA,
      conversation.id,
      {
        text: "hello",
        temporaryId,
      }
    );

    const second = await chatService.sendTextMessage(
      studentA,
      conversation.id,
      {
        text: "hello",
        temporaryId,
      }
    );

    expect(second.isDuplicate).toBe(true);
    expect(second.message.id).toBe(first.message.id);

    const messages = await Message.countDocuments({
      conversation: conversation.id,
      type: "text",
    });

    expect(messages).toBe(1);
  });

  it("atomically increments unread counts for concurrent sends", async () => {
    const department = new mongoose.Types.ObjectId();
    const studentA = await createStudent({
      email: "e@campus.test",
      department,
    });
    const studentB = await createStudent({
      email: "f@campus.test",
      department,
    });

    const { conversation } =
      await chatService.createOrGetDirectConversation(
        studentA,
        studentB._id
      );

    await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        chatService.sendTextMessage(
          studentA,
          conversation.id,
          {
            text: `msg-${index}`,
            temporaryId: `tmp-${index}`,
          }
        )
      )
    );

    const refreshed = await Conversation.findById(
      conversation.id
    );

    const memberB = refreshed.members.find(
      (member) =>
        member.user.toString() === studentB._id.toString()
    );

    const memberA = refreshed.members.find(
      (member) =>
        member.user.toString() === studentA._id.toString()
    );

    expect(memberB.unreadCount).toBe(5);
    expect(memberA.unreadCount).toBe(0);
  });

  it("keeps delivery and read receipts unique under retry", async () => {
    const department = new mongoose.Types.ObjectId();
    const studentA = await createStudent({
      email: "g@campus.test",
      department,
    });
    const studentB = await createStudent({
      email: "h@campus.test",
      department,
    });

    const { conversation } =
      await chatService.createOrGetDirectConversation(
        studentA,
        studentB._id
      );

    const { message } = await chatService.sendTextMessage(
      studentA,
      conversation.id,
      { text: "receipts" }
    );

    await Promise.all([
      upsertDeliveredReceipts({
        messageId: message.id,
        conversationId: conversation.id,
        userIds: [studentB._id.toString()],
      }),
      upsertDeliveredReceipts({
        messageId: message.id,
        conversationId: conversation.id,
        userIds: [studentB._id.toString()],
      }),
    ]);

    await Promise.all([
      upsertSeenReceipts({
        messageIds: [message.id],
        conversationId: conversation.id,
        userId: studentB._id,
      }),
      upsertSeenReceipts({
        messageIds: [message.id],
        conversationId: conversation.id,
        userId: studentB._id,
      }),
    ]);

    const receiptCount = await MessageReceipt.countDocuments({
      message: message.id,
      user: studentB._id,
    });

    expect(receiptCount).toBe(1);

    const receipt = await MessageReceipt.findOne({
      message: message.id,
      user: studentB._id,
    });

    expect(receipt.deliveredAt).toBeTruthy();
    expect(receipt.seenAt).toBeTruthy();
  });

  it("supports multi-socket presence without false offline", () => {
    const userId = "presence-user-1";

    const first = addSocket(userId, "s1");
    const second = addSocket(userId, "s2");

    expect(first.wasOffline).toBe(true);
    expect(second.wasOffline).toBe(false);
    expect(isUserOnline(userId)).toBe(true);

    const afterOne = removeSocket(userId, "s1");
    expect(afterOne.isNowOffline).toBe(false);
    expect(isUserOnline(userId)).toBe(true);

    const afterAll = removeSocket(userId, "s2");
    expect(afterAll.isNowOffline).toBe(true);
    expect(isUserOnline(userId)).toBe(false);
  });

  it("blocks pending teachers from sending chat messages", async () => {
    const department = new mongoose.Types.ObjectId();
    const pending = await createTeacher({
      email: "pending@campus.test",
      department,
      approval: TEACHER_APPROVAL_STATUSES.PENDING,
      isActive: false,
    });
    const student = await createStudent({
      email: "i@campus.test",
      department,
    });

    await expect(
      chatService.createOrGetDirectConversation(
        pending,
        student._id
      )
    ).rejects.toThrow(/chat/i);
  });

  it("rejects non-members from reading messages", async () => {
    const department = new mongoose.Types.ObjectId();
    const studentA = await createStudent({
      email: "j@campus.test",
      department,
    });
    const studentB = await createStudent({
      email: "k@campus.test",
      department,
    });
    const outsider = await createStudent({
      email: "l@campus.test",
      department,
      year: 2,
    });

    const { conversation } =
      await chatService.createOrGetDirectConversation(
        studentA,
        studentB._id
      );

    await expect(
      chatService.markMessagesRead(
        outsider,
        conversation.id
      )
    ).rejects.toThrow(/member/i);
  });

  it("adds multiple members transactionally after full prevalidation", async () => {
    const department = new mongoose.Types.ObjectId();
    const teacher = await createTeacher({
      email: "teacher@campus.test",
      department,
      teachingYears: [2],
    });
    const s1 = await createStudent({
      email: "m1@campus.test",
      department,
    });
    const s2 = await createStudent({
      email: "m2@campus.test",
      department,
    });

    const group = await Conversation.create({
      type: CONVERSATION_TYPES.TEACHER_GROUP,
      name: "Lab Group",
      createdBy: teacher._id,
      department,
      academicYears: [2],
      members: [
        {
          user: teacher._id,
          role: CONVERSATION_MEMBER_ROLES.ADMIN,
          addedBy: teacher._id,
        },
      ],
    });

    const result = await chatService.addConversationMembers(
      teacher,
      group._id,
      [s1._id.toString(), s2._id.toString()]
    );

    expect(result.addedMembers).toHaveLength(2);
    expect(result.systemMessages).toHaveLength(2);

    await expect(
      chatService.addConversationMembers(
        teacher,
        group._id,
        [new mongoose.Types.ObjectId().toString()]
      )
    ).rejects.toThrow();

    const systemAfterFailure = await Message.countDocuments({
      conversation: group._id,
      type: "system",
    });

    expect(systemAfterFailure).toBe(2);
  });
});
