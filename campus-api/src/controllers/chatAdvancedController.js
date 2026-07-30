import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { assertCanUseChat } from "../services/chatPolicyService.js";

import * as messageAdvancedService from "../services/messageAdvancedService.js";
import * as notificationService from "../services/notificationService.js";
import * as callService from "../services/callService.js";

import {
  emitConversationUpdateToMembers,
  emitNewMessageCascade,
  emitMessageLifecycle,
} from "../services/chatSocketEmitter.js";

import {
  createNotificationsForMembers,
  NOTIFICATION_TYPES,
} from "../services/notificationService.js";

const requireChatAccess = (req) => {
  assertCanUseChat(req.user);
};

const withIO = async (emitter) => {
  try {
    const { getIO } = await import("../sockets/socketServer.js");
    const io = getIO();

    if (!io) {
      return null;
    }

    await emitter(io);
    return io;
  } catch {
    return null;
  }
};

const notifyNewMessage = async (io, conversation, message, actor) => {
  if (!message || !conversation) {
    return;
  }

  const memberIds = (conversation.members || [])
    .filter((member) => member.isActive)
    .map((member) => member.user);

  const preview =
    message.type === "voice"
      ? "Voice message"
      : message.type === "image"
        ? "Photo"
        : message.type === "file"
          ? "Attachment"
          : message.text || "New message";

  const isReply = Boolean(message.replyTo);
  const hasMentions = (message.mentions || []).length > 0;

  await createNotificationsForMembers({
    memberIds,
    excludeUserId: actor._id,
    type: hasMentions
      ? NOTIFICATION_TYPES.MENTION
      : isReply
        ? NOTIFICATION_TYPES.REPLY
        : NOTIFICATION_TYPES.MESSAGE,
    title: actor.name || "New message",
    body: preview,
    conversationId: message.conversationId,
    messageId: message.id,
    actorId: actor._id,
    meta: {
      type: message.type,
    },
    io,
  });
};

export const editMessage = asyncHandler(async (req, res) => {
  requireChatAccess(req);

  const message = await messageAdvancedService.editMessage(
    req.user,
    req.params.messageId,
    req.body.text
  );

  await withIO(async (io) => {
    await emitMessageLifecycle({
      io,
      eventName: "message:edited",
      message,
    });
  });

  return sendSuccess(res, 200, "Message edited", { message });
});

export const deleteMessageForMe = asyncHandler(async (req, res) => {
  requireChatAccess(req);

  const result = await messageAdvancedService.deleteMessageForMe(
    req.user,
    req.params.messageId
  );

  await withIO(async (io) => {
    io.to(`user:${req.user._id.toString()}`).emit(
      "message:deleted",
      {
        ...result,
        scope: "me",
      }
    );
  });

  return sendSuccess(res, 200, "Message deleted for you", result);
});

export const deleteMessageForEveryone = asyncHandler(
  async (req, res) => {
    requireChatAccess(req);

    const message =
      await messageAdvancedService.deleteMessageForEveryone(
        req.user,
        req.params.messageId
      );

    await withIO(async (io) => {
      await emitMessageLifecycle({
        io,
        eventName: "message:deleted",
        message,
        extra: { scope: "everyone" },
      });
    });

    return sendSuccess(res, 200, "Message deleted for everyone", {
      message,
    });
  }
);

export const reactToMessage = asyncHandler(async (req, res) => {
  requireChatAccess(req);

  const message = await messageAdvancedService.reactToMessage(
    req.user,
    req.params.messageId,
    req.body.emoji
  );

  await withIO(async (io) => {
    await emitMessageLifecycle({
      io,
      eventName: "message:reaction",
      message,
    });

    if (message.sender?.id !== req.user._id.toString()) {
      await notificationService.createNotification({
        userId: message.sender.id,
        type: NOTIFICATION_TYPES.REACTION,
        title: `${req.user.name} reacted`,
        body: req.body.emoji,
        conversationId: message.conversationId,
        messageId: message.id,
        actorId: req.user._id,
        meta: { emoji: req.body.emoji },
        io,
      });
    }
  });

  return sendSuccess(res, 200, "Reaction updated", { message });
});

