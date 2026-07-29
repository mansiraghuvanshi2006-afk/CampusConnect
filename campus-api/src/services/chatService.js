import Conversation, {
  CONVERSATION_TYPES,
  CONVERSATION_MEMBER_ROLES,
  buildDirectKey,
} from "../models/Conversation.js";

import Message, { MESSAGE_TYPES } from "../models/Message.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";

import {
  assertCanUseChat,
  assertCanStartDirectChat,
  assertCanCreateGroup,
  assertCanViewConversation,
  assertCanSendMessage,
  assertCanManageConversation,
  assertCanAddMember,
  assertCanRemoveMember,
  getActiveMembership,
  getConversationPermissions,
  getEligibleChatUsers,
  isValidObjectId,
} from "./chatPolicyService.js";

import {
  formatConversation,
  formatMessage,
  formatSafeUser,
  populateMessageQuery,
} from "../utils/chatSerializers.js";

import { enrichTextMessageFields } from "./messageAdvancedService.js";

import { withOptionalTransaction } from "../utils/mongoTransaction.js";

import {
  upsertDeliveredReceipts,
  upsertSeenReceipts,
  loadReceiptsByMessageIds,
} from "./messageReceiptService.js";

import MessageReceipt from "../models/MessageReceipt.js";

const SAFE_USER_SELECT =
  "name email role department year teachingYears lastSeenAt isActive";

const populateConversation = (query) =>
  query
    .populate({
      path: "members.user",
      select: SAFE_USER_SELECT,
      populate: {
        path: "department",
        select: "name code",
      },
    })
    .populate("department", "name code")
    .populate({
      path: "lastMessage",
      populate: {
        path: "sender",
        select: "name role email",
      },
    });

const populateMessage = (query) => populateMessageQuery(query);

export const listEligibleUsers = async (
  currentUser,
  filters,
  onlineUserIds = new Set()
) => {
  const result = await getEligibleChatUsers(
    currentUser,
    filters
  );

  return {
    users: result.users.map((user) =>
      formatSafeUser(user, onlineUserIds)
    ),
    pagination: result.pagination,
  };
};

export const listConversations = async (
  currentUser,
  onlineUserIds = new Set()
) => {
  assertCanUseChat(currentUser);

  const conversations = await populateConversation(
    Conversation.find({
      isActive: true,
      members: {
        $elemMatch: {
          user: currentUser._id,
          isActive: true,
        },
      },
    })
  )
    .sort({ lastMessageAt: -1, createdAt: -1 })
    .lean();

  const formatted = conversations.map((conversation) => {
    const permissions = getConversationPermissions(
      currentUser,
      conversation
    );

    return formatConversation(conversation, currentUser, {
      onlineUserIds,
      permissions,
    });
  });

  formatted.sort((a, b) => {
    if (a.isPinned !== b.isPinned) {
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
      new Date(b.createdAt).getTime() -
      new Date(a.createdAt).getTime()
    );
  });

  return formatted;
};

export const getConversationById = async (
  currentUser,
  conversationId,
  onlineUserIds = new Set()
) => {
  assertCanUseChat(currentUser);

  if (!isValidObjectId(conversationId)) {
    throw new ApiError(400, "Invalid conversation ID");
  }

  const conversation = await populateConversation(
    Conversation.findById(conversationId)
  ).lean();

  assertCanViewConversation(currentUser, conversation);

  const permissions = getConversationPermissions(
    currentUser,
    conversation
  );

  return formatConversation(conversation, currentUser, {
    onlineUserIds,
    permissions,
  });
};

