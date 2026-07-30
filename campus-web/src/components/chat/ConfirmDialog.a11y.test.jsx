import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ConfirmDialog from "./ConfirmDialog.jsx";

describe("ConfirmDialog accessibility", () => {
  it("exposes dialog semantics and closes on Escape", () => {
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open
        title="Delete item"
        description="This cannot be undone"
        onCancel={onCancel}
        onConfirm={() => {}}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Delete item")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });
});