export const pinMessage = asyncHandler(async (req, res) => {
  requireChatAccess(req);

  const pinned =
    req.body.pinned === undefined ? true : Boolean(req.body.pinned);

  const message = await messageAdvancedService.pinMessage(
    req.user,
    req.params.messageId,
    pinned
  );

  await withIO(async (io) => {
    await emitMessageLifecycle({
      io,
      eventName: "message:pinned",
      message,
    });
  });

  return sendSuccess(
    res,
    200,
    pinned ? "Message pinned" : "Message unpinned",
    { message }
  );
});

export const getPinnedMessages = asyncHandler(async (req, res) => {
  requireChatAccess(req);

  const messages = await messageAdvancedService.listPinnedMessages(
    req.user,
    req.params.conversationId
  );

  return sendSuccess(res, 200, "Pinned messages retrieved", {
    messages,
  });
});

export const forwardMessage = asyncHandler(async (req, res) => {
  requireChatAccess(req);

  const results = await messageAdvancedService.forwardMessage(
    req.user,
    req.params.messageId,
    req.body.conversationIds
  );

  await withIO(async (io) => {
    for (const result of results) {
      await emitNewMessageCascade({
        io,
        conversation: result.conversation,
        message: result.message,
        senderId: req.user._id,
      });

      await notifyNewMessage(
        io,
        result.conversation,
        result.message,
        req.user
      );
    }
  });

  return sendSuccess(res, 201, "Message forwarded", {
    results: results.map((item) => ({
      message: item.message,
      conversationId: item.conversation._id?.toString?.() ||
        item.conversation.id,
    })),
  });
});

export const searchMessages = asyncHandler(async (req, res) => {
  requireChatAccess(req);

  const result = await messageAdvancedService.searchMessages(
    req.user,
    req.params.conversationId,
    {
      q: req.query.q,
      senderId: req.query.senderId,
      hasAttachments: req.query.hasAttachments,
      type: req.query.type,
      from: req.query.from,
      to: req.query.to,
      limit: req.query.limit,
    }
  );

  return sendSuccess(res, 200, "Search results", result);
});

export const uploadAttachments = asyncHandler(async (req, res) => {
  requireChatAccess(req);

  const files = req.files || [];
  let waveForm = [];

  if (req.body.waveForm) {
    try {
      waveForm =
        typeof req.body.waveForm === "string"
          ? JSON.parse(req.body.waveForm)
          : req.body.waveForm;
    } catch {
      waveForm = [];
    }
  }

  const isVoice =
    req.body.asVoice === "true" ||
    req.body.asVoice === true ||
    (files.length === 1 &&
      String(files[0]?.mimetype || "").startsWith("audio/") &&
      req.body.asVoice !== "false");

  let result;

  if (isVoice) {
    result = await messageAdvancedService.sendVoiceMessage(
      req.user,
      req.params.conversationId,
      {
        file: files[0],
        duration: req.body.duration,
        waveForm,
        temporaryId: req.body.temporaryId,
        replyTo: req.body.replyTo,
      }
    );
  } else {
    result = await messageAdvancedService.sendAttachmentMessage(
      req.user,
      req.params.conversationId,
      {
        files,
        text: req.body.text || req.body.caption,
        temporaryId: req.body.temporaryId,
        replyTo: req.body.replyTo,
      }
    );
  }

  if (!result.isDuplicate) {
    await withIO(async (io) => {
      await emitNewMessageCascade({
        io,
        conversation: result.conversation,
        message: result.message,
        senderId: req.user._id,
      });

      await notifyNewMessage(
        io,
        result.conversation,
        result.message,
        req.user
      );
    });
  }

  return sendSuccess(
    res,
    result.isDuplicate ? 200 : 201,
    result.isDuplicate ? "Message already exists" : "Attachment sent",
    { message: result.message }
  );
});

export const listNotifications = asyncHandler(async (req, res) => {
  requireChatAccess(req);

  const result = await notificationService.listNotifications(
    req.user,
    req.query
  );

  return sendSuccess(res, 200, "Notifications retrieved", result);
});

export const getUnreadNotificationCount = asyncHandler(
  async (req, res) => {
    requireChatAccess(req);

    const result =
      await notificationService.getUnreadNotificationCount(req.user);

    return sendSuccess(res, 200, "Unread count retrieved", result);
  }
);

export const markNotificationRead = asyncHandler(async (req, res) => {
  requireChatAccess(req);

  const notification = await notificationService.markNotificationRead(
    req.user,
    req.params.notificationId
  );

  return sendSuccess(res, 200, "Notification marked as read", {
    notification,
  });
});

