import express from "express";

import authenticate from "../middleware/authenticate.js";
import requirePasswordChange from "../middleware/requirePasswordChange.js";
import validateRequest from "../middleware/validateRequest.js";
import validateParams from "../middleware/validateParams.js";
import {
  chatUpload,
  groupImageUpload,
} from "../middleware/uploadMiddleware.js";

import {
  conversationIdParamsSchema,
  memberParamsSchema,
  createDirectConversationSchema,
  createGroupConversationSchema,
  updateConversationSchema,
  sendMessageSchema,
  addMembersSchema,
  markReadSchema,
  messageIdParamsSchema,
  notificationIdParamsSchema,
  callIdParamsSchema,
  editMessageSchema,
  reactMessageSchema,
  pinMessageSchema,
  forwardMessageSchema,
  startCallSchema,
} from "../validators/chatValidators.js";

import {
  getEligibleUsers,
  getConversations,
  createDirectConversation,
  createGroupConversation,
  getConversation,
  updateConversation,
  deleteConversation,
  clearConversationForMe,
  hideConversationForMe,
  leaveConversation,
  getMessages,
  sendMessage,
  addMembers,
  removeMember,
  markConversationRead,
  pinConversation,
} from "../controllers/chatController.js";

import {
  getGroupScopeOptions,
  getGroupMemberOptions,
  getGroups,
  getGroupMembers,
  promoteGroupMember,
  demoteGroupMember,
  transferGroupOwnership,
  uploadGroupImage,
} from "../controllers/groupController.js";

import {
  editMessage,
  deleteMessageForMe,
  deleteMessageForEveryone,
  reactToMessage,
  pinMessage,
  getPinnedMessages,
  forwardMessage,
  searchMessages,
  uploadAttachments,
  listNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  startCall,
  getActiveCall,
  getCall,
  listCalls,
  listConversationCalls,
  acceptCall,
  rejectCall,
  endCall,
} from "../controllers/chatAdvancedController.js";

const router = express.Router();

router.use(authenticate, requirePasswordChange);

/**
 * GET /api/v1/chat/eligible-users
 */
router.get(
  "/eligible-users",
  getEligibleUsers
);

/**
 * Notifications
 */
router.get("/notifications", listNotifications);
router.get("/notifications/unread-count", getUnreadNotificationCount);
router.patch("/notifications/read-all", markAllNotificationsRead);
router.patch(
  "/notifications/:notificationId/read",
  validateParams(notificationIdParamsSchema),
  markNotificationRead
);

/**
 * Group creation helpers
 */
router.get("/group-scope-options", getGroupScopeOptions);
router.get("/group-member-options", getGroupMemberOptions);
router.get("/groups", getGroups);

router.post(
  "/group-image",
  groupImageUpload.single("image"),
  uploadGroupImage
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
 * Soft-delete/deactivate a group (managers or site admin).
 */
router.delete(
  "/conversations/:conversationId",
  validateParams(conversationIdParamsSchema),
  deleteConversation
);

/**
 * POST /api/v1/chat/conversations/:conversationId/clear
 * Clear chat history for the current user only.
 */
router.post(
  "/conversations/:conversationId/clear",
  validateParams(conversationIdParamsSchema),
  clearConversationForMe
);

/**
 * DELETE /api/v1/chat/conversations/:conversationId/for-me
 * Hide a direct conversation from the current user's list.
 */
router.delete(
  "/conversations/:conversationId/for-me",
  validateParams(conversationIdParamsSchema),
  hideConversationForMe
);

/**
 * POST /api/v1/chat/conversations/:conversationId/leave
 * Leave a group conversation.
 */
router.post(
  "/conversations/:conversationId/leave",
  validateParams(conversationIdParamsSchema),
  leaveConversation
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
 * POST attachments / voice
 */
router.post(
  "/conversations/:conversationId/attachments",
  validateParams(conversationIdParamsSchema),
  chatUpload.array("files", 5),
  uploadAttachments
);

/**
 * Search messages
 */
router.get(
  "/conversations/:conversationId/search",
  validateParams(conversationIdParamsSchema),
  searchMessages
);

/**
 * Pinned messages
 */
router.get(
  "/conversations/:conversationId/pinned",
  validateParams(conversationIdParamsSchema),
  getPinnedMessages
);

/**
 * Calls
 */
router.get("/calls", listCalls);

router.post(
  "/conversations/:conversationId/calls",
  validateParams(conversationIdParamsSchema),
  validateRequest(startCallSchema),
  startCall
);

router.get(
  "/conversations/:conversationId/calls",
  validateParams(conversationIdParamsSchema),
  listConversationCalls
);

router.get(
  "/conversations/:conversationId/calls/active",
  validateParams(conversationIdParamsSchema),
  getActiveCall
);

router.get(
  "/calls/:callId",
  validateParams(callIdParamsSchema),
  getCall
);

router.post(
  "/calls/:callId/accept",
  validateParams(callIdParamsSchema),
  acceptCall
);

router.post(
  "/calls/:callId/reject",
  validateParams(callIdParamsSchema),
  rejectCall
);

router.post(
  "/calls/:callId/end",
  validateParams(callIdParamsSchema),
  endCall
);

/**
 * Message lifecycle
 */
router.patch(
  "/messages/:messageId",
  validateParams(messageIdParamsSchema),
  validateRequest(editMessageSchema),
  editMessage
);

router.delete(
  "/messages/:messageId/me",
  validateParams(messageIdParamsSchema),
  deleteMessageForMe
);

router.delete(
  "/messages/:messageId/everyone",
  validateParams(messageIdParamsSchema),
  deleteMessageForEveryone
);

router.post(
  "/messages/:messageId/reactions",
  validateParams(messageIdParamsSchema),
  validateRequest(reactMessageSchema),
  reactToMessage
);

router.post(
  "/messages/:messageId/pin",
  validateParams(messageIdParamsSchema),
  validateRequest(pinMessageSchema),
  pinMessage
);

router.post(
  "/messages/:messageId/forward",
  validateParams(messageIdParamsSchema),
  validateRequest(forwardMessageSchema),
  forwardMessage
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
 * GET /api/v1/chat/conversations/:conversationId/members
 */
router.get(
  "/conversations/:conversationId/members",
  validateParams(conversationIdParamsSchema),
  getGroupMembers
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
 * Group admin role management
 */
router.patch(
  "/conversations/:conversationId/admins/:userId/promote",
  validateParams(memberParamsSchema),
  promoteGroupMember
);

router.patch(
  "/conversations/:conversationId/admins/:userId/demote",
  validateParams(memberParamsSchema),
  demoteGroupMember
);

router.patch(
  "/conversations/:conversationId/owner/:userId",
  validateParams(memberParamsSchema),
  transferGroupOwnership
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
