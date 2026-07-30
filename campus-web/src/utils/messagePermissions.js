const EDITABLE_TYPES = new Set(["text"]);
const NON_ACTIONABLE_TYPES = new Set(["system", "call"]);

/** Default matches campus-api MESSAGE_EDIT_WINDOW_MS (15 minutes). */
export const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;

const withinEditWindow = (message, now = Date.now()) => {
  if (!message?.createdAt) {
    return false;
  }

  const created = new Date(message.createdAt).getTime();

  if (!Number.isFinite(created)) {
    return false;
  }

  return now - created <= MESSAGE_EDIT_WINDOW_MS;
};

/**
 * Client-side message action visibility. Prefer backend enforcement;
 * never show actions the user is known to be unauthorized for.
 */
export const getMessageActionPermissions = ({
  message,
  isMine,
  canSend = true,
  canManage = false,
  isMember = true,
  userRole = null,
  now = Date.now(),
} = {}) => {
  const deleted = Boolean(message?.deletedForEveryone);
  const type = message?.type || "text";
  const actionable = !deleted && !NON_ACTIONABLE_TYPES.has(type);
  const isAdmin = userRole === "admin";

  return {
    canReply: actionable && isMember && canSend && Boolean(message?.id),
    canReact: actionable && isMember && Boolean(message?.id),
    canEdit:
      actionable &&
      isMine &&
      EDITABLE_TYPES.has(type) &&
      withinEditWindow(message, now) &&
      canSend,
    canForward: actionable && isMember && Boolean(message?.id),
    canDeleteMe: actionable && isMember && Boolean(message?.id),
    canDeleteEveryone:
      actionable && isMember && (isMine || canManage || isAdmin),
  };
};

export const getMessagePinPermission = ({
  message,
  isMember = true,
  canManage = false,
  userRole = null,
  conversationType = "direct",
} = {}) => {
  if (!message || message.deletedForEveryone || !isMember) {
    return false;
  }

  if (NON_ACTIONABLE_TYPES.has(message.type)) {
    return false;
  }

  if (conversationType === "direct") {
    return true;
  }

  return canManage || userRole === "admin";
};
