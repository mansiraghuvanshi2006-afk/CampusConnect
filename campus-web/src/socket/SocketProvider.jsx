/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAuth } from "../context/AuthContext.jsx";
import {
  ACCESS_TOKEN_KEY,
} from "../services/api.js";

import {
  connectSocket,
  disconnectSocket,
  getSocket,
  updateSocketAuthToken,
} from "./socketClient.js";

export const SocketContext = createContext(null);

const canUserUseChat = (user) => {
  if (!user) {
    return false;
  }

  if (!user.isEmailVerified || !user.isActive) {
    return false;
  }

  if (user.role === "admin") {
    return true;
  }

  if (!user.profileCompleted) {
    return false;
  }

  if (user.role === "teacher") {
    return user.teacherApprovalStatus === "approved";
  }

  if (user.role === "student") {
    return Boolean(user.department && user.year);
  }

  return false;
};

export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();

  const [isConnected, setIsConnected] =
    useState(false);
  const [connectionError, setConnectionError] =
    useState(null);
  const [onlineUsers, setOnlineUsers] = useState(
    () => new Set()
  );

  const listenersReady = useRef(false);
  const eligible = canUserUseChat(user) && isAuthenticated;

  const markOnline = useCallback((userId) => {
    setOnlineUsers((previous) => {
      const next = new Set(previous);
      next.add(userId);
      return next;
    });
  }, []);

  const markOffline = useCallback((userId) => {
    setOnlineUsers((previous) => {
      const next = new Set(previous);
      next.delete(userId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!eligible) {
      disconnectSocket();

      const timer = window.setTimeout(() => {
        setIsConnected(false);
        setConnectionError(null);
        setOnlineUsers(new Set());
      }, 0);

      listenersReady.current = false;
      return () => window.clearTimeout(timer);
    }

    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    const socket = connectSocket(token);

    if (!socket) {
      const timer = window.setTimeout(() => {
        setConnectionError("Missing access token");
      }, 0);

      return () => window.clearTimeout(timer);
    }

    const handleConnect = () => {
      setIsConnected(true);
      setConnectionError(null);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleConnectError = (error) => {
      setIsConnected(false);
      setConnectionError(
        error?.message || "Unable to connect to chat"
      );
    };

    const handlePresenceOnline = (payload) => {
      if (payload?.userId) {
        markOnline(String(payload.userId));
      }
    };

    const handlePresenceOffline = (payload) => {
      if (payload?.userId) {
        markOffline(String(payload.userId));
      }
    };

    const handlePresenceSnapshot = (payload) => {
      if (Array.isArray(payload?.users)) {
        const next = new Set();

        for (const entry of payload.users) {
          if (entry?.isOnline && entry.userId) {
            next.add(String(entry.userId));
          }
        }

        setOnlineUsers(next);
        return;
      }

      if (Array.isArray(payload?.onlineUserIds)) {
        setOnlineUsers(
          new Set(
            payload.onlineUserIds.map((id) => String(id))
          )
        );
      }
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("presence:online", handlePresenceOnline);
    socket.on("presence:offline", handlePresenceOffline);
    socket.on("presence:snapshot", handlePresenceSnapshot);

    listenersReady.current = true;

    if (socket.connected) {
      const timer = window.setTimeout(() => {
        setIsConnected(true);
      }, 0);

      return () => {
        window.clearTimeout(timer);
        socket.off("connect", handleConnect);
        socket.off("disconnect", handleDisconnect);
        socket.off("connect_error", handleConnectError);
        socket.off("presence:online", handlePresenceOnline);
        socket.off(
          "presence:offline",
          handlePresenceOffline
        );
        socket.off(
          "presence:snapshot",
          handlePresenceSnapshot
        );
      };
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("presence:online", handlePresenceOnline);
      socket.off("presence:offline", handlePresenceOffline);
      socket.off(
        "presence:snapshot",
        handlePresenceSnapshot
      );
    };
  }, [eligible, markOffline, markOnline, user?.id, user?._id]);

  useEffect(() => {
    if (!eligible) {
      return undefined;
    }

    const handleTokenRefresh = (event) => {
      const token =
        event?.detail?.accessToken ||
        localStorage.getItem(ACCESS_TOKEN_KEY);

      if (token) {
        updateSocketAuthToken(token);
      }
    };

    window.addEventListener(
      "auth:token-refreshed",
      handleTokenRefresh
    );

    return () => {
      window.removeEventListener(
        "auth:token-refreshed",
        handleTokenRefresh
      );
    };
  }, [eligible]);

  useEffect(() => {
    if (!eligible) {
      return undefined;
    }

    const handleStorage = () => {
      const token = localStorage.getItem(ACCESS_TOKEN_KEY);

      if (token) {
        updateSocketAuthToken(token);
      } else {
        disconnectSocket();
        setIsConnected(false);
      }
    };

    window.addEventListener(
      "storage",
      handleStorage
    );

    return () => {
      window.removeEventListener(
        "storage",
        handleStorage
      );
    };
  }, [eligible]);

  useEffect(() => {
    return () => {
      if (!canUserUseChat(user)) {
        disconnectSocket();
      }
    };
  }, [user]);

  const value = useMemo(
    () => ({
      socket: getSocket(),
      isConnected,
      connectionError,
      onlineUsers,
      isUserOnline: (userId) =>
        onlineUsers.has(String(userId)),
      reconnectWithToken: (token) => {
        updateSocketAuthToken(token);
      },
    }),
    [
      connectionError,
      isConnected,
      onlineUsers,
    ]
  );

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketProvider;
