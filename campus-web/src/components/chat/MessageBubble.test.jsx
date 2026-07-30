import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import MessageBubble from "./MessageBubble.jsx";

vi.mock("../../services/chatService.js", () => ({
  getUploadAbsoluteUrl: (url) => url || "",
}));

afterEach(() => {
  cleanup();
});

const baseMessage = {
  id: "m1",
  type: "text",
  text: "Hello campus",
  createdAt: new Date().toISOString(),
  sender: { id: "u1", name: "Alice" },
  reactionSummary: [],
};

describe("MessageBubble actions menu", () => {
  it("shows a visible menu button", () => {
    render(
      <MessageBubble message={baseMessage} isMine currentUserId="u1" />
    );

    expect(
      screen.getByRole("button", { name: "Message actions" })
    ).toBeInTheDocument();
  });

  it("opens and closes the menu with Escape", () => {
    render(
      <MessageBubble
        message={baseMessage}
        isMine
        currentUserId="u1"
        canSend
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Message actions" })
    );

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes on outside click", () => {
    render(
      <div>
        <button type="button">Outside</button>
        <MessageBubble
          message={baseMessage}
          isMine
          currentUserId="u1"
          canSend
        />
      </div>
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Message actions" })
    );
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("hides unauthorized Edit and Delete for everyone", () => {
    render(
      <MessageBubble
        message={baseMessage}
        isMine={false}
        currentUserId="u2"
        canSend
        canManage={false}
        userRole="student"
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Message actions" })
    );

    const menu = screen.getByRole("menu");
    expect(within(menu).queryByRole("menuitem", { name: "Edit" })).toBeNull();
    expect(
      within(menu).queryByRole("menuitem", {
        name: "Delete for everyone",
      })
    ).toBeNull();
    expect(
      within(menu).getByRole("menuitem", { name: "Reply" })
    ).toBeInTheDocument();
    expect(
      within(menu).getByRole("menuitem", { name: "Delete for me" })
    ).toBeInTheDocument();
  });

  it("shows authorized actions for own messages", () => {
    render(
      <MessageBubble
        message={baseMessage}
        isMine
        currentUserId="u1"
        canSend
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Message actions" })
    );

    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Delete for everyone" })
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "React" })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Forward" })
    ).toBeInTheDocument();
  });

  it("opens reaction picker from React action", () => {
    const onReact = vi.fn();

    render(
      <MessageBubble
        message={baseMessage}
        isMine
        currentUserId="u1"
        onReact={onReact}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Message actions" })
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "React" }));

    expect(
      screen.getByRole("listbox", { name: "Quick reactions" })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("option", { name: "React with 👍" })
    );

    expect(onReact).toHaveBeenCalledWith(baseMessage, "👍");
  });

  it("renders deleted tombstone without actions", () => {
    render(
      <MessageBubble
        message={{
          ...baseMessage,
          deletedForEveryone: true,
          text: null,
        }}
        isMine
        currentUserId="u1"
      />
    );

    expect(screen.getByText("This message was deleted")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Message actions" })
    ).not.toBeInTheDocument();
  });

  it("invokes reply and delete confirmations via menu", () => {
    const onReply = vi.fn();
    const onDeleteMe = vi.fn();
    const onDeleteEveryone = vi.fn();

    const { unmount } = render(
      <MessageBubble
        message={baseMessage}
        isMine
        currentUserId="u1"
        onReply={onReply}
        onDeleteMe={onDeleteMe}
        onDeleteEveryone={onDeleteEveryone}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Message actions" })
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Reply" }));
    expect(onReply).toHaveBeenCalledWith(baseMessage);

    fireEvent.click(
      screen.getByRole("button", { name: "Message actions" })
    );
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Delete for me" })
    );
    expect(onDeleteMe).toHaveBeenCalledWith(baseMessage);

    fireEvent.click(
      screen.getByRole("button", { name: "Message actions" })
    );
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Delete for everyone" })
    );
    expect(onDeleteEveryone).toHaveBeenCalledWith(baseMessage);

    unmount();
  });
});
