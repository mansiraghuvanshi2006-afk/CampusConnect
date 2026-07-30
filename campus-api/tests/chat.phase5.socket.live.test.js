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
import { io as ioc } from "socket.io-client";

import app from "../src/app.js";
import {
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
import Conversation from "../src/models/Conversation.js";
import Message from "../src/models/Message.js";
import MessageReceipt from "../src/models/MessageReceipt.js";
import Notification from "../src/models/Notification.js";
import Call from "../src/models/Call.js";
import * as chatService from "../src/services/chatService.js";

process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ||
  "test_access_secret_phase5";
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ||
  "test_refresh_secret_phase5";
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

const emitAck = (socket, event, payload) =>
  new Promise((resolve) => {
    socket.emit(event, payload, resolve);
  });

const trackClient = (socket) => {
  activeClients.add(socket);
  socket.on("disconnect", () => {
    activeClients.delete(socket);
  });
  return socket;
};

const connectAndWait = (token) =>
  new Promise((resolve, reject) => {
    const socket = trackClient(
      ioc(baseUrl, {
        autoConnect: false,
        transports: ["websocket"],
        auth: { token },
        reconnection: false,
      })
    );

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

const createStudent = async ({ email, department, year = 2 }) => {
  const user = await User.create({
    name: email.split("@")[0],
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

  httpServer = http.createServer(app);
  await initializeSocketServer(httpServer);

  await new Promise((resolve) => {
    httpServer.listen(0, "127.0.0.1", resolve);
  });

  const { port } = httpServer.address();
  baseUrl = `http://127.0.0.1:${port}`;
}, 60000);

afterAll(async () => {
  await closeTrackedClients();

  if (httpServer) {
    await new Promise((resolve) => httpServer.close(resolve));
  }

  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await closeTrackedClients();
  resetPresenceState();
  resetTypingState();

  await Promise.all([
    User.deleteMany({}),
    Conversation.deleteMany({}),
    Message.deleteMany({}),
    MessageReceipt.deleteMany({}),
    Notification.deleteMany({}),
    Call.deleteMany({}),
  ]);
});

afterEach(async () => {
  await closeTrackedClients();
});

describe("Phase 5 socket live: reactions, edits, calls", () => {
  it("broadcasts reactions and edits over sockets", async () => {
    const department = new mongoose.Types.ObjectId();
    const alice = await createStudent({
      email: "alice.socket5@test.com",
      department,
    });
    const bob = await createStudent({
      email: "bob.socket5@test.com",
      department,
    });

    const { conversation } =
      await chatService.createOrGetDirectConversation(
        alice,
        bob._id
      );

    const aliceSocket = await connectAndWait(
      generateAccessToken(alice)
    );
    const bobSocket = await connectAndWait(
      generateAccessToken(bob)
    );

    await emitAck(aliceSocket, "conversation:join", {
      conversationId: conversation.id,
    });
    await emitAck(bobSocket, "conversation:join", {
      conversationId: conversation.id,
    });

    const sendAck = await emitAck(aliceSocket, "message:send", {
      conversationId: conversation.id,
      text: "Socket phase5",
      temporaryId: "tmp-p5-1",
    });

    expect(sendAck.success).toBe(true);

    const messageId = sendAck.data.message.id;

    const editedPromise = waitForEvent(bobSocket, "message:edited");
    const editAck = await emitAck(aliceSocket, "message:edit", {
      messageId,
      text: "Edited via socket",
    });

    expect(editAck.success).toBe(true);
    const editedPayload = await editedPromise;
    expect(editedPayload.message.text).toBe("Edited via socket");

    const reactionPromise = waitForEvent(
      aliceSocket,
      "message:reaction"
    );
    const reactAck = await emitAck(bobSocket, "message:react", {
      messageId,
      emoji: "👍",
    });

    expect(reactAck.success).toBe(true);
    const reactionPayload = await reactionPromise;
    expect(reactionPayload.message.reactions[0].emoji).toBe("👍");
  }, 30000);

  it("runs call start/accept/offer signaling", async () => {
    const department = new mongoose.Types.ObjectId();
    const alice = await createStudent({
      email: "alice.call@test.com",
      department,
    });
    const bob = await createStudent({
      email: "bob.call@test.com",
      department,
    });

    const { conversation } =
      await chatService.createOrGetDirectConversation(
        alice,
        bob._id
      );

    const aliceSocket = await connectAndWait(
      generateAccessToken(alice)
    );
    const bobSocket = await connectAndWait(
      generateAccessToken(bob)
    );

    await emitAck(aliceSocket, "conversation:join", {
      conversationId: conversation.id,
    });
    await emitAck(bobSocket, "conversation:join", {
      conversationId: conversation.id,
    });

    const incomingPromise = waitForEvent(bobSocket, "call:incoming");

    const startAck = await emitAck(aliceSocket, "call:start", {
      conversationId: conversation.id,
      type: "audio",
    });

    expect(startAck.success).toBe(true);
    const incoming = await incomingPromise;
    expect(incoming.call.id).toBe(startAck.data.call.id);

    const acceptPromise = waitForEvent(aliceSocket, "call:accept");
    const acceptAck = await emitAck(bobSocket, "call:accept", {
      callId: startAck.data.call.id,
    });

    expect(acceptAck.success).toBe(true);
    const accepted = await acceptPromise;
    expect(accepted.call.status).toBe("active");

    const offerPromise = waitForEvent(bobSocket, "call:offer");
    const offerAck = await emitAck(aliceSocket, "call:offer", {
      callId: startAck.data.call.id,
      targetUserId: bob._id.toString(),
      sdp: { type: "offer", sdp: "v=0-test" },
    });

    expect(offerAck.success).toBe(true);
    const offer = await offerPromise;
    expect(offer.sdp.type).toBe("offer");

    const endAck = await emitAck(aliceSocket, "call:end", {
      callId: startAck.data.call.id,
    });

    expect(endAck.success).toBe(true);
    expect(endAck.data.call.isActive).toBe(false);
  }, 30000);

  it("rejects WebRTC signaling to a non-participant target", async () => {
    const department = new mongoose.Types.ObjectId();
    const alice = await createStudent({
      email: "alice.signal@test.com",
      department,
    });
    const bob = await createStudent({
      email: "bob.signal@test.com",
      department,
    });
    const eve = await createStudent({
      email: "eve.signal@test.com",
      department,
    });

    const { conversation } =
      await chatService.createOrGetDirectConversation(
        alice,
        bob._id
      );

    const aliceSocket = await connectAndWait(
      generateAccessToken(alice)
    );
    const bobSocket = await connectAndWait(
      generateAccessToken(bob)
    );
    const eveSocket = await connectAndWait(
      generateAccessToken(eve)
    );

    await emitAck(aliceSocket, "conversation:join", {
      conversationId: conversation.id,
    });
    await emitAck(bobSocket, "conversation:join", {
      conversationId: conversation.id,
    });

    const startAck = await emitAck(aliceSocket, "call:start", {
      conversationId: conversation.id,
      type: "audio",
    });

    expect(startAck.success).toBe(true);

    await emitAck(bobSocket, "call:accept", {
      callId: startAck.data.call.id,
    });

    let eveSawOffer = false;
    eveSocket.on("call:offer", () => {
      eveSawOffer = true;
    });

    const badOfferAck = await emitAck(aliceSocket, "call:offer", {
      callId: startAck.data.call.id,
      targetUserId: eve._id.toString(),
      sdp: { type: "offer", sdp: "v=0-evil" },
    });

    expect(badOfferAck.success).toBe(false);
    expect(badOfferAck.message).toMatch(/not a participant/i);

    const badAnswerAck = await emitAck(bobSocket, "call:answer", {
      callId: startAck.data.call.id,
      targetUserId: eve._id.toString(),
      sdp: { type: "answer", sdp: "v=0-evil" },
    });

    expect(badAnswerAck.success).toBe(false);
    expect(badAnswerAck.message).toMatch(/not a participant/i);

    const badIceAck = await emitAck(aliceSocket, "call:ice", {
      callId: startAck.data.call.id,
      targetUserId: eve._id.toString(),
      candidate: { candidate: "candidate:evil" },
    });

    expect(badIceAck.success).toBe(false);
    expect(badIceAck.message).toMatch(/not a participant/i);

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(eveSawOffer).toBe(false);

    const selfOfferAck = await emitAck(aliceSocket, "call:offer", {
      callId: startAck.data.call.id,
      targetUserId: alice._id.toString(),
      sdp: { type: "offer", sdp: "v=0-self" },
    });

    expect(selfOfferAck.success).toBe(false);
    expect(selfOfferAck.message).toMatch(/yourself/i);

    await emitAck(aliceSocket, "call:end", {
      callId: startAck.data.call.id,
    });
  }, 30000);
});
