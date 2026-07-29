import User from "../models/User.js";

import {
  addSocket,
  removeSocket,
  getUserSocketIds,
} from "./socketPresence.js";

import {
  userRoom,
  conversationRoom,
} from "./socketRooms.js";

import socketAuth from "./socketAuth.js";

import {
  registerConversationHandlers,
  registerMessageHandlers,
  clearAllTypingForSocket,
} from "./handlers/conversationSocketHandler.js";

import { createSocketRateLimiter } from "./socketHelpers.js";

import {
  emitPresenceToAuthorizedUsers,
  getScopedPresenceSnapshot,
} from "../services/chatSocketEmitter.js";

let ioInstance = null;

/**
 * Initialize Socket.IO on the existing HTTP server.
 */
export const initializeSocketServer = (httpServer) => {
  return import("socket.io").then(({ Server }) => {
    const io = new Server(httpServer, {
      cors: {
        origin:
          process.env.CLIENT_URL ||
          "http://localhost:5173",
        credentials: true,
        methods: ["GET", "POST"],
      },
      transports: ["websocket", "polling"],
    });

    ioInstance = io;

    io.use(socketAuth);

    const rateLimitSend = createSocketRateLimiter({
      max: 40,
      windowMs: 15000,
    });

    io.on("connection", async (socket) => {
      const userId = socket.user.id;

      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[socket] connected user=${userId} socket=${socket.id}`
        );
      }

      await socket.join(userRoom(userId));

      const presence = addSocket(userId, socket.id);

      if (presence.wasOffline) {
        await emitPresenceToAuthorizedUsers(
          io,
          userId,
          "presence:online",
          {
            userId,
            isOnline: true,
            lastSeen: null,
          }
        );
      }

      registerConversationHandlers(io, socket);
      registerMessageHandlers(io, socket, rateLimitSend);

      const snapshot = await getScopedPresenceSnapshot(
        userId
      );

      socket.emit("presence:snapshot", snapshot);

      socket.on("disconnect", async () => {
        clearAllTypingForSocket(io, socket);

        const result = removeSocket(userId, socket.id);

        if (result.isNowOffline) {
          const lastSeen = new Date();

          try {
            await User.findByIdAndUpdate(userId, {
              lastSeenAt: lastSeen,
            });

            await emitPresenceToAuthorizedUsers(
              io,
              userId,
              "presence:offline",
              {
                userId,
                isOnline: false,
                lastSeen,
              }
            );
          } catch {
            // Connection may already be closing during test teardown.
          }
        }

        if (process.env.NODE_ENV !== "production") {
          console.log(
            `[socket] disconnected user=${userId} socket=${socket.id}`
          );
        }
      });
    });

    return io;
  });
};

export const getIO = () => ioInstance;

/**
 * Force all sockets of a user to leave a conversation room.
 */
export const forceLeaveConversation = (
  userId,
  conversationId
) => {
  if (!ioInstance) {
    return;
  }

  const socketIds = getUserSocketIds(userId);

  for (const socketId of socketIds) {
    const socket = ioInstance.sockets.sockets.get(socketId);

    if (socket) {
      socket.leave(conversationRoom(conversationId));
    }
  }
};

export default initializeSocketServer;
