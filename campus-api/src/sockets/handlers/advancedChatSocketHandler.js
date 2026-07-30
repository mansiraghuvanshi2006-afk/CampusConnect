import User from "../../models/User.js";

import {
  getAuthorizedConversation,
} from "../../services/chatPolicyService.js";

import * as messageAdvancedService from "../../services/messageAdvancedService.js";
import * as callService from "../../services/callService.js";
import {
  createNotification,
  NOTIFICATION_TYPES,
} from "../../services/notificationService.js";

import {
  emitMessageLifecycle,
  emitNewMessageCascade,
} from "../../services/chatSocketEmitter.js";

import {
  conversationRoom,
  userRoom,
} from "../socketRooms.js";

import { withAck, createSocketRateLimiter } from "../socketHelpers.js";
import {
  chatError,
  CHAT_ERROR_CODES,
} from "../../utils/chatErrors.js";

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

const rateLimitSignal = createSocketRateLimiter({
  max: 120,
  windowMs: 15000,
});

export const registerAdvancedMessageHandlers = (io, socket) => {
  socket.on(
    "message:edit",
    withAck(async (payload) => {
      const actor = await loadActor(socket.user);
      const message = await messageAdvancedService.editMessage(
        actor,
        payload.messageId,
        payload.text
      );

      await emitMessageLifecycle({
        io,
        eventName: "message:edited",
        message,
      });

      return { message };
    })
  );

  socket.on(
    "message:delete",
    withAck(async (payload) => {
      const actor = await loadActor(socket.user);
      const scope = payload.scope === "everyone" ? "everyone" : "me";

      if (scope === "everyone") {
        const message =
          await messageAdvancedService.deleteMessageForEveryone(
            actor,
            payload.messageId
          );

        await emitMessageLifecycle({
          io,
          eventName: "message:deleted",
          message,
          extra: { scope: "everyone" },
        });

        return { message, scope };
      }

      const result = await messageAdvancedService.deleteMessageForMe(
        actor,
        payload.messageId
      );

      io.to(userRoom(actor._id.toString())).emit("message:deleted", {
        ...result,
        scope: "me",
      });

      return { ...result, scope };
    })
  );

  socket.on(
    "message:react",
    withAck(async (payload) => {
      const actor = await loadActor(socket.user);
      const message = await messageAdvancedService.reactToMessage(
        actor,
        payload.messageId,
        payload.emoji
      );

      await emitMessageLifecycle({
        io,
        eventName: "message:reaction",
        message,
      });

      if (message.sender?.id !== actor._id.toString()) {
        await createNotification({
          userId: message.sender.id,
          type: NOTIFICATION_TYPES.REACTION,
          title: `${actor.name} reacted`,
          body: payload.emoji,
          conversationId: message.conversationId,
          messageId: message.id,
          actorId: actor._id,
          meta: { emoji: payload.emoji },
          io,
        });
      }

      return { message };
    })
  );

  socket.on(
    "message:pin",
    withAck(async (payload) => {
      const actor = await loadActor(socket.user);
      const message = await messageAdvancedService.pinMessage(
        actor,
        payload.messageId,
        payload.pinned !== false
      );

      await emitMessageLifecycle({
        io,
        eventName: "message:pinned",
        message,
      });

      return { message };
    })
  );

  socket.on(
    "message:forward",
    withAck(async (payload) => {
      const actor = await loadActor(socket.user);
      const results = await messageAdvancedService.forwardMessage(
        actor,
        payload.messageId,
        payload.conversationIds || []
      );

      for (const result of results) {
        await emitNewMessageCascade({
          io,
          conversation: result.conversation,
          message: result.message,
          senderId: actor._id,
        });
      }

      return {
        results: results.map((item) => ({
          message: item.message,
          conversationId: item.conversation._id.toString(),
        })),
      };
    })
  );
};

