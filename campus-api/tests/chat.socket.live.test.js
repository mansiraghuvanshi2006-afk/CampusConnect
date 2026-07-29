import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import http from "node:http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { io as ioc } from "socket.io-client";

import app from "../src/app.js";
import {
  getIO,
  initializeSocketServer,
} from "../src/sockets/socketServer.js";
import { resetPresenceState } from "../src/sockets/socketPresence.js";
import { resetTypingState } from "../src/sockets/handlers/conversationSocketHandler.js";
import { generateAccessToken } from "../src/services/tokenService.js";

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

process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ||
  "test_access_secret_phase4_finalize";
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ||
  "test_refresh_secret_phase4_finalize";
process.env.CLIENT_URL =
  process.env.CLIENT_URL || "http://localhost:5173";

let mongoServer;
let httpServer;
let baseUrl;
const activeClients = new Set();

const waitForEvent = (socket, event, timeoutMs = 5000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for ${event}`));
    }, timeoutMs);

    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

const trackClient = (socket) => {
  activeClients.add(socket);
  socket.on("disconnect", () => {
    activeClients.delete(socket);
  });
  return socket;
};

const connectClient = (token) => {
  const socket = ioc(baseUrl, {
    autoConnect: false,
    transports: ["websocket"],
    auth: token ? { token } : {},
    reconnection: false,
  });

  return trackClient(socket);
};

const connectAndWait = (token) =>
  new Promise((resolve, reject) => {
    const socket = connectClient(token);

    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", (error) => {
      socket.close();
      reject(error);
    });

    socket.connect();
  });

const closeTrackedClients = async () => {
  const sockets = [...activeClients];
  activeClients.clear();

  await Promise.all(
    sockets.map(
      (socket) =>
        new Promise((resolve) => {
          if (!socket.connected) {
            socket.close();
            resolve();
            return;
          }

          socket.once("disconnect", () => resolve());
          socket.close();
          setTimeout(resolve, 200);
        })
    )
  );
};

const resetLiveSocketState = async () => {
  await closeTrackedClients();

  const io = getIO();

  if (io) {
    for (const socket of io.sockets.sockets.values()) {
      socket.disconnect(true);
    }
  }

  resetPresenceState();
  resetTypingState();

  await Promise.all([
    User.deleteMany({}),
    Conversation.deleteMany({}),
    Message.deleteMany({}),
    MessageReceipt.deleteMany({}),
  ]);
};

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
  await user.save();
  return user;
};

const createTeacher = async ({
  email,
  department,
  approval = TEACHER_APPROVAL_STATUSES.PENDING,
  isActive = false,
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
  user.teachingYears = [2];
  user.teacherApprovalStatus = approval;
  await user.save();
  return user;
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  httpServer = http.createServer(app);
  await initializeSocketServer(httpServer);

  await new Promise((resolve) => {
    httpServer.listen(0, "127.0.0.1", resolve);
  });

  const { port } = httpServer.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await closeTrackedClients();

  const io = getIO();

  if (io) {
    const disconnects = [...io.sockets.sockets.values()].map(
      (socket) =>
        new Promise((resolve) => {
          socket.once("disconnect", () => resolve());
          socket.disconnect(true);
          setTimeout(resolve, 250);
        })
    );

    await Promise.all(disconnects);

    // Let async disconnect handlers finish DB/presence work.
    await new Promise((resolve) => setTimeout(resolve, 300));

    await new Promise((resolve) => {
      io.close(() => resolve());
    });
  }

  if (httpServer) {
    await new Promise((resolve) => httpServer.close(resolve));
  }

  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await resetLiveSocketState();
});

afterEach(async () => {
  await resetLiveSocketState();
});

describe("live Socket.IO authentication", () => {
  it("rejects sockets without a token", async () => {
    await expect(connectAndWait(null)).rejects.toThrow(
      /Authentication required/i
    );
  });

  it("rejects sockets with an invalid token", async () => {
    await expect(
      connectAndWait("not-a-valid-token")
    ).rejects.toThrow();
  });

  it("rejects pending teachers", async () => {
    const department = new mongoose.Types.ObjectId();
    const pending = await createTeacher({
      email: "pending-socket@campus.test",
      department,
    });

    await expect(
      connectAndWait(generateAccessToken(pending))
    ).rejects.toThrow(/approved|chat/i);
  });

  it("rejects inactive users", async () => {
    const department = new mongoose.Types.ObjectId();
    const inactive = await createStudent({
      email: "inactive-socket@campus.test",
      department,
    });

    inactive.isActive = false;
    await inactive.save();

    await expect(
      connectAndWait(generateAccessToken(inactive))
    ).rejects.toThrow(/inactive|chat/i);
  });

  it("connects a valid student", async () => {
    const department = new mongoose.Types.ObjectId();
    const student = await createStudent({
      email: "valid-socket@campus.test",
      department,
    });

    const socket = await connectAndWait(
      generateAccessToken(student)
    );

    expect(socket.connected).toBe(true);
  });
});

describe("live Socket.IO rooms and messaging", () => {
  it("allows members to join and blocks non-members", async () => {
    const department = new mongoose.Types.ObjectId();
    const studentA = await createStudent({
      email: "join-a@campus.test",
      department,
    });
    const studentB = await createStudent({
      email: "join-b@campus.test",
      department,
    });
    const outsider = await createStudent({
      email: "join-out@campus.test",
      department,
      year: 2,
    });

    const { conversation } =
      await chatService.createOrGetDirectConversation(
        studentA,
        studentB._id
      );

    const memberSocket = await connectAndWait(
      generateAccessToken(studentA)
    );
    const outsiderSocket = await connectAndWait(
      generateAccessToken(outsider)
    );

    const joinAck = await new Promise((resolve) => {
      memberSocket.emit(
        "conversation:join",
        { conversationId: conversation.id },
        resolve
      );
    });

    expect(joinAck.success).toBe(true);

    const denied = await new Promise((resolve) => {
      outsiderSocket.emit(
        "conversation:join",
        { conversationId: conversation.id },
        resolve
      );
    });

    expect(denied.success).toBe(false);
    expect(denied.statusCode).toBe(403);

    const typingDenied = await new Promise((resolve) => {
      outsiderSocket.emit(
        "message:typing",
        { conversationId: conversation.id },
        resolve
      );
    });

    expect(typingDenied.success).toBe(false);
  });

  it("delivers message:new to personal rooms and marks online delivery", async () => {
    const department = new mongoose.Types.ObjectId();
    const studentA = await createStudent({
      email: "msg-a@campus.test",
      department,
    });
    const studentB = await createStudent({
      email: "msg-b@campus.test",
      department,
    });

    const { conversation } =
      await chatService.createOrGetDirectConversation(
        studentA,
        studentB._id
      );

    const sender = await connectAndWait(
      generateAccessToken(studentA)
    );
    const recipient = await connectAndWait(
      generateAccessToken(studentB)
    );

    const personalMessagePromise = waitForEvent(
      recipient,
      "message:new"
    );
    const deliveryPromise = waitForEvent(
      sender,
      "message:delivered"
    );

    const ack = await new Promise((resolve) => {
      sender.emit(
        "message:send",
        {
          conversationId: conversation.id,
          text: "hello live",
          temporaryId: "live-tmp-1",
        },
        resolve
      );
    });

    expect(ack.success).toBe(true);
    expect(ack.data.message.id).toBeTruthy();

    const personalPayload = await personalMessagePromise;
    expect(personalPayload.message.id).toBe(
      ack.data.message.id
    );

    const delivery = await deliveryPromise;
    expect(delivery.messageIds).toContain(
      ack.data.message.id
    );

    const receiptCount = await MessageReceipt.countDocuments({
      message: ack.data.message.id,
      user: studentB._id,
      deliveredAt: { $ne: null },
    });

    expect(receiptCount).toBe(1);

    const retry = await new Promise((resolve) => {
      sender.emit(
        "message:send",
        {
          conversationId: conversation.id,
          text: "hello live",
          temporaryId: "live-tmp-1",
        },
        resolve
      );
    });

    expect(retry.success).toBe(true);
    expect(retry.data.message.id).toBe(ack.data.message.id);

    const messageCount = await Message.countDocuments({
      conversation: conversation.id,
      type: "text",
    });

    expect(messageCount).toBe(1);
  });

  it("keeps presence scoped and multi-socket safe", async () => {
    const department = new mongoose.Types.ObjectId();
    const studentA = await createStudent({
      email: "presence-a@campus.test",
      department,
    });
    const studentB = await createStudent({
      email: "presence-b@campus.test",
      department,
    });
    const unrelated = await createStudent({
      email: "presence-u@campus.test",
      department,
      year: 3,
    });

    await chatService.createOrGetDirectConversation(
      studentA,
      studentB._id
    );

    const watcher = await connectAndWait(
      generateAccessToken(studentB)
    );
    const stranger = await connectAndWait(
      generateAccessToken(unrelated)
    );

    const studentAId = studentA._id.toString();

    const onlinePromise = waitForEvent(
      watcher,
      "presence:online"
    );

    let strangerSawTargetOnline = false;
    stranger.on("presence:online", (payload) => {
      if (payload?.userId === studentAId) {
        strangerSawTargetOnline = true;
      }
    });

    const first = await connectAndWait(
      generateAccessToken(studentA)
    );
    const onlinePayload = await onlinePromise;
    expect(onlinePayload.userId).toBe(studentAId);

    const second = await connectAndWait(
      generateAccessToken(studentA)
    );

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(strangerSawTargetOnline).toBe(false);

    const offlinePromise = waitForEvent(
      watcher,
      "presence:offline"
    );

    first.close();
    await new Promise((resolve) => setTimeout(resolve, 150));

    second.close();
    const offlinePayload = await offlinePromise;
    expect(offlinePayload.userId).toBe(studentAId);

    expect(strangerSawTargetOnline).toBe(false);
  });

  it("forces removed members out of conversation rooms", async () => {
    const department = new mongoose.Types.ObjectId();
    const teacher = await User.create({
      name: "Teacher GroupOwner",
      email: "owner@campus.test",
      password: "Password1!",
      role: USER_ROLES.TEACHER,
    });
    teacher.isEmailVerified = true;
    teacher.isActive = true;
    teacher.profileCompleted = true;
    teacher.department = department;
    teacher.teachingYears = [2];
    teacher.teacherApprovalStatus =
      TEACHER_APPROVAL_STATUSES.APPROVED;
    await teacher.save();

    const student = await createStudent({
      email: "remove-me@campus.test",
      department,
    });

    const group = await Conversation.create({
      type: CONVERSATION_TYPES.TEACHER_GROUP,
      name: "Removal Group",
      createdBy: teacher._id,
      department,
      academicYears: [2],
      members: [
        {
          user: teacher._id,
          role: CONVERSATION_MEMBER_ROLES.ADMIN,
          addedBy: teacher._id,
        },
        {
          user: student._id,
          role: CONVERSATION_MEMBER_ROLES.MEMBER,
          addedBy: teacher._id,
        },
      ],
    });

    const conversationId = group._id.toString();
    const studentId = student._id.toString();

    const teacherSocket = await connectAndWait(
      generateAccessToken(teacher)
    );
    const studentSocket = await connectAndWait(
      generateAccessToken(student)
    );

    await new Promise((resolve) => {
      teacherSocket.emit(
        "conversation:join",
        { conversationId },
        resolve
      );
    });

    await new Promise((resolve) => {
      studentSocket.emit(
        "conversation:join",
        { conversationId },
        resolve
      );
    });

    const removedPromise = waitForEvent(
      studentSocket,
      "member:removed"
    );
    const teacherUpdatePromise = waitForEvent(
      teacherSocket,
      "conversation:updated"
    );

    const response = await request(httpServer)
      .delete(
        `/api/v1/chat/conversations/${conversationId}/members/${studentId}`
      )
      .set(
        "Authorization",
        `Bearer ${generateAccessToken(teacher)}`
      );

    expect(response.status).toBe(200);

    const removedPayload = await removedPromise;
    expect(removedPayload.removedUserId).toBe(studentId);
    expect(removedPayload.conversationId).toBe(
      conversationId
    );

    const teacherUpdate = await teacherUpdatePromise;
    expect(teacherUpdate.conversation.id).toBe(
      conversationId
    );

    // forceLeaveConversation + membership soft-delete: rejoin must fail.
    const rejoin = await new Promise((resolve) => {
      studentSocket.emit(
        "conversation:join",
        { conversationId },
        resolve
      );
    });

    expect(rejoin.success).toBe(false);
    expect(rejoin.statusCode).toBe(403);
  });
});
