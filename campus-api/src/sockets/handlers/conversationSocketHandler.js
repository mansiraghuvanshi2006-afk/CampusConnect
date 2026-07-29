import User from "../../models/User.js";

import {
  getAuthorizedConversation,
} from "../../services/chatPolicyService.js";

import * as chatService from "../../services/chatService.js";

import {
  emitConversationUpdateToMembers,
  emitNewMessageCascade,
} from "../../services/chatSocketEmitter.js";

import { conversationRoom } from "../socketRooms.js";
import { getOnlineUserIds } from "../socketPresence.js";
import { withAck } from "../socketHelpers.js";
import {
  chatError,
  CHAT_ERROR_CODES,
} from "../../utils/chatErrors.js";

/**
 * Typing state: Map<conversationId, Map<userId, timeout>>
 */
const typingTimers = new Map();

const clearTypingState = (io, conversationId, userId) => {
  const roomTimers = typingTimers.get(conversationId);

  if (!roomTimers) {
    return;
  }

  const timer = roomTimers.get(userId);

  if (timer) {
    clearTimeout(timer);
    roomTimers.delete(userId);
  }

  if (roomTimers.size === 0) {
    typingTimers.delete(conversationId);
  }

  io.to(conversationRoom(conversationId)).emit(
    "message:stop-typing",
    {
      conversationId,
      user: {
        id: userId,
      },
    }
  );
};

export const clearAllTypingForSocket = (io, socket) => {
  for (const [conversationId, roomTimers] of typingTimers) {
    if (roomTimers.has(socket.user.id)) {
      clearTypingState(
        io,
        conversationId,
        socket.user.id
      );
    }
  }
};

/** Test-only helper — clears typing timers between live socket tests. */
export const resetTypingState = () => {
  for (const roomTimers of typingTimers.values()) {
    for (const timer of roomTimers.values()) {
      clearTimeout(timer);
    }
  }

  typingTimers.clear();
};

const loadActor = async (socketUser) => {
  const user = await User.findById(socketUser._id);

  if (!user) {
    throw chatError(
      401,
      "User not found",
      CHAT_ERROR_CODES.SOCKET_UNAUTHORIZED
    );
  }

  return user;
};

export const registerConversationHandlers = (
  io,
  socket
) => {
  socket.on(
    "conversation:join",
    withAck(async (payload) => {
      const actor = await loadActor(socket.user);

      await getAuthorizedConversation({
        user: actor,
        conversationId: payload.conversationId,
        permission: "view",
      });

      await socket.join(
        conversationRoom(payload.conversationId)
      );

      const delivery =
        await chatService.markMessagesDelivered(
          actor._id,
          payload.conversationId
        );

      if (delivery.messageIds.length > 0) {
        io.to(
          conversationRoom(payload.conversationId)
        ).emit("message:delivered", delivery);
      }

      const formatted =
        await chatService.getConversationById(
          actor,
          payload.conversationId,
          getOnlineUserIds()
        );

      return {
        conversation: formatted,
      };
    })
  );

  socket.on(
    "conversation:leave",
    withAck(async (payload) => {
      const actor = await loadActor(socket.user);

      await getAuthorizedConversation({
        user: actor,
        conversationId: payload.conversationId,
        permission: "view",
      });

      await socket.leave(
        conversationRoom(payload.conversationId)
      );

      clearTypingState(
        io,
        payload.conversationId,
        socket.user.id
      );

      return {
        conversationId: payload.conversationId,
      };
    })
  );
};

export const registerMessageHandlers = (
  io,
  socket,
  rateLimitSend
) => {
  socket.on(
    "message:send",
    withAck(async (payload) => {
      rateLimitSend(socket.id);

      const actor = await loadActor(socket.user);

      await getAuthorizedConversation({
        user: actor,
        conversationId: payload.conversationId,
        permission: "send",
      });

      const result = await chatService.sendTextMessage(
        actor,
        payload.conversationId,
        {
          text: payload.text,
          temporaryId: payload.temporaryId,
          replyTo: payload.replyTo,
        }
      );

      clearTypingState(
        io,
        payload.conversationId,
        socket.user.id
      );

      if (!result.isDuplicate) {
        await emitNewMessageCascade({
          io,
          conversation: result.conversation,
          message: result.message,
          senderId: actor._id,
        });
      }

      return {
        message: result.message,
      };
    })
  );

  socket.on(
    "message:read",
    withAck(async (payload) => {
      const actor = await loadActor(socket.user);

      await getAuthorizedConversation({
        user: actor,
        conversationId: payload.conversationId,
        permission: "view",
      });

      const result = await chatService.markMessagesRead(
        actor,
        payload.conversationId,
        payload.messageIds || null
      );

      io.to(
        conversationRoom(payload.conversationId)
      ).emit("message:read", result);

      await emitConversationUpdateToMembers({
        io,
        conversationId: payload.conversationId,
      });

      return result;
    })
  );

  socket.on(
    "message:typing",
    withAck(async (payload) => {
      const actor = await loadActor(socket.user);

      await getAuthorizedConversation({
        user: actor,
        conversationId: payload.conversationId,
        permission: "view",
      });

      const conversationId = payload.conversationId;

      if (!typingTimers.has(conversationId)) {
        typingTimers.set(conversationId, new Map());
      }

      const roomTimers = typingTimers.get(conversationId);
      const existing = roomTimers.get(socket.user.id);

      if (existing) {
        clearTimeout(existing);
      }

      roomTimers.set(
        socket.user.id,
        setTimeout(() => {
          clearTypingState(
            io,
            conversationId,
            socket.user.id
          );
        }, 4000)
      );

      socket
        .to(conversationRoom(conversationId))
        .emit("message:typing", {
          conversationId,
          user: {
            id: socket.user.id,
            name: socket.user.name,
            role: socket.user.role,
          },
        });

      return { conversationId };
    })
  );

  socket.on(
    "message:stop-typing",
    withAck(async (payload) => {
      const actor = await loadActor(socket.user);

      await getAuthorizedConversation({
        user: actor,
        conversationId: payload.conversationId,
        permission: "view",
      });

      clearTypingState(
        io,
        payload.conversationId,
        socket.user.id
      );

      return {
        conversationId: payload.conversationId,
      };
    })
  );
};