export const registerCallHandlers = (io, socket) => {
  socket.on(
    "call:start",
    withAck(async (payload) => {
      rateLimitSignal(socket.id);

      const actor = await loadActor(socket.user);

      await getAuthorizedConversation({
        user: actor,
        conversationId: payload.conversationId,
        permission: "view",
      });

      const call = await callService.startCall(
        actor,
        payload.conversationId,
        {
          type: payload.type || "audio",
          mode: payload.mode,
        }
      );

      for (const participant of call.participants) {
        if (participant.userId === actor._id.toString()) {
          continue;
        }

        io.to(userRoom(participant.userId)).emit("call:incoming", {
          call,
        });
      }

      io.to(conversationRoom(call.conversationId)).emit(
        "call:ringing",
        { call }
      );

      socket.emit("call:ringing", { call });

      return { call };
    })
  );

  socket.on(
    "call:accept",
    withAck(async (payload) => {
      rateLimitSignal(socket.id);
      const actor = await loadActor(socket.user);
      const call = await callService.acceptCall(actor, payload.callId);

      io.to(conversationRoom(call.conversationId)).emit(
        "call:accept",
        {
          call,
          acceptedBy: {
            id: actor._id.toString(),
            name: actor.name,
          },
        }
      );

      io.to(conversationRoom(call.conversationId)).emit(
        "call:participantJoined",
        {
          callId: call.id,
          userId: actor._id.toString(),
          call,
        }
      );

      return { call };
    })
  );

  socket.on(
    "call:reject",
    withAck(async (payload) => {
      rateLimitSignal(socket.id);
      const actor = await loadActor(socket.user);
      const result = await callService.rejectCall(
        actor,
        payload.callId
      );

      io.to(conversationRoom(result.call.conversationId)).emit(
        "call:reject",
        {
          call: result.call,
          rejectedBy: {
            id: actor._id.toString(),
            name: actor.name,
          },
        }
      );

      return result;
    })
  );

  socket.on(
    "call:busy",
    withAck(async (payload) => {
      rateLimitSignal(socket.id);
      const actor = await loadActor(socket.user);
      const call = await callService.markCallBusy(
        actor,
        payload.callId
      );

      io.to(conversationRoom(call.conversationId)).emit(
        "call:busy",
        {
          call,
          userId: actor._id.toString(),
        }
      );

      return { call };
    })
  );

  socket.on(
    "call:end",
    withAck(async (payload) => {
      rateLimitSignal(socket.id);
      const actor = await loadActor(socket.user);
      const result = await callService.endCall(actor, payload.callId);

      io.to(conversationRoom(result.call.conversationId)).emit(
        "call:end",
        {
          call: result.call,
          endedBy: {
            id: actor._id.toString(),
            name: actor.name,
          },
        }
      );

      io.to(conversationRoom(result.call.conversationId)).emit(
        "call:participantLeft",
        {
          callId: result.call.id,
          userId: actor._id.toString(),
          call: result.call,
        }
      );

      if (result.message) {
        await emitNewMessageCascade({
          io,
          conversation: {
            _id: result.call.conversationId,
            members: result.call.participants.map((p) => ({
              user: p.userId,
              isActive: true,
            })),
          },
          message: result.message,
          senderId: actor._id,
        });
      }

      return result;
    })
  );

  // WebRTC signaling — both sender and target must be call participants
  socket.on(
    "call:offer",
    withAck(async (payload) => {
      rateLimitSignal(socket.id);
      const actor = await loadActor(socket.user);
      const call = await callService.assertCallParticipant(
        actor._id,
        payload.callId
      );

      const { targetId } = callService.assertCallSignalPermission({
        call,
        actorUserId: actor._id,
        targetUserId: payload.targetUserId,
      });

      if (!payload.sdp) {
        throw chatError(400, "SDP offer is required", "INVALID_MESSAGE");
      }

      io.to(userRoom(targetId)).emit("call:offer", {
        callId: call._id.toString(),
        fromUserId: actor._id.toString(),
        sdp: payload.sdp,
      });

      return { ok: true };
    })
  );

  socket.on(
    "call:answer",
    withAck(async (payload) => {
      rateLimitSignal(socket.id);
      const actor = await loadActor(socket.user);
      const call = await callService.assertCallParticipant(
        actor._id,
        payload.callId
      );

      const { targetId } = callService.assertCallSignalPermission({
        call,
        actorUserId: actor._id,
        targetUserId: payload.targetUserId,
      });

      if (!payload.sdp) {
        throw chatError(400, "SDP answer is required", "INVALID_MESSAGE");
      }

      io.to(userRoom(targetId)).emit("call:answer", {
        callId: call._id.toString(),
        fromUserId: actor._id.toString(),
        sdp: payload.sdp,
      });

      return { ok: true };
    })
  );

  socket.on(
    "call:ice",
    withAck(async (payload) => {
      rateLimitSignal(socket.id);
      const actor = await loadActor(socket.user);
      const call = await callService.assertCallParticipant(
        actor._id,
        payload.callId
      );

      const { targetId } = callService.assertCallSignalPermission({
        call,
        actorUserId: actor._id,
        targetUserId: payload.targetUserId,
      });

      io.to(userRoom(targetId)).emit("call:ice", {
        callId: call._id.toString(),
        fromUserId: actor._id.toString(),
        candidate: payload.candidate,
      });

      return { ok: true };
    })
  );

  socket.on(
    "call:mute",
    withAck(async (payload) => {
      const actor = await loadActor(socket.user);
      const call = await callService.updateCallMediaState(
        actor,
        payload.callId,
        { muted: Boolean(payload.muted) }
      );

      io.to(conversationRoom(call.conversationId)).emit("call:mute", {
        callId: call.id,
        userId: actor._id.toString(),
        muted: Boolean(payload.muted),
        call,
      });

      return { call };
    })
  );

  socket.on(
    "call:camera",
    withAck(async (payload) => {
      const actor = await loadActor(socket.user);
      const call = await callService.updateCallMediaState(
        actor,
        payload.callId,
        { cameraOff: Boolean(payload.cameraOff) }
      );

      io.to(conversationRoom(call.conversationId)).emit(
        "call:camera",
        {
          callId: call.id,
          userId: actor._id.toString(),
          cameraOff: Boolean(payload.cameraOff),
          call,
        }
      );

      return { call };
    })
  );

  socket.on(
    "call:screenShare",
    withAck(async (payload) => {
      const actor = await loadActor(socket.user);
      const call = await callService.updateCallMediaState(
        actor,
        payload.callId,
        { screenSharing: Boolean(payload.screenSharing) }
      );

      io.to(conversationRoom(call.conversationId)).emit(
        "call:screenShare",
        {
          callId: call.id,
          userId: actor._id.toString(),
          screenSharing: Boolean(payload.screenSharing),
          call,
        }
      );

      return { call };
    })
  );
};
