import express from "express";

import authenticate from "../middleware/authenticate.js";
import validateRequest from "../middleware/validateRequest.js";
import validateParams from "../middleware/validateParams.js";

import {
  conversationIdParamsSchema,
  memberParamsSchema,
  createDirectConversationSchema,
  createGroupConversationSchema,
  updateConversationSchema,
  sendMessageSchema,
  addMembersSchema,
  markReadSchema,
} from "../validators/chatValidators.js";

import {
  getEligibleUsers,
  getConversations,
  createDirectConversation,
  createGroupConversation,
  getConversation,
  updateConversation,
  deleteConversation,
  getMessages,
  sendMessage,
  addMembers,
  removeMember,
  markConversationRead,
  pinConversation,
} from "../controllers/chatController.js";

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/v1/chat/eligible-users
 */
router.get(
  "/eligible-users",
  getEligibleUsers
);

/**
 * GET /api/v1/chat/conversations
 */
router.get(
  "/conversations",
  getConversations
);

/**
 * POST /api/v1/chat/conversations/direct
 */
router.post(
  "/conversations/direct",
  validateRequest(createDirectConversationSchema),
  createDirectConversation
);

/**
 * POST /api/v1/chat/conversations/groups
 */
router.post(
  "/conversations/groups",
  validateRequest(createGroupConversationSchema),
  createGroupConversation
);

/**
 * GET /api/v1/chat/conversations/:conversationId
 */
router.get(
  "/conversations/:conversationId",
  validateParams(conversationIdParamsSchema),
  getConversation
);

/**
 * PATCH /api/v1/chat/conversations/:conversationId
 */
router.patch(
  "/conversations/:conversationId",
  validateParams(conversationIdParamsSchema),
  validateRequest(updateConversationSchema),
  updateConversation
);

/**
 * DELETE /api/v1/chat/conversations/:conversationId
 */
router.delete(
  "/conversations/:conversationId",
  validateParams(conversationIdParamsSchema),
  deleteConversation
);

/**
 * GET /api/v1/chat/conversations/:conversationId/messages
 */
router.get(
  "/conversations/:conversationId/messages",
  validateParams(conversationIdParamsSchema),
  getMessages
);

/**
 * POST /api/v1/chat/conversations/:conversationId/messages
 */
router.post(
  "/conversations/:conversationId/messages",
  validateParams(conversationIdParamsSchema),
  validateRequest(sendMessageSchema),
  sendMessage
);

/**
 * POST /api/v1/chat/conversations/:conversationId/members
 */
router.post(
  "/conversations/:conversationId/members",
  validateParams(conversationIdParamsSchema),
  validateRequest(addMembersSchema),
  addMembers
);

/**
 * DELETE /api/v1/chat/conversations/:conversationId/members/:userId
 */
router.delete(
  "/conversations/:conversationId/members/:userId",
  validateParams(memberParamsSchema),
  removeMember
);

/**
 * PATCH /api/v1/chat/conversations/:conversationId/read
 */
router.patch(
  "/conversations/:conversationId/read",
  validateParams(conversationIdParamsSchema),
  validateRequest(markReadSchema),
  markConversationRead
);

/**
 * PATCH /api/v1/chat/conversations/:conversationId/pin
 */
router.patch(
  "/conversations/:conversationId/pin",
  validateParams(conversationIdParamsSchema),
  pinConversation
);

export default router;
