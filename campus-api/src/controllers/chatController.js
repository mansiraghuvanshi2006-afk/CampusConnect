import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";

import * as chatService from "../services/chatService.js";
import { assertCanUseChat } from "../services/chatPolicyService.js";
import { getOnlineUserIds } from "../sockets/socketPresence.js";

import {
  emitConversationUpdateToMembers,
  emitNewMessageCascade,
} from "../services/chatSocketEmitter.js";

const requireChatAccess = (req) => {
  assertCanUseChat(req.user);
};

const withIO = async (emitter) => {
  try {
    const { getIO, forceLeaveConversation } = await import(
      "../sockets/socketServer.js"
    );

    const io = getIO();

    if (!io) {
      return;
    }

    await emitter(io, forceLeaveConversation);
  } catch {
    // Socket layer is optional for REST path success.
  }
};

export const getEligibleUsers = asyncHandler(
  async (req, res) => {
    requireChatAccess(req);

    const result = await chatService.listEligibleUsers(
      req.user,
      {
        search: req.query.search,
        role: req.query.role,
        year: req.query.year,
        page: req.query.page,
        limit: req.query.limit,
      },
      getOnlineUserIds()
    );

    return sendSuccess(
      res,
      200,
      "Eligible chat users retrieved successfully",
      result
    );
  }
);

export const getConversations = asyncHandler(
  async (req, res) => {
    requireChatAccess(req);

    const conversations =
      await chatService.listConversations(
        req.user,
        getOnlineUserIds()
      );

    return sendSuccess(
      res,
      200,
      "Conversations retrieved successfully",
      { conversations }
    );
  }
);

export const createDirectConversation = asyncHandler(
  async (req, res) => {
    requireChatAccess(req);

    const result =
      await chatService.createOrGetDirectConversation(
        req.user,
        req.body.userId,
        getOnlineUserIds()
      );

    if (result.wasCreated) {
      await withIO(async (io) => {
        await emitConversationUpdateToMembers({
          io,
          conversationId: result.conversation.id,
        });
      });
    }

    return sendSuccess(
      res,
      result.wasCreated ? 201 : 200,
      result.wasCreated
        ? "Direct conversation created"
        : "Direct conversation ready",
      {
        conversation: result.conversation,
        wasCreated: result.wasCreated,
      }
    );
  }
);

export const createGroupConversation = asyncHandler(
  async (req, res) => {
    requireChatAccess(req);

    const result = await chatService.createGroupConversation(
      req.user,
      req.body,
      getOnlineUserIds()
    );

    await withIO(async (io) => {
      await emitConversationUpdateToMembers({
        io,
        conversationId: result.conversation.id,
      });

      if (result.systemMessage) {
        await emitNewMessageCascade({
          io,
          conversation: {
            _id: result.conversation.id,
            members: result.conversation.members.map(
              (member) => ({
                user: member.id,
                isActive: true,
              })
            ),
          },
          message: result.systemMessage,
          senderId: req.user._id,
        });
      }
    });

    return sendSuccess(
      res,
      201,
      "Group conversation created successfully",
      result
    );
  }
);

export const getConversation = asyncHandler(
  async (req, res) => {
    requireChatAccess(req);

    const conversation =
      await chatService.getConversationById(
        req.user,
        req.params.conversationId,
        getOnlineUserIds()
      );

    return sendSuccess(
      res,
      200,
      "Conversation retrieved successfully",
      { conversation }
    );
  }
);

export const updateConversation = asyncHandler(
  async (req, res) => {
    requireChatAccess(req);

    const conversation =
      await chatService.updateConversation(
        req.user,
        req.params.conversationId,
        req.body,
        getOnlineUserIds()
      );

    await withIO(async (io) => {
      await emitConversationUpdateToMembers({
        io,
        conversationId: conversation.id,
      });
    });

    return sendSuccess(
      res,
      200,
      "Conversation updated successfully",
      { conversation }
    );
  }
);

export const deleteConversation = asyncHandler(
  async (req, res) => {
    requireChatAccess(req);

    const conversation =
      await chatService.deactivateConversation(
        req.user,
        req.params.conversationId
      );

    await withIO(async (io) => {
      await emitConversationUpdateToMembers({
        io,
        conversationId: req.params.conversationId,
      });
    });

    return sendSuccess(
      res,
      200,
      "Conversation deactivated successfully",
      { conversation }
    );
  }
);

export const getMessages = asyncHandler(async (req, res) => {
  requireChatAccess(req);

  const result = await chatService.getMessages(
    req.user,
    req.params.conversationId,
    {
      before: req.query.before,
      limit: req.query.limit,
    }
  );

  return sendSuccess(
    res,
    200,
    "Messages retrieved successfully",
    result
  );
});

