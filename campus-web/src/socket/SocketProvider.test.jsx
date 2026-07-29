import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";

const listeners = new Map();
const socketStub = {
  connected: false,
  on: vi.fn((event, handler) => {
    const list = listeners.get(event) || [];
    list.push(handler);
    listeners.set(event, list);
  }),
  off: vi.fn((event, handler) => {
    const list = listeners.get(event) || [];
    listeners.set(
      event,
      list.filter((item) => item !== handler)
    );
  }),
  connect: vi.fn(() => {
    socketStub.connected = true;
  }),
  disconnect: vi.fn(() => {
    socketStub.connected = false;
  }),
  removeAllListeners: vi.fn(() => {
    listeners.clear();
  }),
  auth: {},
};

vi.mock("../socket/socketClient.js", () => ({
  connectSocket: vi.fn(() => socketStub),
  disconnectSocket: vi.fn(() => {
    socketStub.connected = false;
  }),
  getSocket: vi.fn(() => socketStub),
  updateSocketAuthToken: vi.fn(() => socketStub),
}));

vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "../context/AuthContext.jsx";
import {
  connectSocket,
  disconnectSocket,
  updateSocketAuthToken,
} from "../socket/socketClient.js";
import { SocketProvider } from "../socket/SocketProvider.jsx";
import useSocket from "../socket/useSocket.js";

const Probe = () => {
  const {
    isConnected,
    connectionError,
    onlineUsers,
  } = useSocket();

  return (
    <div>
      <span data-testid="connected">
        {String(isConnected)}
      </span>
      <span data-testid="error">
        {connectionError || ""}
      </span>
      <span data-testid="online">
        {[...onlineUsers].join(",")}
      </span>
    </div>
  );
};

describe("SocketProvider", () => {
  beforeEach(() => {
    listeners.clear();
    socketStub.connected = false;
    vi.clearAllMocks();
    localStorage.setItem(
      "campus_connect_access_token",
      "token-1"
    );

    useAuth.mockReturnValue({
      user: {
        id: "u1",
        role: "student",
        isEmailVerified: true,
        isActive: true,
        profileCompleted: true,
        department: "d1",
        year: 2,
      },
      isAuthenticated: true,
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("creates one socket for an eligible user and cleans up listeners", async () => {
    const { unmount, rerender } = render(
      <SocketProvider>
        <Probe />
      </SocketProvider>
    );

    expect(connectSocket).toHaveBeenCalledTimes(1);

    rerender(
      <SocketProvider>
        <Probe />
      </SocketProvider>
    );

    expect(connectSocket).toHaveBeenCalledTimes(1);

    const connectHandlers = listeners.get("connect") || [];
    connectHandlers.forEach((handler) => handler());

    await waitFor(() => {
      expect(screen.getByTestId("connected").textContent).toBe(
        "true"
      );
    });

    unmount();
    expect(socketStub.off).toHaveBeenCalled();
  });

  it("disconnects when the user becomes ineligible", async () => {
    const { rerender } = render(
      <SocketProvider>
        <Probe />
      </SocketProvider>
    );

    useAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
    });

    rerender(
      <SocketProvider>
        <Probe />
      </SocketProvider>
    );

    await waitFor(() => {
      expect(disconnectSocket).toHaveBeenCalled();
    });
  });

  it("stores scoped presence snapshot users only", async () => {
    render(
      <SocketProvider>
        <Probe />
      </SocketProvider>
    );

    const snapshotHandlers =
      listeners.get("presence:snapshot") || [];

    snapshotHandlers.forEach((handler) =>
      handler({
        users: [
          { userId: "u1", isOnline: true },
          { userId: "u2", isOnline: false },
          { userId: "u3", isOnline: true },
        ],
      })
    );

    await waitFor(() => {
      expect(screen.getByTestId("online").textContent).toBe(
        "u1,u3"
      );
    });
  });

  it("exposes connection errors and refreshes auth token", async () => {
    render(
      <SocketProvider>
        <Probe />
      </SocketProvider>
    );

    const errorHandlers =
      listeners.get("connect_error") || [];

    errorHandlers.forEach((handler) =>
      handler(new Error("CHAT_ACCESS_DENIED"))
    );

    await waitFor(() => {
      expect(screen.getByTestId("error").textContent).toContain(
        "CHAT_ACCESS_DENIED"
      );
    });

    window.dispatchEvent(
      new CustomEvent("auth:token-refreshed", {
        detail: { accessToken: "token-2" },
      })
    );

    expect(updateSocketAuthToken).toHaveBeenCalledWith(
      "token-2"
    );
  });
});
