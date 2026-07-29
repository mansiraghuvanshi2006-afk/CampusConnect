const toId = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (value._id) {
    return value._id.toString();
  }

  return value.toString();
};

export const formatSafeUser = (user, onlineUserIds = new Set()) => {
  if (!user) {
    return null;
  }

  const id = toId(user);

  return {
    id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar || null,
    department: user.department
      ? {
          id: toId(user.department),
          name: user.department.name || undefined,
          code: user.department.code || undefined,
        }
      : null,
    years:
      user.role === "teacher"
        ? user.teachingYears || []
        : user.year
          ? [user.year]
          : [],
    year: user.year ?? null,
    teachingYears: user.teachingYears || [],
    isOnline: onlineUserIds.has(id),
    lastSeenAt: user.lastSeenAt || null,
  };
};

export const formatMessage = (message, options = {}) => {
  if (!message) {
    return null;
  }

  const receipts = options.receipts || [];

  const sender =
    message.sender && typeof message.sender === "object"
      ? {
          id: toId(message.sender),
          name: message.sender.name,
          role: message.sender.role,
          email: message.sender.email,
        }
      : {
          id: toId(message.sender),
        };

  const replyTo =
    message.replyTo && typeof message.replyTo === "object"
      ? {
          id: toId(message.replyTo),
          text: message.replyTo.text,
          sender: message.replyTo.sender
            ? {
                id: toId(message.replyTo.sender),
                name: message.replyTo.sender.name,
              }
            : null,
        }
      : message.replyTo
        ? { id: toId(message.replyTo) }
        : null;

  const { deliveredTo, seenBy } = (() => {
    const delivered = [];
    const seen = [];

    for (const receipt of receipts) {
      const userId = toId(receipt.user);

      if (receipt.deliveredAt) {
        delivered.push({
          userId,
          deliveredAt: receipt.deliveredAt,
        });
      }

      if (receipt.seenAt) {
        seen.push({
          userId,
          seenAt: receipt.seenAt,
        });
      }
    }

    return {
      deliveredTo: delivered,
      seenBy: seen,
    };
  })();

  return {
    id: toId(message),
    conversationId: toId(message.conversation),
    sender,
    type: message.type,
    text: message.deletedForEveryoneAt
      ? null
      : message.text,
    temporaryId: message.temporaryId || null,
    replyTo,
    deliveredTo,
    seenBy,
    editedAt: message.editedAt || null,
    deletedForEveryoneAt: message.deletedForEveryoneAt || null,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    isActive: message.isActive,
  };
};

export const formatConversation = (
  conversation,
  currentUser,
  options = {}
) => {
  const {
    onlineUserIds = new Set(),
    permissions = null,
  } = options;

  const currentUserId = toId(currentUser);
  const membership = (conversation.members || []).find(
    (member) =>
      member.isActive && toId(member.user) === currentUserId
  );

  const activeMembers = (conversation.members || [])
    .filter((member) => member.isActive)
    .map((member) => {
      const userDoc =
        member.user && typeof member.user === "object"
          ? member.user
          : { _id: member.user };

      return {
        ...formatSafeUser(userDoc, onlineUserIds),
        role: member.role,
        joinedAt: member.joinedAt,
        unreadCount: member.unreadCount || 0,
        isPinned: Boolean(member.isPinned),
      };
    });

  let displayName = conversation.name;
  let partner = null;

  if (conversation.type === "direct") {
    partner =
      activeMembers.find(
        (member) => member.id !== currentUserId
      ) || null;

    displayName = partner?.name || "Direct chat";
  }

  const lastMessage = conversation.lastMessage
    ? typeof conversation.lastMessage === "object" &&
      conversation.lastMessage.text !== undefined
      ? formatMessage(conversation.lastMessage, {
          // Sidebar previews do not need receipts.
          receipts: [],
        })
      : { id: toId(conversation.lastMessage) }
    : null;

  return {
    id: toId(conversation),
    type: conversation.type,
    name: displayName,
    description: conversation.description || null,
    image: conversation.image || null,
    members: activeMembers,
    memberCount: activeMembers.length,
    createdBy: toId(conversation.createdBy),
    department: conversation.department
      ? {
          id: toId(conversation.department),
          name: conversation.department.name || undefined,
          code: conversation.department.code || undefined,
        }
      : null,
    academicYears: conversation.academicYears || [],
    lastMessage,
    lastMessageAt: conversation.lastMessageAt || null,
    onlyAdminsCanSend: Boolean(conversation.onlyAdminsCanSend),
    isActive: conversation.isActive,
    unreadCount: membership?.unreadCount || 0,
    isPinned: Boolean(membership?.isPinned),
    partner,
    partnerOnline: partner
      ? onlineUserIds.has(partner.id)
      : false,
    permissions,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
};