export const sendMessage = asyncHandler(async (req, res) => {
  requireChatAccess(req);

  const result = await chatService.sendTextMessage(
    req.user,
    req.params.conversationId,
    req.body
  );

  if (!result.isDuplicate) {
    await withIO(async (io) => {
      await emitNewMessageCascade({
        io,
        conversation: result.conversation,
        message: result.message,
        senderId: req.user._id,
      });

      const { createNotificationsForMembers, NOTIFICATION_TYPES } =
        await import("../services/notificationService.js");

      const memberIds = (result.conversation.members || [])
        .filter((member) => member.isActive)
        .map((member) => member.user);

      const hasMentions = (result.message.mentions || []).length > 0;
      const isReply = Boolean(result.message.replyTo);

      await createNotificationsForMembers({
        memberIds,
        excludeUserId: req.user._id,
        type: hasMentions
          ? NOTIFICATION_TYPES.MENTION
          : isReply
            ? NOTIFICATION_TYPES.REPLY
            : NOTIFICATION_TYPES.MESSAGE,
        title: req.user.name || "New message",
        body: result.message.text || "New message",
        conversationId: result.message.conversationId,
        messageId: result.message.id,
        actorId: req.user._id,
        io,
      });
    });
  }

  return sendSuccess(
    res,
    result.isDuplicate ? 200 : 201,
    result.isDuplicate
      ? "Message already exists"
      : "Message sent successfully",
    { message: result.message }
  );
});

export const addMembers = asyncHandler(async (req, res) => {
  requireChatAccess(req);

  const result = await chatService.addConversationMembers(
    req.user,
    req.params.conversationId,
    req.body.memberIds,
    getOnlineUserIds()
  );

  await withIO(async (io) => {
    const createdAt = new Date().toISOString();

    for (const member of result.addedMembers) {
      const payload = {
        conversationId: req.params.conversationId,
        member,
        addedBy: {
          id: req.user._id.toString(),
          name: req.user.name,
        },
        createdAt,
      };

      io.to(
        `conversation:${req.params.conversationId}`
      ).emit("member:added", payload);

      io.to(`user:${member.id}`).emit(
        "member:added",
        payload
      );
    }

    for (const message of result.systemMessages) {
      await emitNewMessageCascade({
        io,
        conversation: result.conversation.members
          ? {
              _id: result.conversation.id,
              members: result.conversation.members.map(
                (member) => ({
                  user: member.id,
                  isActive: true,
                })
              ),
            }
          : result.conversation,
        message,
        senderId: req.user._id,
      });
    }

    await emitConversationUpdateToMembers({
      io,
      conversationId: req.params.conversationId,
    });
  });

  return sendSuccess(
    res,
    200,
    "Members added successfully",
    result
  );
});

export const removeMember = asyncHandler(async (req, res) => {
  requireChatAccess(req);

  const result = await chatService.removeConversationMember(
    req.user,
    req.params.conversationId,
    req.params.userId,
    getOnlineUserIds()
  );

  await withIO(async (io, forceLeaveConversation) => {
    const payload = {
      conversationId: req.params.conversationId,
      removedUserId: result.removedUserId,
      removedBy: {
        id: req.user._id.toString(),
        name: req.user.name,
      },
      createdAt: new Date().toISOString(),
    };

    io.to(
      `conversation:${req.params.conversationId}`
    ).emit("member:removed", payload);

    io.to(`user:${result.removedUserId}`).emit(
      "member:removed",
      payload
    );

    if (typeof forceLeaveConversation === "function") {
      forceLeaveConversation(
        result.removedUserId,
        req.params.conversationId
      );
    }

    if (result.systemMessage) {
      await emitNewMessageCascade({
        io,
        conversation: {
          _id: result.conversation.id,
          members: result.conversation.members.map(
            (member) => ({
              user: member.id,
              isActive: true,
            })
          ),
        },
        message: result.systemMessage,
        senderId: req.user._id,
      });
    }

    await emitConversationUpdateToMembers({
      io,
      conversationId: req.params.conversationId,
    });
  });

  return sendSuccess(
    res,
    200,
    "Member removed successfully",
    result
  );
});

export const markConversationRead = asyncHandler(
  async (req, res) => {
    requireChatAccess(req);

    const result = await chatService.markMessagesRead(
      req.user,
      req.params.conversationId,
      req.body?.messageIds || null
    );

    await withIO(async (io) => {
      io.to(
        `conversation:${req.params.conversationId}`
      ).emit("message:read", result);

      await emitConversationUpdateToMembers({
        io,
        conversationId: req.params.conversationId,
      });
    });

    return sendSuccess(
      res,
      200,
      "Conversation marked as read",
      result
    );
  }
);

export const pinConversation = asyncHandler(
  async (req, res) => {
    requireChatAccess(req);

    const conversation =
      await chatService.toggleConversationPin(
        req.user,
        req.params.conversationId,
        getOnlineUserIds()
      );

    await withIO(async (io) => {
      io.to(`user:${req.user._id.toString()}`).emit(
        "conversation:updated",
        { conversation }
      );
    });

    return sendSuccess(
      res,
      200,
      conversation.isPinned
        ? "Conversation pinned"
        : "Conversation unpinned",
      { conversation }
    );
  }
);
