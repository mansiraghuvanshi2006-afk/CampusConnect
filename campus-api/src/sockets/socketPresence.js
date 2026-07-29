/**
 * In-memory presence tracking.
 * Map<userId, Set<socketId>>
 */

const onlineSockets = new Map();

export const addSocket = (userId, socketId) => {
  const key = userId.toString();
  let sockets = onlineSockets.get(key);

  if (!sockets) {
    sockets = new Set();
    onlineSockets.set(key, sockets);
  }

  const wasOffline = sockets.size === 0;
  sockets.add(socketId);

  return {
    wasOffline,
    socketCount: sockets.size,
  };
};

export const removeSocket = (userId, socketId) => {
  const key = userId.toString();
  const sockets = onlineSockets.get(key);

  if (!sockets) {
    return {
      isNowOffline: true,
      socketCount: 0,
    };
  }

  sockets.delete(socketId);

  if (sockets.size === 0) {
    onlineSockets.delete(key);

    return {
      isNowOffline: true,
      socketCount: 0,
    };
  }

  return {
    isNowOffline: false,
    socketCount: sockets.size,
  };
};

export const isUserOnline = (userId) => {
  const sockets = onlineSockets.get(userId.toString());
  return Boolean(sockets && sockets.size > 0);
};

export const getOnlineUserIds = () => {
  return new Set(onlineSockets.keys());
};

export const getUserSocketIds = (userId) => {
  const sockets = onlineSockets.get(userId.toString());
  return sockets ? [...sockets] : [];
};

export const getPresenceSnapshot = () => {
  const onlineUserIds = {};

  for (const [userId, sockets] of onlineSockets.entries()) {
    onlineUserIds[userId] = sockets.size;
  }

  return onlineUserIds;
};

/** Test-only helper — clears the in-memory presence map. */
export const resetPresenceState = () => {
  onlineSockets.clear();
};
