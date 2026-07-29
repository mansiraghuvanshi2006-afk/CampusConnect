import Conversation from "../models/Conversation.js";
import User from "../models/User.js";

import { getConversationPermissions } from "./chatPolicyService.js";
import {
  upsertDeliveredReceipts,
  loadReceiptsByMessageIds,
} from "./messageReceiptService.js";

import {
  formatConversation,
  formatMessage,
} from "../utils/chatSerializers.js";

import {
  userRoom,
  conversationRoom,
} from "../sockets/socketRooms.js";

import {
  getOnlineUserIds,
  isUserOnline,
} from "../sockets/socketPresence.js";

const SAFE_USER_SELECT =
  "name email role department year teachingYears lastSeenAt isActive";

export const getPresenceAudienceUserIds = async (userId) => {
  const conversations = await Conversation.find({
    isActive: true,
    members: {
      $elemMatch: {
        user: userId,
        isActive: true,
      },
    },
  })
    .select("members")
    .lean();

  const audience = new Set();

  for (const conversation of conversations) {
    for (const member of conversation.members || []) {
      if (!member.isActive) {
        continue;
      }

      const memberId = member.user.toString();

      if (memberId !== userId.toString()) {
        audience.add(memberId);
      }
    }
  }

  return [...audience];
};

export const emitPresenceToAuthorizedUsers = async (
  io,
  userId,
  eventName,
  payload
) => {
  if (!io) {
    return;
  }

  const audience = await getPresenceAudienceUserIds(userId);

  io.to(userRoom(userId)).emit(eventName, payload);

  for (const audienceUserId of audience) {
    io.to(userRoom(audienceUserId)).emit(eventName, payload);
  }
};

export const getScopedPresenceSnapshot = async (userId) => {
  const audience = await getPresenceAudienceUserIds(userId);
  const onlineIds = getOnlineUserIds();

  const ids = [userId.toString(), ...audience];
  const uniqueIds = [...new Set(ids)];

  const docs = await User.find({
    _id: { $in: uniqueIds },
  })
    .select("_id lastSeenAt isActive")
    .lean();

  const users = [];

  for (const doc of docs) {
    if (
      !doc.isActive &&
      doc._id.toString() !== userId.toString()
    ) {
      continue;
    }

    const id = doc._id.toString();

    users.push({
      userId: id,
      isOnline: onlineIds.has(id),
      lastSeen: doc.lastSeenAt || null,
    });
  }

  return { users };
};

const loadPopulatedConversation = async (conversationId) => {
  return Conversation.findById(conversationId)
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
    })
    .lean();
};

export const emitConversationUpdateToMembers = async ({
  io,
  conversationId,
  eventName = "conversation:updated",
  excludedUserIds = [],
  conversationDoc = null,
}) => {
  if (!io || !conversationId) {
    return;
  }

  const conversation =
    conversationDoc ||
    (await loadPopulatedConversation(conversationId));

  if (!conversation || !conversation.isActive) {
    return;
  }

  const excluded = new Set(
    excludedUserIds.map((id) => id.toString())
  );

  const activeMembers = (conversation.members || []).filter(
    (member) => member.isActive && member.user
  );

  const onlineUserIds = getOnlineUserIds();

  const memberUserIds = activeMembers.map((member) =>
    (member.user._id || member.user).toString()
  );

  const users = await User.find({
    _id: { $in: memberUserIds },
  });

  const userMap = new Map(
    users.map((user) => [user._id.toString(), user])
  );

  for (const member of activeMembers) {
    const memberId = (
      member.user._id || member.user
    ).toString();

    if (excluded.has(memberId)) {
      continue;
    }

    const recipient = userMap.get(memberId);

    if (!recipient) {
      continue;
    }

    const permissions = getConversationPermissions(
      recipient,
      conversation
    );

    const formatted = formatConversation(
      conversation,
      recipient,
      {
        onlineUserIds,
        permissions,
      }
    );

    io.to(userRoom(memberId)).emit(eventName, {
      conversation: formatted,
    });
  }
};

export const emitNewMessageCascade = async ({
  io,
  conversation,
  message,
  senderId,
}) => {
  if (!io || !message) {
    return { deliveredUserIds: [] };
  }

  const conversationId = (
    conversation._id ||
    conversation.id ||
    message.conversationId
  ).toString();

  const activeMembers = (conversation.members || []).filter(
    (member) => member.isActive
  );

  const deliveredUserIds = [];
  const deliveredAt = new Date();

  for (const member of activeMembers) {
    const memberId = member.user.toString();

    if (
      memberId !== senderId.toString() &&
      isUserOnline(memberId)
    ) {
      deliveredUserIds.push(memberId);
    }
  }

  if (deliveredUserIds.length > 0) {
    await upsertDeliveredReceipts({
      messageId: message.id,
      conversationId,
      userIds: deliveredUserIds,
      deliveredAt,
    });
  }

  const receiptMap = await loadReceiptsByMessageIds([
    message.id,
  ]);

  const receipts = receiptMap.get(String(message.id)) || [];

  const payloadMessage = {
    ...message,
    deliveredTo: receipts
      .filter((receipt) => receipt.deliveredAt)
      .map((receipt) => ({
        userId: receipt.user.toString(),
        deliveredAt: receipt.deliveredAt,
      })),
    seenBy: receipts
      .filter((receipt) => receipt.seenAt)
      .map((receipt) => ({
        userId: receipt.user.toString(),
        seenAt: receipt.seenAt,
      })),
  };

  void formatMessage;

  const payload = { message: payloadMessage };

  io.to(conversationRoom(conversationId)).emit(
    "message:new",
    payload
  );

  for (const member of activeMembers) {
    io.to(userRoom(member.user.toString())).emit(
      "message:new",
      payload
    );
  }

  if (deliveredUserIds.length > 0) {
    for (const userId of deliveredUserIds) {
      const deliveryPayload = {
        conversationId,
        messageIds: [message.id],
        userId,
        deliveredAt,
      };

      io.to(conversationRoom(conversationId)).emit(
        "message:delivered",
        deliveryPayload
      );

      io.to(userRoom(senderId.toString())).emit(
        "message:delivered",
        deliveryPayload
      );
    }
  }

  await emitConversationUpdateToMembers({
    io,
    conversationId,
  });

  return { deliveredUserIds };
};

export const emitMessageLifecycle = async ({
  io,
  eventName,
  message,
  extra = {},
}) => {
  if (!io || !message) {
    return;
  }

  const conversationId = message.conversationId?.toString?.() ||
    message.conversationId;

  const payload = {
    message,
    ...extra,
  };

  io.to(conversationRoom(conversationId)).emit(eventName, payload);

  try {
    const conversation = await Conversation.findById(conversationId)
      .select("members")
      .lean();

    for (const member of conversation?.members || []) {
      if (!member.isActive) {
        continue;
      }

      io.to(userRoom(member.user.toString())).emit(
        eventName,
        payload
      );
    }
  } catch {
    // Best-effort fan-out
  }

  if (eventName === "message:edited" || eventName === "message:deleted") {
    await emitConversationUpdateToMembers({
      io,
      conversationId,
    });
  }
};

export {
  upsertDeliveredReceipts,
  upsertSeenReceipts,
} from "./messageReceiptService.js";