export const createOrGetDirectConversation = async (
  currentUser,
  targetUserId,
  onlineUserIds = new Set()
) => {
  assertCanUseChat(currentUser);

  if (!isValidObjectId(targetUserId)) {
    throw new ApiError(400, "Invalid target user ID");
  }

  const targetUser = await User.findById(targetUserId);

  if (!targetUser) {
    throw new ApiError(404, "User not found");
  }

  assertCanStartDirectChat(currentUser, targetUser);

  const directKey = buildDirectKey(
    currentUser._id,
    targetUser._id
  );

  let conversation = await populateConversation(
    Conversation.findOne({
      type: CONVERSATION_TYPES.DIRECT,
      directKey,
      isActive: true,
    })
  );

  let wasCreated = false;

  if (!conversation) {
    wasCreated = true;

    conversation = await Conversation.create({
      type: CONVERSATION_TYPES.DIRECT,
      directKey,
      createdBy: currentUser._id,
      members: [
        {
          user: currentUser._id,
          role: CONVERSATION_MEMBER_ROLES.MEMBER,
          addedBy: currentUser._id,
        },
        {
          user: targetUser._id,
          role: CONVERSATION_MEMBER_ROLES.MEMBER,
          addedBy: currentUser._id,
        },
      ],
    });

    conversation = await populateConversation(
      Conversation.findById(conversation._id)
    );
  }

  const plain = conversation.toObject
    ? conversation.toObject()
    : conversation;

  const permissions = getConversationPermissions(
    currentUser,
    plain
  );

  return {
    conversation: formatConversation(plain, currentUser, {
      onlineUserIds,
      permissions,
    }),
    wasCreated,
  };
};

export const createGroupConversation = async (
  currentUser,
  payload,
  onlineUserIds = new Set()
) => {
  assertCanUseChat(currentUser);

  const type =
    currentUser.role === "admin"
      ? payload.type || CONVERSATION_TYPES.OFFICIAL_GROUP
      : CONVERSATION_TYPES.TEACHER_GROUP;

  assertCanCreateGroup(currentUser, type);

  if (currentUser.role === "teacher") {
    const requestedYears = payload.academicYears || [];

    for (const year of requestedYears) {
      if (!currentUser.teachingYears.includes(year)) {
        throw new ApiError(
          403,
          "You can only create groups for your assigned academic years"
        );
      }
    }
  }

  const memberIds = [
    ...new Set(
      (payload.memberIds || []).map((id) => id.toString())
    ),
  ].filter((id) => id !== currentUser._id.toString());

  const adminIds = new Set(
    (payload.adminIds || [])
      .map((id) => id.toString())
      .filter(Boolean)
  );

  adminIds.add(currentUser._id.toString());

  const members = [
    {
      user: currentUser._id,
      role: CONVERSATION_MEMBER_ROLES.ADMIN,
      addedBy: currentUser._id,
    },
  ];

  const draftConversation = {
    type,
    academicYears: payload.academicYears || [],
    department:
      currentUser.role === "teacher"
        ? currentUser.department
        : payload.department || null,
  };

  for (const memberId of memberIds) {
    if (!isValidObjectId(memberId)) {
      throw new ApiError(400, "Invalid member ID");
    }

    const targetUser = await User.findById(memberId);

    if (!targetUser) {
      throw new ApiError(404, `User not found: ${memberId}`);
    }

    assertCanAddMember(
      currentUser,
      targetUser,
      {
        ...draftConversation,
        isActive: true,
        members: [
          {
            user: currentUser._id,
            role: CONVERSATION_MEMBER_ROLES.ADMIN,
            isActive: true,
          },
        ],
      }
    );

    members.push({
      user: targetUser._id,
      role: adminIds.has(memberId)
        ? CONVERSATION_MEMBER_ROLES.ADMIN
        : CONVERSATION_MEMBER_ROLES.MEMBER,
      addedBy: currentUser._id,
    });
  }

  let conversation;
  let systemMessage;

  const runCreate = async (session = null) => {
    const createConversation = session
      ? () =>
          Conversation.create(
            [
              {
                type,
                name: payload.name.trim(),
                description:
                  payload.description?.trim() || null,
                image: payload.image || null,
                createdBy: currentUser._id,
                department:
                  currentUser.role === "teacher"
                    ? currentUser.department
                    : payload.department || null,
                academicYears: payload.academicYears || [],
                onlyAdminsCanSend: Boolean(
                  type === CONVERSATION_TYPES.ANNOUNCEMENT
                    ? payload.onlyAdminsCanSend !== false
                    : payload.onlyAdminsCanSend
                ),
                members,
              },
            ],
            { session }
          )
      : () =>
          Conversation.create([
            {
              type,
              name: payload.name.trim(),
              description:
                payload.description?.trim() || null,
              image: payload.image || null,
              createdBy: currentUser._id,
              department:
                currentUser.role === "teacher"
                  ? currentUser.department
                  : payload.department || null,
              academicYears: payload.academicYears || [],
              onlyAdminsCanSend: Boolean(
                type === CONVERSATION_TYPES.ANNOUNCEMENT
                  ? payload.onlyAdminsCanSend !== false
                  : payload.onlyAdminsCanSend
              ),
              members,
            },
          ]);

    const [createdConversation] = await createConversation();

    const createSystem = session
      ? () =>
          Message.create(
            [
              {
                conversation: createdConversation._id,
                sender: currentUser._id,
                type: MESSAGE_TYPES.SYSTEM,
                text: `${currentUser.name} created this group`,
              },
            ],
            { session }
          )
      : () =>
          Message.create([
            {
              conversation: createdConversation._id,
              sender: currentUser._id,
              type: MESSAGE_TYPES.SYSTEM,
              text: `${currentUser.name} created this group`,
            },
          ]);

    const [createdSystemMessage] = await createSystem();

    createdConversation.lastMessage = createdSystemMessage._id;
    createdConversation.lastMessageAt =
      createdSystemMessage.createdAt;

    await createdConversation.save(
      session ? { session } : undefined
    );

    return {
      conversation: createdConversation,
      systemMessage: createdSystemMessage,
    };
  };

  try {
    const { result } = await withOptionalTransaction({
      startSession: () => Conversation.startSession(),
      work: async (session) => runCreate(session),
      fallback: async () => runCreate(null),
    });

    conversation = result.conversation;
    systemMessage = result.systemMessage;
  } catch (error) {
    throw error;
  }

  conversation = await populateConversation(
    Conversation.findById(conversation._id)
  );

  const plain = conversation.toObject();
  const permissions = getConversationPermissions(
    currentUser,
    plain
  );

  const populatedSystem = await populateMessage(
    Message.findById(systemMessage._id)
  ).lean();

  return {
    conversation: formatConversation(plain, currentUser, {
      onlineUserIds,
      permissions,
    }),
    systemMessage: formatMessage(populatedSystem, {
      receipts: [],
    }),
  };
};

