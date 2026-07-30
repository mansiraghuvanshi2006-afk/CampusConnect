import express from "express";

import {
  autocomplete,
  clearHistory,
  createConversation,
  editPrompt,
  getAiStatus,
  getStarters,
  listConversations,
  listMessages,
  regenerate,
  removeConversation,
  removeMessage,
  renameConversation,
  sendMessage,
} from "../controllers/aiController.js";

import authenticate from "../middleware/authenticate.js";
import requirePasswordChange from "../middleware/requirePasswordChange.js";
import {
  aiAutocompleteRateLimiter,
  aiMutationRateLimiter,
  aiRateLimiter,
} from "../middleware/aiRateLimiter.js";
import validateRequest from "../middleware/validateRequest.js";
import validateParams from "../middleware/validateParams.js";
import validateQuery from "../middleware/validateQuery.js";

import {
  aiAutocompleteSchema,
  aiConversationIdParamsSchema,
  aiMessageIdParamsSchema,
  aiMessagesQuerySchema,
  aiSearchQuerySchema,
  createAiConversationSchema,
  editAiPromptSchema,
  renameAiConversationSchema,
  sendAiMessageSchema,
} from "../validators/aiValidators.js";

const router = express.Router();

router.use(authenticate, requirePasswordChange);

router.get("/status", getAiStatus);

router.get("/starters", getStarters);

router.post(
  "/autocomplete",
  aiAutocompleteRateLimiter,
  validateRequest(aiAutocompleteSchema),
  autocomplete
);

router.get(
  "/conversations",
  validateQuery(aiSearchQuerySchema),
  listConversations
);

router.post(
  "/conversations",
  aiRateLimiter,
  validateRequest(createAiConversationSchema),
  createConversation
);

router.delete("/conversations", aiRateLimiter, clearHistory);

router.patch(
  "/conversations/:conversationId",
  aiMutationRateLimiter,
  validateParams(aiConversationIdParamsSchema),
  validateRequest(renameAiConversationSchema),
  renameConversation
);

router.delete(
  "/conversations/:conversationId",
  aiMutationRateLimiter,
  validateParams(aiConversationIdParamsSchema),
  removeConversation
);

router.get(
  "/conversations/:conversationId/messages",
  validateParams(aiConversationIdParamsSchema),
  validateQuery(aiMessagesQuerySchema),
  listMessages
);

router.post(
  "/conversations/:conversationId/messages",
  aiRateLimiter,
  validateParams(aiConversationIdParamsSchema),
  validateRequest(sendAiMessageSchema),
  sendMessage
);

router.delete(
  "/conversations/:conversationId/messages/:messageId",
  aiMutationRateLimiter,
  validateParams(aiMessageIdParamsSchema),
  removeMessage
);

router.post(
  "/conversations/:conversationId/messages/:messageId/edit",
  aiRateLimiter,
  validateParams(aiMessageIdParamsSchema),
  validateRequest(editAiPromptSchema),
  editPrompt
);

router.post(
  "/conversations/:conversationId/messages/:messageId/regenerate",
  aiRateLimiter,
  validateParams(aiMessageIdParamsSchema),
  regenerate
);

export default router;
