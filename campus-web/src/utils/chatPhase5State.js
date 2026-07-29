export const REACTION_EMOJIS = [
  "👍",
  "❤️",
  "😂",
  "🔥",
  "👏",
  "😢",
  "🎉",
  "😮",
];

export const applyMessageUpdated = ({ messages, message }) => {
  if (!message?.id) {
    return messages;
  }

  return messages.map((item) =>
    item.id === message.id ? { ...item, ...message } : item
  );
};

export const applyMessageDeletedForMe = ({
  messages,
  messageId,
}) => messages.filter((item) => item.id !== messageId);

export const applyMessageDeletedForEveryone = ({
  messages,
  message,
}) => {
  if (!message?.id) {
    return messages;
  }

  return messages.map((item) =>
    item.id === message.id
      ? {
          ...item,
          ...message,
          text: null,
          deletedForEveryone: true,
          attachments: [],
          voice: null,
          reactions: [],
        }
      : item
  );
};

export const applyNotificationNew = ({
  notifications,
  notification,
  unreadCount,
}) => {
  const next = [
    notification,
    ...notifications.filter((item) => item.id !== notification.id),
  ].slice(0, 50);

  return {
    notifications: next,
    unreadCount:
      typeof unreadCount === "number"
        ? unreadCount
        : (unreadCount ?? next.filter((item) => !item.isRead).length),
  };
};

export const applyCallState = ({ call, incomingCall, event, payload }) => {
  if (event === "call:incoming") {
    return {
      call: call,
      incomingCall: payload.call,
    };
  }

  if (event === "call:ringing" || event === "call:accept") {
    return {
      call: payload.call,
      incomingCall:
        incomingCall?.id === payload.call?.id ? null : incomingCall,
    };
  }

  if (
    event === "call:end" ||
    event === "call:reject" ||
    event === "call:busy"
  ) {
    return {
      call:
        call?.id === payload.call?.id ? null : call,
      incomingCall:
        incomingCall?.id === payload.call?.id
          ? null
          : incomingCall,
    };
  }

  return { call, incomingCall };
};
