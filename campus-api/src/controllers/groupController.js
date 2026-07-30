import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";

import * as groupService from "../services/groupService.js";
import { assertCanUseChat } from "../services/chatPolicyService.js";
import { getOnlineUserIds } from "../sockets/socketPresence.js";

import {
  emitConversationUpdateToMembers,
  emitNewMessageCascade,
} from "../services/chatSocketEmitter.js";

import {
  buildGroupImageUrl,
  GROUP_IMAGE_MAX_BYTES,
} from "../middleware/uploadMiddleware.js";

import ApiError from "../utils/ApiError.js";

const requireChatAccess = (req) => {
  assertCanUseChat(req.user);
};

const withIO = async (emitter) => {
  try {
    const { getIO } = await import(
      "../sockets/socketServer.js"
    );

    const io = getIO();

    if (!io) {
      return;
    }

    await emitter(io);
  } catch {
    // The REST response stays successful without sockets.
  }
};

/**
 * Broadcast a membership-role change plus its system message.
 */
const broadcastGroupRoleChange = async ({
  req,
  result,
  event,
}) => {
  await withIO(async (io) => {
    const payload = {
      conversationId: req.params.conversationId,
      userId: result.userId,
      memberRole: result.memberRole || null,
      ownerId: result.ownerId || result.group.owner || null,
      actor: {
        id: req.user._id.toString(),
        name: req.user.name,
      },
      createdAt: new Date().toISOString(),
    };

    io.to(
      `conversation:${req.params.conversationId}`
    ).emit(event, payload);

    io.to(`user:${result.userId}`).emit(event, payload);

    if (result.systemMessage) {
      await emitNewMessageCascade({
        io,
        conversation: {
          _id: result.group.id,
          members: result.group.members.map((member) => ({
            user: member.id,
            isActive: true,
          })),
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
};

/**
 * GET /api/v1/chat/group-scope-options
 */
export const getGroupScopeOptions = asyncHandler(
  async (req, res) => {
    requireChatAccess(req);

    const options = await groupService.getGroupScopeOptions(
      req.user
    );

    return sendSuccess(
      res,
      200,
      "Group scope options retrieved successfully",
      options
    );
  }
);

/**
 * GET /api/v1/chat/group-member-options
 */
export const getGroupMemberOptions = asyncHandler(
  async (req, res) => {
    requireChatAccess(req);

    const result = await groupService.getGroupMemberOptions(
      req.user,
      {
        departmentId: req.query.departmentId,
        yearNumbers: req.query.yearNumbers,
        role: req.query.role,
        search: req.query.search,
        conversationId: req.query.conversationId,
        page: req.query.page,
        limit: req.query.limit,
      },
      getOnlineUserIds()
    );

    return sendSuccess(
      res,
      200,
      "Eligible group members retrieved successfully",
      result
    );
  }
);

/**
 * GET /api/v1/chat/groups
 */
export const getGroups = asyncHandler(async (req, res) => {
  requireChatAccess(req);

  const result = await groupService.listGroups(
    req.user,
    {
      departmentId: req.query.departmentId,
      yearNumbers: req.query.yearNumbers,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
    },
    getOnlineUserIds()
  );

  return sendSuccess(
    res,
    200,
    "Groups retrieved successfully",
    result
  );
});

/**
 * GET /api/v1/chat/conversations/:conversationId/members
 */
export const getGroupMembers = asyncHandler(
  async (req, res) => {
    requireChatAccess(req);

    const result = await groupService.getGroupDetails(
      req.user,
      req.params.conversationId,
      getOnlineUserIds()
    );

    return sendSuccess(
      res,
      200,
      "Group members retrieved successfully",
      result
    );
  }
);

/**
 * PATCH /api/v1/chat/conversations/:conversationId/admins/:userId/promote
 */
export const promoteGroupMember = asyncHandler(
  async (req, res) => {
    requireChatAccess(req);

    const result = await groupService.promoteGroupMember(
      req.user,
      req.params.conversationId,
      req.params.userId,
      getOnlineUserIds()
    );

    await broadcastGroupRoleChange({
      req,
      result,
      event: "group:admin-promoted",
    });

    return sendSuccess(
      res,
      200,
      "Member promoted to group admin",
      result
    );
  }
);

/**
 * PATCH /api/v1/chat/conversations/:conversationId/admins/:userId/demote
 */
export const demoteGroupMember = asyncHandler(
  async (req, res) => {
    requireChatAccess(req);

    const result = await groupService.demoteGroupMember(
      req.user,
      req.params.conversationId,
      req.params.userId,
      getOnlineUserIds()
    );

    await broadcastGroupRoleChange({
      req,
      result,
      event: "group:admin-demoted",
    });

    return sendSuccess(
      res,
      200,
      "Group admin demoted to member",
      result
    );
  }
);

/**
 * PATCH /api/v1/chat/conversations/:conversationId/owner/:userId
 */
export const transferGroupOwnership = asyncHandler(
  async (req, res) => {
    requireChatAccess(req);

    const result = await groupService.transferGroupOwnership(
      req.user,
      req.params.conversationId,
      req.params.userId,
      getOnlineUserIds()
    );

    await broadcastGroupRoleChange({
      req,
      result,
      event: "group:owner-changed",
    });

    return sendSuccess(
      res,
      200,
      "Group ownership transferred",
      result
    );
  }
);

/**
 * POST /api/v1/chat/group-image
 *
 * Uploads one image and returns the stored URL so it can be used
 * both while creating a group and while editing one.
 */
export const uploadGroupImage = asyncHandler(
  async (req, res) => {
    requireChatAccess(req);

    if (req.user.role === "student") {
      throw new ApiError(
        403,
        "Students cannot upload group images"
      );
    }

    if (!req.file) {
      throw new ApiError(400, "An image file is required");
    }

    if (req.file.size > GROUP_IMAGE_MAX_BYTES) {
      throw new ApiError(
        400,
        `Group images cannot exceed ${Math.round(GROUP_IMAGE_MAX_BYTES / (1024 * 1024))}MB`
      );
    }

    return sendSuccess(
      res,
      201,
      "Group image uploaded successfully",
      {
        image: buildGroupImageUrl(req.file.filename),
        fileName: req.file.filename,
        size: req.file.size,
        mimeType: req.file.mimetype,
      }
    );
  }
);
