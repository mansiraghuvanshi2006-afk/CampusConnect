import { randomUUID } from "node:crypto";

import Message, {
  MESSAGE_TYPES,
  ALLOWED_REACTIONS,
  MESSAGE_EDIT_WINDOW_MS,
} from "../models/Message.js";

import Conversation, {
  CONVERSATION_TYPES,
} from "../models/Conversation.js";

import User, { USER_ROLES } from "../models/User.js";
import ApiError from "../utils/ApiError.js";

import {
  assertCanUseChat,
  assertCanViewConversation,
  assertCanSendMessage,
  assertCanManageConversation,
  getActiveMembership,
  isValidObjectId,
} from "./chatPolicyService.js";

import {
  formatMessage,
  populateMessageQuery,
} from "../utils/chatSerializers.js";

import {
  loadReceiptsByMessageIds,
} from "./messageReceiptService.js";

import {
  buildPublicUploadUrl,
  validateUploadedFiles,
  ALLOWED_MIME_TYPES,
} from "../middleware/uploadMiddleware.js";

const SAFE_USER_SELECT = "name role email";

const toId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  return value.toString();
};

const loadConversationOrThrow = async (conversationId) => {
  if (!isValidObjectId(conversationId)) {
    throw new ApiError(400, "Invalid conversation ID");
  }

  const conversation = await Conversation.findById(conversationId);

  if (!conversation || !conversation.isActive) {
    throw new ApiError(404, "Conversation not found");
  }

  return conversation;
};

const loadMessageOrThrow = async (messageId, conversationId = null) => {
  if (!isValidObjectId(messageId)) {
    throw new ApiError(400, "Invalid message ID");
  }

  const query = { _id: messageId, isActive: true };

  if (conversationId) {
    query.conversation = conversationId;
  }

  const message = await Message.findOne(query);

  if (!message) {
    throw new ApiError(404, "Message not found");
  }

  return message;
};

const formatWithReceipts = async (messageDoc, viewerId = null) => {
  const populated = await populateMessageQuery(
    Message.findById(messageDoc._id || messageDoc)
  ).lean();

  if (!populated) {
    return null;
  }

  if (
    viewerId &&
    (populated.deletedFor || []).some(
      (id) => toId(id) === toId(viewerId)
    )
  ) {
    return null;
  }

  const receiptMap = await loadReceiptsByMessageIds([
    populated._id,
  ]);

  return formatMessage(populated, {
    receipts: receiptMap.get(String(populated._id)) || [],
    viewerId,
  });
};

const bumpConversationLastMessage = async (
  conversationId,
  message,
  senderId
) => {
  await Conversation.updateOne(
    { _id: conversationId },
    {
      $set: {
        lastMessage: message._id,
        lastMessageAt: message.createdAt,
      },
      $inc: {
        "members.$[member].unreadCount": 1,
      },
    },
    {
      arrayFilters: [
        {
          "member.user": { $ne: senderId },
          "member.isActive": true,
        },
      ],
    }
  );

  return Conversation.findById(conversationId);
};

