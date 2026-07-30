import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import CallOverlay from "./CallOverlay.jsx";

afterEach(() => {
  cleanup();
});

describe("CallOverlay", () => {
  it("shows accept and reject for incoming calls", () => {
    render(
      <CallOverlay
        incomingCall={{
          id: "c1",
          type: "audio",
          caller: { name: "Bob" },
        }}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: "Accept call" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reject call" })
    ).toBeInTheDocument();
  });

  it("shows cancel for outgoing ringing", () => {
    const onEnd = vi.fn();

    render(
      <CallOverlay
        call={{
          id: "c1",
          status: "ringing",
          type: "audio",
          caller: { id: "u1" },
          participants: [],
        }}
        currentUserId="u1"
        remoteStreams={{}}
        onEnd={onEnd}
      />
    );

    expect(
      screen.getByRole("button", { name: "Cancel call" })
    ).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel call" }));
    expect(onEnd).toHaveBeenCalled();
  });

  it("shows end call while active and keeps it in minimized state", () => {
    const onEnd = vi.fn();

    render(
      <CallOverlay
        call={{
          id: "c1",
          status: "active",
          type: "video",
          startedAt: new Date().toISOString(),
          caller: { id: "u1" },
          participants: [{ userId: "u2", user: { name: "Pat" } }],
        }}
        currentUserId="u1"
        remoteStreams={{}}
        muted={false}
        cameraOff={false}
        connectionState="connected"
        onEnd={onEnd}
        onToggleMute={vi.fn()}
        onToggleCamera={vi.fn()}
        onSwitchCamera={vi.fn()}
        onToggleScreenShare={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: "End call" })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Minimize call" })
    );

    const endButtons = screen.getAllByRole("button", { name: "End call" });
    expect(endButtons.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(endButtons[0]);
    expect(onEnd).toHaveBeenCalled();
  });
});