export const updateConversation = async (
  currentUser,
  conversationId,
  payload,
  onlineUserIds = new Set()
) => {
  assertCanUseChat(currentUser);

  if (!isValidObjectId(conversationId)) {
    throw new ApiError(400, "Invalid conversation ID");
  }

  const conversation =
    await Conversation.findById(conversationId);

  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }

  assertCanManageConversation(currentUser, conversation);

  if (payload.name !== undefined) {
    conversation.name = payload.name.trim();
  }

  if (payload.description !== undefined) {
    conversation.description =
      payload.description?.trim() || null;
  }

  if (payload.image !== undefined) {
    conversation.image = payload.image || null;
  }

  if (payload.onlyAdminsCanSend !== undefined) {
    conversation.onlyAdminsCanSend = Boolean(
      payload.onlyAdminsCanSend
    );
  }

  if (payload.isActive !== undefined) {
    if (currentUser.role !== "admin") {
      throw new ApiError(
        403,
        "Only administrators can deactivate conversations"
      );
    }

    conversation.isActive = Boolean(payload.isActive);
  }

  if (payload.academicYears !== undefined) {
    if (
      currentUser.role === "teacher" &&
      Array.isArray(payload.academicYears)
    ) {
      for (const year of payload.academicYears) {
        if (!currentUser.teachingYears.includes(year)) {
          throw new ApiError(
            403,
            "Academic year is outside your assigned years"
          );
        }
      }
    }

    conversation.academicYears = payload.academicYears;
  }

  await conversation.save();

  const populated = await populateConversation(
    Conversation.findById(conversation._id)
  ).lean();

  const permissions = getConversationPermissions(
    currentUser,
    populated
  );

  return formatConversation(populated, currentUser, {
    onlineUserIds,
    permissions,
  });
};