const extractMentions = async (text, conversation) => {
  if (!text || !text.includes("@")) {
    return [];
  }

  const memberIds = (conversation.members || [])
    .filter((member) => member.isActive)
    .map((member) => toId(member.user));

  const members = await User.find({
    _id: { $in: memberIds },
  })
    .select("name")
    .lean();

  const mentions = [];

  for (const member of members) {
    const pattern = new RegExp(
      `@${String(member.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i"
    );

    if (pattern.test(text)) {
      mentions.push(member._id);
    }
  }

  return mentions;
};

const extractLinkPreview = (text) => {
  if (!text) {
    return null;
  }

  const match = String(text).match(
    /https?:\/\/[^\s<>"']+/i
  );

  if (!match) {
    return null;
  }

  try {
    const url = new URL(match[0]);
    return {
      url: url.toString(),
      title: url.hostname,
      description: null,
      image: null,
      siteName: url.hostname,
    };
  } catch {
    return null;
  }
};

export const canPinMessage = (user, conversation) => {
  if (!getActiveMembership(conversation, user._id)) {
    return false;
  }

  if (conversation.type === CONVERSATION_TYPES.DIRECT) {
    return true;
  }

  if (user.role === USER_ROLES.ADMIN) {
    return true;
  }

  try {
    assertCanManageConversation(user, conversation);
    return true;
  } catch {
    return false;
  }
};

export const canDeleteMessageForEveryone = (
  user,
  conversation,
  message
) => {
  const senderId = toId(message.sender);
  const actorId = toId(user);

  if (senderId === actorId) {
    return true;
  }

  if (user.role === USER_ROLES.ADMIN) {
    return true;
  }

  try {
    assertCanManageConversation(user, conversation);
    return true;
  } catch {
    return false;
  }
};

export const editMessage = async (
  currentUser,
  messageId,
  text
) => {
  assertCanUseChat(currentUser);

  const message = await loadMessageOrThrow(messageId);
  const conversation = await loadConversationOrThrow(
    message.conversation
  );

  assertCanViewConversation(currentUser, conversation);

  if (toId(message.sender) !== toId(currentUser)) {
    throw new ApiError(403, "You can only edit your own messages");
  }

  if (message.type !== MESSAGE_TYPES.TEXT) {
    throw new ApiError(400, "Only text messages can be edited");
  }

  if (message.deletedForEveryone || message.deletedForEveryoneAt) {
    throw new ApiError(400, "Cannot edit a deleted message");
  }

  const ageMs = Date.now() - new Date(message.createdAt).getTime();

  if (ageMs > MESSAGE_EDIT_WINDOW_MS) {
    throw new ApiError(
      400,
      "Edit window has expired for this message"
    );
  }

  const nextText = String(text || "").trim();

  if (!nextText) {
    throw new ApiError(400, "Message text is required");
  }

  if (nextText === message.text) {
    return formatWithReceipts(message, currentUser._id);
  }

  message.editHistory.push({
    text: message.text,
    editedAt: new Date(),
  });

  message.text = nextText;
  message.edited = true;
  message.editedAt = new Date();
  message.mentions = await extractMentions(nextText, conversation);
  message.linkPreview = extractLinkPreview(nextText);

  await message.save();

  return formatWithReceipts(message, currentUser._id);
};

export const deleteMessageForMe = async (
  currentUser,
  messageId
) => {
  assertCanUseChat(currentUser);

  const message = await loadMessageOrThrow(messageId);
  const conversation = await loadConversationOrThrow(
    message.conversation
  );

  assertCanViewConversation(currentUser, conversation);

  const already = (message.deletedFor || []).some(
    (id) => toId(id) === toId(currentUser)
  );

  if (!already) {
    message.deletedFor.push(currentUser._id);
    await message.save();
  }

  return {
    messageId: toId(message),
    conversationId: toId(message.conversation),
    deletedForMe: true,
  };
};

export const deleteMessageForEveryone = async (
  currentUser,
  messageId
) => {
  assertCanUseChat(currentUser);

  const message = await loadMessageOrThrow(messageId);
  const conversation = await loadConversationOrThrow(
    message.conversation
  );

  assertCanViewConversation(currentUser, conversation);

  if (
    !canDeleteMessageForEveryone(currentUser, conversation, message)
  ) {
    throw new ApiError(
      403,
      "You do not have permission to delete this message for everyone"
    );
  }

  if (message.deletedForEveryone || message.deletedForEveryoneAt) {
    return formatWithReceipts(message, currentUser._id);
  }

  const now = new Date();
  message.deletedForEveryone = true;
  message.deletedForEveryoneAt = now;
  message.deletedAt = now;
  message.deletedBy = currentUser._id;
  // Soft-delete: keep content in DB but hide via serializer.

  await message.save();

  return formatWithReceipts(message, currentUser._id);
};

export const reactToMessage = async (
  currentUser,
  messageId,
  emoji
) => {
  assertCanUseChat(currentUser);

  if (!ALLOWED_REACTIONS.includes(emoji)) {
    throw new ApiError(400, "Unsupported reaction emoji");
  }

  const message = await loadMessageOrThrow(messageId);
  const conversation = await loadConversationOrThrow(
    message.conversation
  );

  assertCanViewConversation(currentUser, conversation);

  if (message.deletedForEveryone || message.deletedForEveryoneAt) {
    throw new ApiError(400, "Cannot react to a deleted message");
  }

  const existingIndex = (message.reactions || []).findIndex(
    (reaction) => toId(reaction.user) === toId(currentUser)
  );

  if (existingIndex >= 0) {
    if (message.reactions[existingIndex].emoji === emoji) {
      message.reactions.splice(existingIndex, 1);
    } else {
      message.reactions[existingIndex].emoji = emoji;
      message.reactions[existingIndex].reactedAt = new Date();
    }
  } else {
    message.reactions.push({
      user: currentUser._id,
      emoji,
      reactedAt: new Date(),
    });
  }

  await message.save();

  return formatWithReceipts(message, currentUser._id);
};

export const pinMessage = async (
  currentUser,
  messageId,
  pinned = true
) => {
  assertCanUseChat(currentUser);

  const message = await loadMessageOrThrow(messageId);
  const conversation = await loadConversationOrThrow(
    message.conversation
  );

  assertCanViewConversation(currentUser, conversation);

  if (!canPinMessage(currentUser, conversation)) {
    throw new ApiError(
      403,
      "You do not have permission to pin messages here"
    );
  }

  if (message.deletedForEveryone || message.deletedForEveryoneAt) {
    throw new ApiError(400, "Cannot pin a deleted message");
  }

  message.pinned = Boolean(pinned);
  message.pinnedAt = pinned ? new Date() : null;
  message.pinnedBy = pinned ? currentUser._id : null;

  await message.save();

  return formatWithReceipts(message, currentUser._id);
};

export const listPinnedMessages = async (
  currentUser,
  conversationId
) => {
  assertCanUseChat(currentUser);

  const conversation = await loadConversationOrThrow(conversationId);
  assertCanViewConversation(currentUser, conversation);

  const messages = await populateMessageQuery(
    Message.find({
      conversation: conversationId,
      isActive: true,
      pinned: true,
      deletedFor: { $ne: currentUser._id },
    }).sort({ pinnedAt: -1 })
  ).lean();

  const receiptMap = await loadReceiptsByMessageIds(
    messages.map((message) => message._id)
  );

  return messages.map((message) =>
    formatMessage(message, {
      receipts: receiptMap.get(String(message._id)) || [],
      viewerId: currentUser._id,
    })
  );
};

export const forwardMessage = async (
  currentUser,
  messageId,
  targetConversationIds
) => {
  assertCanUseChat(currentUser);

  if (
    !Array.isArray(targetConversationIds) ||
    targetConversationIds.length === 0
  ) {
    throw new ApiError(400, "At least one target conversation is required");
  }

  if (targetConversationIds.length > 10) {
    throw new ApiError(400, "Cannot forward to more than 10 chats at once");
  }

  const sourceMessage = await loadMessageOrThrow(messageId);
  const sourceConversation = await loadConversationOrThrow(
    sourceMessage.conversation
  );

  assertCanViewConversation(currentUser, sourceConversation);

  if (
    sourceMessage.deletedForEveryone ||
    sourceMessage.deletedForEveryoneAt
  ) {
    throw new ApiError(400, "Cannot forward a deleted message");
  }

  const sender =
    typeof sourceMessage.sender === "object" &&
    sourceMessage.sender?.name
      ? sourceMessage.sender
      : await User.findById(sourceMessage.sender)
          .select(SAFE_USER_SELECT)
          .lean();

  const results = [];

  for (const targetId of targetConversationIds) {
    const target = await loadConversationOrThrow(targetId);
    assertCanSendMessage(currentUser, target);

    const forwarded = await Message.create({
      conversation: targetId,
      sender: currentUser._id,
      type: sourceMessage.type,
      text: sourceMessage.text,
      attachments: sourceMessage.attachments || [],
      voice: sourceMessage.voice || null,
      forwardedFrom: {
        message: sourceMessage._id,
        conversation: sourceMessage.conversation,
        sender: sourceMessage.sender,
        senderName: sender?.name || null,
        text: sourceMessage.text,
        type: sourceMessage.type,
      },
      linkPreview: sourceMessage.linkPreview || null,
    });

    const refreshed = await bumpConversationLastMessage(
      targetId,
      forwarded,
      currentUser._id
    );

    const formatted = await formatWithReceipts(
      forwarded,
      currentUser._id
    );

    results.push({
      message: formatted,
      conversation: refreshed,
    });
  }

  return results;
};

export const searchMessages = async (
  currentUser,
  conversationId,
  filters = {}
) => {
  assertCanUseChat(currentUser);

  const conversation = await loadConversationOrThrow(conversationId);
  assertCanViewConversation(currentUser, conversation);

  const limit = Math.min(
    50,
    Math.max(1, Number(filters.limit) || 30)
  );

  const query = {
    conversation: conversationId,
    isActive: true,
    deletedFor: { $ne: currentUser._id },
    $or: [
      { deletedForEveryone: { $ne: true } },
      { deletedForEveryoneAt: null },
    ],
  };

  // Soft-deleted-for-everyone still exist; exclude from search results.
  query.deletedForEveryone = { $ne: true };
  query.deletedForEveryoneAt = null;
  delete query.$or;

  if (filters.q && String(filters.q).trim()) {
    const escaped = String(filters.q)
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    query.$or = [
      { text: { $regex: escaped, $options: "i" } },
      { "attachments.originalName": { $regex: escaped, $options: "i" } },
    ];
  }

  if (filters.senderId && isValidObjectId(filters.senderId)) {
    query.sender = filters.senderId;
  }

  if (filters.hasAttachments === true || filters.hasAttachments === "true") {
    query["attachments.0"] = { $exists: true };
  }

  if (filters.type) {
    query.type = filters.type;
  }

  if (filters.from || filters.to) {
    query.createdAt = {};

    if (filters.from) {
      query.createdAt.$gte = new Date(filters.from);
    }

    if (filters.to) {
      query.createdAt.$lte = new Date(filters.to);
    }
  }

  const messages = await populateMessageQuery(
    Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
  ).lean();

  const receiptMap = await loadReceiptsByMessageIds(
    messages.map((message) => message._id)
  );

  return {
    messages: messages.map((message) =>
      formatMessage(message, {
        receipts: receiptMap.get(String(message._id)) || [],
        viewerId: currentUser._id,
      })
    ),
    pagination: {
      limit,
      total: messages.length,
    },
  };
};

export const sendAttachmentMessage = async (
  currentUser,
  conversationId,
  {
    files = [],
    text = "",
    temporaryId = null,
    replyTo = null,
    caption = "",
  }
) => {
  assertCanUseChat(currentUser);

  const conversation = await loadConversationOrThrow(conversationId);
  assertCanSendMessage(currentUser, conversation);

  if (!files.length) {
    throw new ApiError(400, "At least one file is required");
  }

  validateUploadedFiles(files);

  if (temporaryId) {
    const existing = await populateMessageQuery(
      Message.findOne({
        sender: currentUser._id,
        temporaryId,
      })
    ).lean();

    if (existing) {
      const receiptMap = await loadReceiptsByMessageIds([
        existing._id,
      ]);

      return {
        message: formatMessage(existing, {
          receipts: receiptMap.get(String(existing._id)) || [],
          viewerId: currentUser._id,
        }),
        conversation,
        isDuplicate: true,
      };
    }
  }

  if (replyTo) {
    await loadMessageOrThrow(replyTo, conversationId);
  }

  const attachments = files.map((file) => {
    const meta = ALLOWED_MIME_TYPES[file.mimetype];
    return {
      id: randomUUID(),
      originalName: file.originalname,
      fileName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      url: buildPublicUploadUrl(file.filename),
      thumbnailUrl:
        meta?.category === "image"
          ? buildPublicUploadUrl(file.filename)
          : null,
    };
  });

  const allImages = attachments.every((item) =>
    item.mimeType.startsWith("image/")
  );

  const messageText = String(text || caption || "").trim() || null;
  const mentions = await extractMentions(messageText || "", conversation);

  const message = await Message.create({
    conversation: conversationId,
    sender: currentUser._id,
    type: allImages ? MESSAGE_TYPES.IMAGE : MESSAGE_TYPES.FILE,
    text: messageText,
    temporaryId: temporaryId || null,
    replyTo: replyTo || null,
    attachments,
    mentions,
    linkPreview: extractLinkPreview(messageText || ""),
  });

  const refreshed = await bumpConversationLastMessage(
    conversationId,
    message,
    currentUser._id
  );

  return {
    message: await formatWithReceipts(message, currentUser._id),
    conversation: refreshed,
    isDuplicate: false,
  };
};

export const sendVoiceMessage = async (
  currentUser,
  conversationId,
  {
    file,
    duration = 0,
    waveForm = [],
    temporaryId = null,
    replyTo = null,
  }
) => {
  assertCanUseChat(currentUser);

  const conversation = await loadConversationOrThrow(conversationId);
  assertCanSendMessage(currentUser, conversation);

  if (!file) {
    throw new ApiError(400, "Voice file is required");
  }

  validateUploadedFiles([file]);

  const meta = ALLOWED_MIME_TYPES[file.mimetype];

  if (meta?.category !== "voice" && !file.mimetype.startsWith("audio/")) {
    throw new ApiError(400, "File must be an audio recording");
  }

  if (temporaryId) {
    const existing = await populateMessageQuery(
      Message.findOne({
        sender: currentUser._id,
        temporaryId,
      })
    ).lean();

    if (existing) {
      const receiptMap = await loadReceiptsByMessageIds([
        existing._id,
      ]);

      return {
        message: formatMessage(existing, {
          receipts: receiptMap.get(String(existing._id)) || [],
          viewerId: currentUser._id,
        }),
        conversation,
        isDuplicate: true,
      };
    }
  }

  if (replyTo) {
    await loadMessageOrThrow(replyTo, conversationId);
  }

  const parsedDuration = Math.max(0, Number(duration) || 0);
  const parsedWave = Array.isArray(waveForm)
    ? waveForm
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
        .slice(0, 64)
    : [];

  const message = await Message.create({
    conversation: conversationId,
    sender: currentUser._id,
    type: MESSAGE_TYPES.VOICE,
    text: null,
    temporaryId: temporaryId || null,
    replyTo: replyTo || null,
    voice: {
      url: buildPublicUploadUrl(file.filename),
      duration: parsedDuration,
      mimeType: file.mimetype,
      size: file.size,
      waveForm: parsedWave,
    },
    attachments: [
      {
        id: randomUUID(),
        originalName: file.originalname || "voice-note",
        fileName: file.filename,
        mimeType: file.mimetype,
        size: file.size,
        url: buildPublicUploadUrl(file.filename),
        duration: parsedDuration,
        waveForm: parsedWave,
      },
    ],
  });

  const refreshed = await bumpConversationLastMessage(
    conversationId,
    message,
    currentUser._id
  );

  return {
    message: await formatWithReceipts(message, currentUser._id),
    conversation: refreshed,
    isDuplicate: false,
  };
};

export const enrichTextMessageFields = async (
  text,
  conversation
) => {
  const mentions = await extractMentions(text, conversation);
  const linkPreview = extractLinkPreview(text);

  return { mentions, linkPreview };
};
