import { io } from "socket.io-client";

import { ACCESS_TOKEN_KEY } from "../services/api.js";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  "http://localhost:5000";

let socketInstance = null;

export const getSocket = () => socketInstance;

export const connectSocket = (accessToken) => {
  const token =
    accessToken ||
    localStorage.getItem(ACCESS_TOKEN_KEY);

  if (!token) {
    return null;
  }

  if (socketInstance?.connected) {
    return socketInstance;
  }

  if (socketInstance) {
    socketInstance.auth = { token };
    socketInstance.connect();
    return socketInstance;
  }

  socketInstance = io(SOCKET_URL, {
    autoConnect: false,
    withCredentials: true,
    transports: ["websocket", "polling"],
    auth: {
      token,
    },
    reconnection: true,
    reconnectionAttempts: 12,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  });

  socketInstance.connect();

  return socketInstance;
};

export const disconnectSocket = () => {
  if (!socketInstance) {
    return;
  }

  socketInstance.removeAllListeners();
  socketInstance.disconnect();
  socketInstance = null;
};

export const updateSocketAuthToken = (accessToken) => {
  if (!socketInstance) {
    return connectSocket(accessToken);
  }

  socketInstance.auth = {
    token: accessToken,
  };

  if (!socketInstance.connected) {
    socketInstance.connect();
  }

  return socketInstance;
};

export class SocketAckError extends Error {
  constructor({
    message,
    statusCode = 500,
    code = "INTERNAL_ERROR",
    errors = [],
  }) {
    super(message);
    this.name = "SocketAckError";
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
  }
}

export const emitWithAck = (
  event,
  payload = {},
  timeoutMs = 10000
) => {
  return new Promise((resolve, reject) => {
    if (!socketInstance?.connected) {
      reject(
        new SocketAckError({
          message: "Socket is not connected",
          statusCode: 503,
          code: "SOCKET_DISCONNECTED",
        })
      );
      return;
    }

    const timer = setTimeout(() => {
      reject(
        new SocketAckError({
          message: `Socket timeout for ${event}`,
          statusCode: 408,
          code: "SOCKET_TIMEOUT",
        })
      );
    }, timeoutMs);

    socketInstance.emit(event, payload, (response) => {
      clearTimeout(timer);

      if (!response?.success) {
        reject(
          new SocketAckError({
            message:
              response?.message ||
              `Socket event ${event} failed`,
            statusCode: response?.statusCode || 500,
            code: response?.code || "INTERNAL_ERROR",
            errors: response?.errors || [],
          })
        );
        return;
      }

      resolve(response.data || {});
    });
  });
};

export { SOCKET_URL };
