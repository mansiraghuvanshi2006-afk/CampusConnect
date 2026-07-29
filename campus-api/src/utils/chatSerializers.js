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

export const populateMessageQuery = (query) =>
  query
    .populate({
      path: "sender",
      select: "name role email",
    })
    .populate({
      path: "replyTo",
      select: "text sender type createdAt deletedForEveryoneAt deletedForEveryone attachments voice",
      populate: {
        path: "sender",
        select: "name role",
      },
    })
    .populate({
      path: "reactions.user",
      select: "name role",
    })
    .populate({
      path: "mentions",
      select: "name role",
    })
    .populate({
      path: "forwardedFrom.sender",
      select: "name role",
    })
    .populate({
      path: "pinnedBy",
      select: "name role",
    })
    .populate({
      path: "deletedBy",
      select: "name role",
    });

export const formatMessage = (message, options = {}) => {
  if (!message) {
    return null;
  }

  const receipts = options.receipts || [];
  const viewerId = options.viewerId
    ? toId(options.viewerId)
    : null;

  if (
    viewerId &&
    (message.deletedFor || []).some(
      (id) => toId(id) === viewerId
    )
  ) {
    return null;
  }

  const deletedForEveryone = Boolean(
    message.deletedForEveryone || message.deletedForEveryoneAt
  );

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
          text: message.replyTo.deletedForEveryoneAt
            ? null
            : message.replyTo.text,
          type: message.replyTo.type || "text",
          sender: message.replyTo.sender
            ? {
                id: toId(message.replyTo.sender),
                name: message.replyTo.sender.name,
              }
            : null,
          deletedForEveryone: Boolean(
            message.replyTo.deletedForEveryoneAt ||
              message.replyTo.deletedForEveryone
          ),
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

  const reactions = deletedForEveryone
    ? []
    : (message.reactions || []).map((reaction) => ({
        emoji: reaction.emoji,
        reactedAt: reaction.reactedAt,
        user:
          reaction.user && typeof reaction.user === "object"
            ? {
                id: toId(reaction.user),
                name: reaction.user.name,
                role: reaction.user.role,
              }
            : { id: toId(reaction.user) },
      }));

  const reactionSummary = {};
  for (const reaction of reactions) {
    if (!reactionSummary[reaction.emoji]) {
      reactionSummary[reaction.emoji] = {
        emoji: reaction.emoji,
        count: 0,
        userIds: [],
      };
    }
    reactionSummary[reaction.emoji].count += 1;
    reactionSummary[reaction.emoji].userIds.push(
      reaction.user?.id
    );
  }

  return {
    id: toId(message),
    conversationId: toId(message.conversation),
    sender,
    type: message.type,
    text: deletedForEveryone ? null : message.text,
    temporaryId: message.temporaryId || null,
    replyTo,
    attachments: deletedForEveryone
      ? []
      : (message.attachments || []).map((attachment) => ({
          id: attachment.id,
          originalName: attachment.originalName,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          size: attachment.size,
          url: attachment.url,
          thumbnailUrl: attachment.thumbnailUrl || null,
          width: attachment.width ?? null,
          height: attachment.height ?? null,
          duration: attachment.duration ?? null,
          waveForm: attachment.waveForm || [],
        })),
    voice: deletedForEveryone
      ? null
      : message.voice
        ? {
            url: message.voice.url,
            duration: message.voice.duration,
            mimeType: message.voice.mimeType,
            size: message.voice.size,
            waveForm: message.voice.waveForm || [],
          }
        : null,
    deliveredTo,
    seenBy,
    edited: Boolean(message.edited || message.editedAt),
    editedAt: message.editedAt || null,
    editHistory: (message.editHistory || []).map((entry) => ({
      text: entry.text,
      editedAt: entry.editedAt,
    })),
    deletedForEveryone,
    deletedForEveryoneAt: message.deletedForEveryoneAt || null,
    deletedAt: message.deletedAt || null,
    deletedBy: toId(message.deletedBy),
    deletedForMe: viewerId
      ? (message.deletedFor || []).some(
          (id) => toId(id) === viewerId
        )
      : false,
    forwardedFrom: message.forwardedFrom
      ? {
          messageId: toId(message.forwardedFrom.message),
          conversationId: toId(message.forwardedFrom.conversation),
          sender: message.forwardedFrom.sender
            ? typeof message.forwardedFrom.sender === "object"
              ? {
                  id: toId(message.forwardedFrom.sender),
                  name:
                    message.forwardedFrom.sender.name ||
                    message.forwardedFrom.senderName,
                }
              : {
                  id: toId(message.forwardedFrom.sender),
                  name: message.forwardedFrom.senderName,
                }
            : message.forwardedFrom.senderName
              ? { name: message.forwardedFrom.senderName }
              : null,
          text: message.forwardedFrom.text,
          type: message.forwardedFrom.type,
        }
      : null,
    reactions,
    reactionSummary: Object.values(reactionSummary),
    mentions: (message.mentions || []).map((mention) =>
      mention && typeof mention === "object"
        ? {
            id: toId(mention),
            name: mention.name,
            role: mention.role,
          }
        : { id: toId(mention) }
    ),
    pinned: Boolean(message.pinned),
    pinnedAt: message.pinnedAt || null,
    pinnedBy: message.pinnedBy
      ? typeof message.pinnedBy === "object"
        ? {
            id: toId(message.pinnedBy),
            name: message.pinnedBy.name,
          }
        : { id: toId(message.pinnedBy) }
      : null,
    linkPreview: deletedForEveryone
      ? null
      : message.linkPreview || null,
    callMeta: message.callMeta || null,
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
          receipts: [],
          viewerId: currentUserId,
        })
      : conversation.lastMessage &&
          typeof conversation.lastMessage === "object" &&
          conversation.lastMessage._id
        ? formatMessage(conversation.lastMessage, {
            receipts: [],
            viewerId: currentUserId,
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
