export const getUserId = (user) => {
  if (!user) {
    return null;
  }

  return String(user.id || user._id || "");
};

export const createTemporaryId = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `tmp_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
};

export const formatMessageTime = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatConversationTime = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();
  const isToday =
    date.toDateString() === now.toDateString();

  if (isToday) {
    return formatMessageTime(date);
  }

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);

  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
};

export const formatDateSeparator = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();

  if (date.toDateString() === now.toDateString()) {
    return "Today";
  }

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);

  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const getConversationTitle = (conversation) => {
  if (!conversation) {
    return "Chat";
  }

  if (conversation.type === "direct") {
    return (
      conversation.partner?.name ||
      conversation.name ||
      "Direct chat"
    );
  }

  return conversation.name || "Group chat";
};

export const getInitials = (name = "") => {
  const parts = String(name).trim().split(/\s+/);

  if (!parts.length || !parts[0]) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
};

export const mergeMessages = (existing, incoming) => {
  const map = new Map();

  const keyFor = (message) => {
    if (message.id) {
      return `id:${message.conversationId || ""}:${message.id}`;
    }

    if (message.temporaryId) {
      return `tmp:${message.conversationId || ""}:${message.temporaryId}`;
    }

    return `fallback:${message.conversationId || ""}:${message.createdAt}_${message.text}`;
  };

  for (const message of existing) {
    map.set(keyFor(message), message);
  }

  for (const message of incoming) {
    if (message.temporaryId) {
      for (const [key, value] of map.entries()) {
        if (
          value.temporaryId &&
          value.temporaryId === message.temporaryId &&
          String(value.conversationId || "") ===
            String(message.conversationId || "")
        ) {
          map.delete(key);
        }
      }
    }

    if (message.id) {
      for (const [key, value] of map.entries()) {
        if (
          value.id &&
          String(value.id) === String(message.id) &&
          String(value.conversationId || "") ===
            String(message.conversationId || "")
        ) {
          map.delete(key);
        }
      }
    }

    map.set(keyFor(message), message);
  }

  return [...map.values()].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() -
      new Date(b.createdAt).getTime()
  );
};

export const upsertConversation = (
  conversations,
  conversation
) => {
  if (!conversation?.id && !conversation?.conversationId) {
    return conversations;
  }

  const id = String(
    conversation.id || conversation.conversationId
  );

  const next = [...conversations];
  const index = next.findIndex(
    (item) => String(item.id) === id
  );

  if (index === -1) {
    if (conversation.id) {
      next.unshift(conversation);
    }

    return sortConversations(next);
  }

  next[index] = {
    ...next[index],
    ...conversation,
    id,
  };

  return sortConversations(next);
};

export const sortConversations = (conversations) => {
  return [...conversations].sort((a, b) => {
    if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
      return a.isPinned ? -1 : 1;
    }

    const timeA = a.lastMessageAt
      ? new Date(a.lastMessageAt).getTime()
      : 0;
    const timeB = b.lastMessageAt
      ? new Date(b.lastMessageAt).getTime()
      : 0;

    if (timeA !== timeB) {
      return timeB - timeA;
    }

    return (
      new Date(b.createdAt || 0).getTime() -
      new Date(a.createdAt || 0).getTime()
    );
  });
};