export const markAllNotificationsRead = asyncHandler(
  async (req, res) => {
    requireChatAccess(req);

    const result =
      await notificationService.markAllNotificationsRead(req.user);

    await withIO(async (io) => {
      io.to(`user:${req.user._id.toString()}`).emit(
        "notification:all-read",
        result
      );
    });

    return sendSuccess(res, 200, "All notifications marked as read", result);
  }
);

export const startCall = asyncHandler(async (req, res) => {
  requireChatAccess(req);

  const call = await callService.startCall(
    req.user,
    req.params.conversationId,
    {
      type: req.body.type,
      mode: req.body.mode,
    }
  );

  await withIO(async (io) => {
    for (const participant of call.participants) {
      if (participant.userId === req.user._id.toString()) {
        continue;
      }

      io.to(`user:${participant.userId}`).emit("call:incoming", {
        call,
      });
    }

    io.to(`conversation:${call.conversationId}`).emit(
      "call:ringing",
      { call }
    );

    io.to(`user:${req.user._id.toString()}`).emit("call:ringing", {
      call,
    });
  });

  return sendSuccess(res, 201, "Call started", { call });
});

export const getActiveCall = asyncHandler(async (req, res) => {
  requireChatAccess(req);

  const call = await callService.getActiveCallForConversation(
    req.user,
    req.params.conversationId
  );

  return sendSuccess(res, 200, "Active call retrieved", { call });
});

export const getCall = asyncHandler(async (req, res) => {
  requireChatAccess(req);

  const call = await callService.getCallById(
    req.user,
    req.params.callId
  );

  return sendSuccess(res, 200, "Call retrieved", { call });
});

export const listCalls = asyncHandler(async (req, res) => {
  requireChatAccess(req);

  const result = await callService.listCallsForUser(req.user, {
    conversationId: req.query.conversationId,
    status: req.query.status,
    type: req.query.type,
    page: req.query.page,
    limit: req.query.limit,
  });

  return sendSuccess(res, 200, "Call history retrieved", result);
});

export const listConversationCalls = asyncHandler(async (req, res) => {
  requireChatAccess(req);

  const result = await callService.listCallsForUser(req.user, {
    conversationId: req.params.conversationId,
    status: req.query.status,
    type: req.query.type,
    page: req.query.page,
    limit: req.query.limit,
  });

  return sendSuccess(
    res,
    200,
    "Conversation call history retrieved",
    result
  );
});

export const acceptCall = asyncHandler(async (req, res) => {
  requireChatAccess(req);

  const call = await callService.acceptCall(
    req.user,
    req.params.callId
  );

  await withIO(async (io) => {
    io.to(`conversation:${call.conversationId}`).emit(
      "call:accept",
      {
        call,
        acceptedBy: {
          id: req.user._id.toString(),
          name: req.user.name,
        },
      }
    );

    io.to(`conversation:${call.conversationId}`).emit(
      "call:participantJoined",
      {
        callId: call.id,
        userId: req.user._id.toString(),
        call,
      }
    );
  });

  return sendSuccess(res, 200, "Call accepted", { call });
});

export const rejectCall = asyncHandler(async (req, res) => {
  requireChatAccess(req);

  const result = await callService.rejectCall(
    req.user,
    req.params.callId
  );

  await withIO(async (io) => {
    io.to(`conversation:${result.call.conversationId}`).emit(
      "call:reject",
      {
        call: result.call,
        rejectedBy: {
          id: req.user._id.toString(),
          name: req.user.name,
        },
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
        senderId: req.user._id,
      });
    }
  });

  return sendSuccess(res, 200, "Call rejected", result);
});

export const endCall = asyncHandler(async (req, res) => {
  requireChatAccess(req);

  const result = await callService.endCall(
    req.user,
    req.params.callId
  );

  await withIO(async (io) => {
    io.to(`conversation:${result.call.conversationId}`).emit(
      "call:end",
      {
        call: result.call,
        endedBy: {
          id: req.user._id.toString(),
          name: req.user.name,
        },
      }
    );

    io.to(`conversation:${result.call.conversationId}`).emit(
      "call:participantLeft",
      {
        callId: result.call.id,
        userId: req.user._id.toString(),
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
        senderId: req.user._id,
      });
    }
  });

  return sendSuccess(res, 200, "Call ended", result);
});

void emitConversationUpdateToMembers;