export const deactivateConversation = async (
  currentUser,
  conversationId
) => {
  return updateConversation(currentUser, conversationId, {
    isActive: false,
  });
};

export const getMessages = async (
  currentUser,
  conversationId,
  params = {}
) => {
  assertCanUseChat(currentUser);

  if (!isValidObjectId(conversationId)) {
    throw new ApiError(400, "Invalid conversation ID");
  }

  const conversation =
    await Conversation.findById(conversationId).lean();

  assertCanViewConversation(currentUser, conversation);

  const limit = Math.min(
    50,
    Math.max(1, Number(params.limit) || 30)
  );

  const query = {
    conversation: conversationId,
    isActive: true,
    deletedFor: { $ne: currentUser._id },
  };

  if (params.before && isValidObjectId(params.before)) {
    const cursorMessage = await Message.findById(
      params.before
    ).lean();

    if (cursorMessage) {
      query.$or = [
        { createdAt: { $lt: cursorMessage.createdAt } },
        {
          createdAt: cursorMessage.createdAt,
          _id: { $lt: cursorMessage._id },
        },
      ];
    }
  }

  const messages = await populateMessage(
    Message.find(query).sort({ createdAt: -1, _id: -1 }).limit(limit + 1)
  ).lean();

  const hasMore = messages.length > limit;
  const pageItems = hasMore ? messages.slice(0, limit) : messages;
  const ordered = pageItems.reverse();

  const receiptMap = await loadReceiptsByMessageIds(
    ordered.map((message) => message._id)
  );

  return {
    messages: ordered
      .map((message) =>
        formatMessage(message, {
          receipts: receiptMap.get(String(message._id)) || [],
          viewerId: currentUser._id,
        })
      )
      .filter(Boolean),
    pagination: {
      hasMore,
      nextCursor: ordered.length
        ? ordered[0]._id.toString()
        : null,
      limit,
    },
  };
};

export const sendTextMessage = async (
  currentUser,
  conversationId,
  payload
) => {
  assertCanUseChat(currentUser);

  if (!isValidObjectId(conversationId)) {
    throw new ApiError(400, "Invalid conversation ID");
  }

  const conversation =
    await Conversation.findById(conversationId);

  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }

  assertCanSendMessage(currentUser, conversation);

  const text = String(payload.text || "").trim();

  if (!text) {
    throw new ApiError(400, "Message text is required");
  }

  if (text.length > 5000) {
    throw new ApiError(
      400,
      "Message text cannot exceed 5000 characters"
    );
  }

  if (payload.temporaryId) {
    const existing = await populateMessage(
      Message.findOne({
        sender: currentUser._id,
        temporaryId: payload.temporaryId,
      })
    ).lean();

    if (existing) {
      const receiptMap = await loadReceiptsByMessageIds([
        existing._id,
      ]);

      return {
        message: formatMessage(existing, {
          receipts:
            receiptMap.get(String(existing._id)) || [],
        }),
        conversation,
        isDuplicate: true,
      };
    }
  }

  if (payload.replyTo) {
    if (!isValidObjectId(payload.replyTo)) {
      throw new ApiError(400, "Invalid reply message ID");
    }

    const replyMessage = await Message.findOne({
      _id: payload.replyTo,
      conversation: conversationId,
      isActive: true,
    });

    if (!replyMessage) {
      throw new ApiError(404, "Reply target message not found");
    }
  }

  const { mentions, linkPreview } = await enrichTextMessageFields(
    text,
    conversation
  );

  let message;

  try {
    message = await Message.create({
      conversation: conversationId,
      sender: currentUser._id,
      type: MESSAGE_TYPES.TEXT,
      text,
      temporaryId: payload.temporaryId || null,
      replyTo: payload.replyTo || null,
      mentions,
      linkPreview,
    });
  } catch (error) {
    if (error?.code === 11000 && payload.temporaryId) {
      const existing = await populateMessage(
        Message.findOne({
          sender: currentUser._id,
          temporaryId: payload.temporaryId,
        })
      ).lean();

      if (existing) {
        const receiptMap = await loadReceiptsByMessageIds([
          existing._id,
        ]);

        return {
          message: formatMessage(existing, {
            receipts:
              receiptMap.get(String(existing._id)) || [],
          }),
          conversation,
          isDuplicate: true,
        };
      }
    }

    throw error;
  }

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
          "member.user": { $ne: currentUser._id },
          "member.isActive": true,
        },
      ],
    }
  );

  const refreshed = await Conversation.findById(
    conversationId
  );

  const populated = await populateMessage(
    Message.findById(message._id)
  ).lean();

  const receiptMap = await loadReceiptsByMessageIds([
    message._id,
  ]);

  return {
    message: formatMessage(populated, {
      receipts: receiptMap.get(String(message._id)) || [],
    }),
    conversation: refreshed,
    isDuplicate: false,
  };
};

