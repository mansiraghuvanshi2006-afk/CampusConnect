import {
  mergeMessages,
  upsertConversation,
} from "./chatHelpers.js";

/**
 * Pure helpers extracted from ChatPage for reliable unit testing.
 */

export const applyMessageNew = ({
  conversations,
  messages,
  activeConversationId,
  currentUserId,
  message,
}) => {
  const isActive =
    activeConversationId === message.conversationId;

  const nextMessages = isActive
    ? mergeMessages(messages, [message])
    : messages;

  const existing = conversations.find(
    (item) => item.id === message.conversationId
  );

  let nextConversations = conversations;
  let shouldReloadList = false;

  if (!existing) {
    shouldReloadList = true;
  } else {
    const alreadyCounted =
      existing.lastMessage?.id &&
      message.id &&
      existing.lastMessage.id === message.id;

    const unreadCount =
      isActive ||
      message.sender?.id === currentUserId ||
      alreadyCounted
        ? existing.unreadCount || 0
        : (existing.unreadCount || 0) + 1;

    nextConversations = upsertConversation(conversations, {
      ...existing,
      lastMessage: message,
      lastMessageAt: message.createdAt,
      unreadCount,
    });
  }

  return {
    messages: nextMessages,
    conversations: nextConversations,
    shouldReloadList,
    shouldMarkRead:
      isActive && message.sender?.id !== currentUserId,
  };
};

export const applyOptimisticReplace = ({
  messages,
  temporaryId,
  savedMessage,
}) => {
  return mergeMessages(
    messages.filter(
      (message) => message.temporaryId !== temporaryId
    ),
    [savedMessage]
  );
};

export const applyDeliveryReceipt = ({
  messages,
  payload,
}) => {
  if (!payload?.messageIds?.length) {
    return messages;
  }

  return messages.map((message) => {
    if (!payload.messageIds.includes(message.id)) {
      return message;
    }

    const already = (message.deliveredTo || []).some(
      (item) => item.userId === payload.userId
    );

    if (already) {
      return message;
    }

    return {
      ...message,
      deliveredTo: [
        ...(message.deliveredTo || []),
        {
          userId: payload.userId,
          deliveredAt: payload.deliveredAt,
        },
      ],
    };
  });
};

export const applyReadReceipt = ({
  messages,
  conversations,
  payload,
  currentUserId,
}) => {
  const nextMessages = messages.map((message) => {
    if (
      payload.messageIds?.length > 0 &&
      !payload.messageIds.includes(message.id)
    ) {
      return message;
    }

    const already = (message.seenBy || []).some(
      (item) => item.userId === payload.userId
    );

    if (already) {
      return message;
    }

    return {
      ...message,
      seenBy: [
        ...(message.seenBy || []),
        {
          userId: payload.userId,
          seenAt: payload.seenAt,
        },
      ],
    };
  });

  let nextConversations = conversations;

  if (payload.userId === currentUserId) {
    nextConversations = conversations.map((conversation) =>
      conversation.id === payload.conversationId
        ? {
            ...conversation,
            unreadCount: 0,
          }
        : conversation
    );
  }

  return {
    messages: nextMessages,
    conversations: nextConversations,
  };
};

export const applyTypingUsers = ({
  typingUsers,
  payload,
  currentUserId,
  activeConversationId,
}) => {
  if (
    payload?.conversationId !== activeConversationId ||
    payload?.user?.id === currentUserId
  ) {
    return typingUsers;
  }

  if (
    typingUsers.some((item) => item.id === payload.user.id)
  ) {
    return typingUsers;
  }

  return [...typingUsers, payload.user];
};

export const applyStopTyping = ({
  typingUsers,
  payload,
  activeConversationId,
}) => {
  if (payload?.conversationId !== activeConversationId) {
    return typingUsers;
  }

  return typingUsers.filter(
    (item) => item.id !== payload?.user?.id
  );
};

export const applyMemberRemoved = ({
  conversations,
  activeConversationId,
  payload,
  currentUserId,
}) => {
  const removedSelf =
    payload?.removedUserId === currentUserId;

  return {
    conversations: conversations.filter(
      (item) => item.id !== payload.conversationId
    ),
    shouldNavigateAway:
      removedSelf &&
      payload.conversationId === activeConversationId,
  };
};
