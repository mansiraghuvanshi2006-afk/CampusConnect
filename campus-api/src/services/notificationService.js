import Notification, {
  NOTIFICATION_TYPES,
} from "../models/Notification.js";

import ApiError from "../utils/ApiError.js";
import { isValidObjectId } from "./chatPolicyService.js";
import { userRoom } from "../sockets/socketRooms.js";

const toId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  return value.toString();
};

export const formatNotification = (notification) => {
  if (!notification) {
    return null;
  }

  return {
    id: toId(notification),
    type: notification.type,
    title: notification.title,
    body: notification.body || "",
    conversationId: toId(notification.conversation),
    messageId: toId(notification.message),
    callId: toId(notification.call),
    actor: notification.actor
      ? typeof notification.actor === "object"
        ? {
            id: toId(notification.actor),
            name: notification.actor.name,
            role: notification.actor.role,
          }
        : { id: toId(notification.actor) }
      : null,
    meta: notification.meta || {},
    isRead: Boolean(notification.isRead),
    readAt: notification.readAt || null,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
  };
};

export const createNotification = async ({
  userId,
  type,
  title,
  body = "",
  conversationId = null,
  messageId = null,
  callId = null,
  actorId = null,
  meta = {},
  io = null,
}) => {
  if (!userId || !type || !title) {
    return null;
  }

  if (actorId && toId(actorId) === toId(userId)) {
    return null;
  }

  const notification = await Notification.create({
    user: userId,
    type,
    title,
    body,
    conversation: conversationId,
    message: messageId,
    call: callId,
    actor: actorId,
    meta,
  });

  const populated = await Notification.findById(notification._id)
    .populate("actor", "name role")
    .lean();

  const formatted = formatNotification(populated);

  if (io) {
    io.to(userRoom(toId(userId))).emit(
      "notification:new",
      { notification: formatted }
    );
  }

  return formatted;
};

export const createNotificationsForMembers = async ({
  memberIds,
  excludeUserId,
  type,
  title,
  body,
  conversationId,
  messageId,
  callId,
  actorId,
  meta,
  io,
}) => {
  const targets = (memberIds || []).filter(
    (id) => toId(id) && toId(id) !== toId(excludeUserId)
  );

  const results = [];

  for (const userId of targets) {
    const created = await createNotification({
      userId,
      type,
      title,
      body,
      conversationId,
      messageId,
      callId,
      actorId,
      meta,
      io,
    });

    if (created) {
      results.push(created);
    }
  }

  return results;
};

export const listNotifications = async (
  currentUser,
  params = {}
) => {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(
    50,
    Math.max(1, Number(params.limit) || 20)
  );
  const skip = (page - 1) * limit;

  const query = { user: currentUser._id };

  if (params.unreadOnly === true || params.unreadOnly === "true") {
    query.isRead = false;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .populate("actor", "name role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({
      user: currentUser._id,
      isRead: false,
    }),
  ]);

  return {
    notifications: notifications.map(formatNotification),
    unreadCount,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
};

export const getUnreadNotificationCount = async (currentUser) => {
  const unreadCount = await Notification.countDocuments({
    user: currentUser._id,
    isRead: false,
  });

  return { unreadCount };
};

export const markNotificationRead = async (
  currentUser,
  notificationId
) => {
  if (!isValidObjectId(notificationId)) {
    throw new ApiError(400, "Invalid notification ID");
  }

  const notification = await Notification.findOne({
    _id: notificationId,
    user: currentUser._id,
  });

  if (!notification) {
    throw new ApiError(404, "Notification not found");
  }

  if (!notification.isRead) {
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
  }

  const populated = await Notification.findById(notification._id)
    .populate("actor", "name role")
    .lean();

  return formatNotification(populated);
};

export const markAllNotificationsRead = async (currentUser) => {
  const result = await Notification.updateMany(
    {
      user: currentUser._id,
      isRead: false,
    },
    {
      $set: {
        isRead: true,
        readAt: new Date(),
      },
    }
  );

  return {
    modifiedCount: result.modifiedCount || 0,
  };
};

export { NOTIFICATION_TYPES };