export const markMessagesDelivered = async (
  userId,
  conversationId,
  messageIds = null
) => {
  const query = {
    conversation: conversationId,
    isActive: true,
    sender: { $ne: userId },
  };

  if (Array.isArray(messageIds) && messageIds.length > 0) {
    query._id = {
      $in: messageIds.filter((id) => isValidObjectId(id)),
    };
  }

  const deliveredAt = new Date();
  const messages = await Message.find(query).select("_id");

  if (!messages.length) {
    return {
      conversationId: conversationId.toString(),
      messageIds: [],
      userId: userId.toString(),
      deliveredAt,
    };
  }

  const ids = messages.map((message) => message._id);

  // Only mark messages that are not already delivered for this user.
  const existing = await MessageReceipt.find({
    message: { $in: ids },
    user: userId,
    deliveredAt: { $ne: null },
  }).select("message");

  const alreadyDelivered = new Set(
    existing.map((receipt) => receipt.message.toString())
  );

  const pendingIds = ids.filter(
    (id) => !alreadyDelivered.has(id.toString())
  );

  if (pendingIds.length > 0) {
    await Promise.all(
      pendingIds.map((messageId) =>
        upsertDeliveredReceipts({
          messageId,
          conversationId,
          userIds: [userId.toString()],
          deliveredAt,
        })
      )
    );
  }

  return {
    conversationId: conversationId.toString(),
    messageIds: pendingIds.map((id) => id.toString()),
    userId: userId.toString(),
    deliveredAt,
  };
};

export const markMessagesRead = async (
  currentUser,
  conversationId,
  messageIds = null
) => {
  assertCanUseChat(currentUser);

  if (!isValidObjectId(conversationId)) {
    throw new ApiError(400, "Invalid conversation ID");
  }

  const conversation =
    await Conversation.findById(conversationId);

  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }

  assertCanViewConversation(currentUser, conversation);

  const query = {
    conversation: conversationId,
    isActive: true,
    sender: { $ne: currentUser._id },
  };

  if (Array.isArray(messageIds) && messageIds.length > 0) {
    query._id = {
      $in: messageIds.filter((id) => isValidObjectId(id)),
    };
  }

  const seenAt = new Date();
  const messages = await Message.find(query)
    .sort({ createdAt: 1 })
    .select("_id");

  const ids = messages.map((message) => message._id);

  const alreadySeen = await MessageReceipt.find({
    message: { $in: ids },
    user: currentUser._id,
    seenAt: { $ne: null },
  }).select("message");

  const seenSet = new Set(
    alreadySeen.map((receipt) => receipt.message.toString())
  );

  const pendingIds = ids.filter(
    (id) => !seenSet.has(id.toString())
  );

  if (pendingIds.length > 0) {
    await upsertSeenReceipts({
      messageIds: pendingIds,
      conversationId,
      userId: currentUser._id,
      seenAt,
    });
  }

  await Conversation.updateOne(
    {
      _id: conversationId,
      "members.user": currentUser._id,
      "members.isActive": true,
    },
    {
      $set: {
        "members.$[member].unreadCount": 0,
        "members.$[member].lastReadAt": seenAt,
        "members.$[member].lastReadMessage":
          ids.length > 0
            ? ids[ids.length - 1]
            : conversation.lastMessage,
      },
    },
    {
      arrayFilters: [
        {
          "member.user": currentUser._id,
          "member.isActive": true,
        },
      ],
    }
  );

  return {
    conversationId: conversationId.toString(),
    messageIds: pendingIds.map((id) => id.toString()),
    userId: currentUser._id.toString(),
    seenAt,
    unreadCount: 0,
  };
};

