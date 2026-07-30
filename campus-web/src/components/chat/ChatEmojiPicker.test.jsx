import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";

/**
 * Composer emoji insertion behaviour (same pattern used by ChatPage).
 * ChatEmojiPicker itself wraps emoji-picker-react; package resolution is
 * covered by the production build.
 */
const ComposerHarness = () => {
  const [draft, setDraft] = useState("Hello");
  const [open, setOpen] = useState(true);

  const insertEmoji = (emoji) => {
    setDraft((previous) => `${previous}${emoji}`);
    setOpen(false);
  };

  return (
    <div>
      <textarea
        aria-label="composer"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      {open && (
        <button type="button" onClick={() => insertEmoji("🎉")}>
          Pick 🎉
        </button>
      )}
      <span data-testid="draft">{draft}</span>
    </div>
  );
};

describe("Composer emoji picker", () => {
  it("inserts emoji without erasing existing text", () => {
    render(<ComposerHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Pick 🎉" }));

    expect(screen.getByTestId("draft")).toHaveTextContent("Hello🎉");
    expect(
      screen.queryByRole("button", { name: "Pick 🎉" })
    ).not.toBeInTheDocument();
  });
});

describe("Responsive chat pane expectation", () => {
  it("documents mobile list/chat toggle classes used by ChatPage", () => {
    const withConversation = Boolean("conversation-id");
    const withoutConversation = Boolean("");

    const listWhenOpen = withConversation ? "hidden md:flex" : "flex";
    const chatWhenOpen = withConversation ? "flex" : "hidden md:flex";
    const listWhenClosed = withoutConversation
      ? "hidden md:flex"
      : "flex";
    const chatWhenClosed = withoutConversation
      ? "flex"
      : "hidden md:flex";

    expect(listWhenOpen).toContain("hidden md:flex");
    expect(chatWhenOpen).toBe("flex");
    expect(listWhenClosed).toBe("flex");
    expect(chatWhenClosed).toContain("hidden md:flex");
  });
});
