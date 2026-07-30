import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import { serializeSettings } from "../utils/profileSerializers.js";
import Session from "../models/Session.js";
import {
  clearRefreshTokenCookie,
} from "../utils/authCookies.js";

const THEMES = new Set(["dark", "light", "system"]);

/**
 * Build an allowlisted settings update. Never applies req.body
 * wholesale onto the User document.
 */
export const buildSettingsUpdate = (body = {}) => {
  const update = {};

  if (body.theme !== undefined) {
    if (!THEMES.has(body.theme)) {
      throw new ApiError(400, "Invalid theme");
    }
    update["settings.theme"] = body.theme;
  }

  if (body.language !== undefined) {
    const language = String(body.language).trim().toLowerCase();
    if (!/^[a-z]{2}(-[a-z]{2})?$/.test(language)) {
      throw new ApiError(400, "Invalid language code");
    }
    update["settings.language"] = language;
  }

  if (body.notifications !== undefined) {
    if (
      typeof body.notifications !== "object" ||
      body.notifications === null ||
      Array.isArray(body.notifications)
    ) {
      throw new ApiError(400, "notifications must be an object");
    }

    const allowed = [
      "chatMessages",
      "groupUpdates",
      "callAlerts",
      "aiUpdates",
      "emailDigest",
    ];

    for (const key of Object.keys(body.notifications)) {
      if (!allowed.includes(key)) {
        throw new ApiError(400, `Unknown notification preference: ${key}`);
      }
      if (typeof body.notifications[key] !== "boolean") {
        throw new ApiError(400, `notifications.${key} must be a boolean`);
      }
      update[`settings.notifications.${key}`] = body.notifications[key];
    }
  }

  if (body.privacy !== undefined) {
    if (
      typeof body.privacy !== "object" ||
      body.privacy === null ||
      Array.isArray(body.privacy)
    ) {
      throw new ApiError(400, "privacy must be an object");
    }

    const allowed = [
      "showOnlineStatus",
      "showLastSeen",
      "showProfileToCampus",
    ];

    for (const key of Object.keys(body.privacy)) {
      if (!allowed.includes(key)) {
        throw new ApiError(400, `Unknown privacy preference: ${key}`);
      }
      if (typeof body.privacy[key] !== "boolean") {
        throw new ApiError(400, `privacy.${key} must be a boolean`);
      }
      update[`settings.privacy.${key}`] = body.privacy[key];
    }
  }

  if (Object.keys(update).length === 0) {
    throw new ApiError(400, "No settings fields were provided");
  }

  return update;
};

export const getMySettings = async (userId) => {
  const user = await User.findById(userId).select("settings");

  if (!user) {
    throw new ApiError(404, "User account not found");
  }

  return serializeSettings(user);
};

export const updateMySettings = async (userId, body) => {
  const update = buildSettingsUpdate(body);

  const user = await User.findByIdAndUpdate(userId, update, {
    returnDocument: "after",
    runValidators: true,
  }).select("settings");

  if (!user) {
    throw new ApiError(404, "User account not found");
  }

  return serializeSettings(user);
};

/**
 * Change password for the authenticated user.
 * Invalidates all other sessions after a successful change.
 */
export const changeMyPassword = async (user, { currentPassword, newPassword }) => {
  const account = await User.findById(user._id).select("+password");

  if (!account) {
    throw new ApiError(404, "User account not found");
  }

  const matches = await account.comparePassword(currentPassword);

  if (!matches) {
    throw new ApiError(400, "Current password is incorrect");
  }

  if (currentPassword === newPassword) {
    throw new ApiError(
      400,
      "New password must be different from the current password"
    );
  }

  account.password = newPassword;
  account.mustChangePassword = false;
  account.tokenVersion = (Number(account.tokenVersion) || 0) + 1;
  await account.save();

  await Session.deleteMany({ user: account._id });

  return true;
};

/**
 * Logout every device: delete sessions and bump tokenVersion.
 */
export const logoutAllMyDevices = async (user, res) => {
  await Session.deleteMany({ user: user._id });

  await User.findByIdAndUpdate(user._id, {
    $inc: { tokenVersion: 1 },
  });

  clearRefreshTokenCookie(res);

  try {
    const { getIO } = await import("../sockets/socketServer.js");
    const { getUserSocketIds } = await import(
      "../sockets/socketPresence.js"
    );
    const io = getIO();
    if (io) {
      const socketIds = getUserSocketIds(user._id.toString());
      for (const socketId of socketIds) {
        const socket = io.sockets.sockets.get(socketId);
        socket?.disconnect(true);
      }
    }
  } catch {
    // Socket layer is optional during tests / early boot.
  }

  return true;
};