export const addConversationMembers = async (
  currentUser,
  conversationId,
  memberIds,
  onlineUserIds = new Set()
) => {
  assertCanUseChat(currentUser);

  if (!isValidObjectId(conversationId)) {
    throw new ApiError(400, "Invalid conversation ID");
  }

  const conversation =
    await Conversation.findById(conversationId);

  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }

  assertCanManageConversation(currentUser, conversation);

  const uniqueIds = [
    ...new Set(memberIds.map((id) => id.toString())),
  ];

  for (const memberId of uniqueIds) {
    if (!isValidObjectId(memberId)) {
      throw new ApiError(400, "Invalid member ID");
    }
  }

  const targetUsers = await User.find({
    _id: { $in: uniqueIds },
  });

  if (targetUsers.length !== uniqueIds.length) {
    throw new ApiError(404, "One or more users were not found");
  }

  const userMap = new Map(
    targetUsers.map((user) => [user._id.toString(), user])
  );

  for (const memberId of uniqueIds) {
    const targetUser = userMap.get(memberId);
    assertCanAddMember(currentUser, targetUser, conversation);
  }

  const applyMembership = (doc) => {
    const localAdded = [];

    for (const memberId of uniqueIds) {
      const targetUser = userMap.get(memberId);
      const existing = doc.members.find(
        (member) => member.user.toString() === memberId
      );

      if (existing) {
        existing.isActive = true;
        existing.joinedAt = new Date();
        existing.addedBy = currentUser._id;
        existing.unreadCount = 0;
        existing.role = CONVERSATION_MEMBER_ROLES.MEMBER;
      } else {
        doc.members.push({
          user: targetUser._id,
          role: CONVERSATION_MEMBER_ROLES.MEMBER,
          addedBy: currentUser._id,
        });
      }

      localAdded.push(targetUser);
    }

    return localAdded;
  };

  const createSystemMessages = async (doc, session = null) => {
    const options = session ? { session } : undefined;
    const docs = [];

    for (const targetUser of addedMembers) {
      const [systemMessage] = await Message.create(
        [
          {
            conversation: doc._id,
            sender: currentUser._id,
            type: MESSAGE_TYPES.SYSTEM,
            text: `${currentUser.name} added ${targetUser.name}`,
          },
        ],
        options
      );

      doc.lastMessage = systemMessage._id;
      doc.lastMessageAt = systemMessage.createdAt;
      docs.push(systemMessage);
    }

    return docs;
  };

  let systemMessageDocs = [];
  let addedMembers = [];

  const { mode } = await withOptionalTransaction({
    startSession: () => Conversation.startSession(),
    work: async (session) => {
      const fresh = await Conversation.findById(
        conversationId
      ).session(session);

      if (!fresh) {
        throw new ApiError(404, "Conversation not found");
      }

      addedMembers = applyMembership(fresh);
      systemMessageDocs = await createSystemMessages(
        fresh,
        session
      );
      await fresh.save({ session });
    },
    fallback: async () => {
      /*
        Standalone fallback:
        1) save membership first
        2) create system messages afterward
        Membership correctness takes priority over audit messages.
      */
      addedMembers = applyMembership(conversation);
      await conversation.save();

      try {
        systemMessageDocs = await createSystemMessages(
          conversation,
          null
        );
        await conversation.save();
      } catch (systemError) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            "[chat] system message create failed after membership save",
            systemError.message
          );
        }

        throw new ApiError(
          500,
          "Members were added, but the system message could not be created"
        );
      }
    },
  });

  void mode;

  const populated = await populateConversation(
    Conversation.findById(conversationId)
  ).lean();

  const permissions = getConversationPermissions(
    currentUser,
    populated
  );

  const systemMessageIds = systemMessageDocs.map(
    (message) => message._id
  );

  const systemMessages = systemMessageIds.length
    ? await populateMessage(
        Message.find({ _id: { $in: systemMessageIds } })
      ).lean()
    : [];

  return {
    conversation: formatConversation(populated, currentUser, {
      onlineUserIds,
      permissions,
    }),
    addedMembers: addedMembers.map((user) =>
      formatSafeUser(user.toObject?.() || user, onlineUserIds)
    ),
    systemMessages: systemMessages.map((message) =>
      formatMessage(message, { receipts: [] })
    ),
  };
};

export const removeConversationMember = async (
  currentUser,
  conversationId,
  targetUserId,
  onlineUserIds = new Set()
) => {
  assertCanUseChat(currentUser);

  if (
    !isValidObjectId(conversationId) ||
    !isValidObjectId(targetUserId)
  ) {
    throw new ApiError(400, "Invalid ID provided");
  }

  const conversation =
    await Conversation.findById(conversationId);

  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }

  const targetUser = await User.findById(targetUserId);

  if (!targetUser) {
    throw new ApiError(404, "User not found");
  }

  assertCanRemoveMember(
    currentUser,
    targetUser,
    conversation
  );

  let systemMessage = null;

  await withOptionalTransaction({
    startSession: () => Conversation.startSession(),
    work: async (session) => {
      const fresh = await Conversation.findById(
        conversationId
      ).session(session);

      if (!fresh) {
        throw new ApiError(404, "Conversation not found");
      }

      assertCanRemoveMember(currentUser, targetUser, fresh);

      const membership = getActiveMembership(
        fresh,
        targetUserId
      );

      if (membership) {
        membership.isActive = false;
      }

      const [created] = await Message.create(
        [
          {
            conversation: fresh._id,
            sender: currentUser._id,
            type: MESSAGE_TYPES.SYSTEM,
            text: `${currentUser.name} removed ${targetUser.name}`,
          },
        ],
        { session }
      );

      fresh.lastMessage = created._id;
      fresh.lastMessageAt = created.createdAt;
      await fresh.save({ session });
      systemMessage = created;
    },
    fallback: async () => {
      const membership = getActiveMembership(
        conversation,
        targetUserId
      );

      if (membership) {
        membership.isActive = false;
      }

      await conversation.save();

      try {
        systemMessage = await Message.create({
          conversation: conversation._id,
          sender: currentUser._id,
          type: MESSAGE_TYPES.SYSTEM,
          text: `${currentUser.name} removed ${targetUser.name}`,
        });

        conversation.lastMessage = systemMessage._id;
        conversation.lastMessageAt = systemMessage.createdAt;
        await conversation.save();
      } catch (systemError) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            "[chat] remove system message failed after membership save",
            systemError.message
          );
        }
      }
    },
  });

  const populated = await populateConversation(
    Conversation.findById(conversation._id)
  ).lean();

  const permissions = getConversationPermissions(
    currentUser,
    populated
  );

  let formattedSystem = null;

  if (systemMessage) {
    formattedSystem = formatMessage(
      (
        await populateMessage(Message.findById(systemMessage._id))
      ).toObject(),
      { receipts: [] }
    );
  }

  return {
    conversation: formatConversation(populated, currentUser, {
      onlineUserIds,
      permissions,
    }),
    removedUserId: targetUserId.toString(),
    systemMessage: formattedSystem,
  };
};

export const toggleConversationPin = async (
  currentUser,
  conversationId,
  onlineUserIds = new Set()
) => {
  assertCanUseChat(currentUser);

  if (!isValidObjectId(conversationId)) {
    throw new ApiError(400, "Invalid conversation ID");
  }

  const conversation =
    await Conversation.findById(conversationId);

  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }

  assertCanViewConversation(currentUser, conversation);

  const membership = getActiveMembership(
    conversation,
    currentUser._id
  );

  membership.isPinned = !membership.isPinned;
  await conversation.save();

  const populated = await populateConversation(
    Conversation.findById(conversation._id)
  ).lean();

  const permissions = getConversationPermissions(
    currentUser,
    populated
  );

  return formatConversation(populated, currentUser, {
    onlineUserIds,
    permissions,
  });
};

export {
  populateConversation,
  populateMessage,
  SAFE_USER_SELECT,
};
