import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import ConfirmDialog from "./ConfirmDialog.jsx";
import StudentDashboard from "../../pages/student/StudentDashboard.jsx";
import TeacherDashboard from "../../pages/teacher/TeacherDashboard.jsx";

vi.mock("../../context/AuthContext.jsx", () => ({
  useAuth: () => ({
    user: {
      name: "Test User",
      email: "test@campus.test",
      role: "student",
      profileCompleted: true,
      department: { name: "CSE" },
      year: 2,
      teachingYears: [1, 2],
      teacherApprovalStatus: "approved",
    },
  }),
}));

vi.mock("../../services/chatService.js", () => ({
  getConversations: vi.fn(async () => [
    {
      id: "c1",
      type: "direct",
      name: "Ada",
      unreadCount: 2,
      lastMessage: { text: "Hi" },
      lastMessageAt: new Date().toISOString(),
    },
  ]),
}));

vi.mock("../../components/layout/DashboardLayout.jsx", () => ({
  default: ({ children, title }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

describe("ConfirmDialog conversation actions", () => {
  it("shows clear-chat confirmation copy", () => {
    render(
      <ConfirmDialog
        open
        title="Clear chat for me"
        description="This clears the chat only for you. Other members keep their message history."
        confirmLabel="Clear chat"
        destructive
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("Clear chat for me")).toBeInTheDocument();
    expect(
      screen.getByText(/clears the chat only for you/i)
    ).toBeInTheDocument();
  });

  it("shows delete-direct confirmation copy", () => {
    render(
      <ConfirmDialog
        open
        title="Delete conversation"
        description="This removes the conversation from your list only."
        confirmLabel="Delete for me"
        destructive
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete for me" }));
  });

  it("requires group name for delete group", () => {
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open
        title="Delete group"
        description="Type the group name to confirm."
        confirmLabel="Delete group"
        destructive
        requireText="Year 2 CSE"
        confirmText=""
        onConfirmTextChange={vi.fn()}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: "Delete group" })
    ).toBeDisabled();
  });
});

describe("Dashboard placeholder cleanup", () => {
  it("student dashboard does not show assignment/course placeholders", async () => {
    render(
      <MemoryRouter>
        <StudentDashboard />
      </MemoryRouter>
    );

    expect(screen.getByText("Student Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Courses")).not.toBeInTheDocument();
    expect(screen.queryByText("Assignments")).not.toBeInTheDocument();
    expect(await screen.findByText("Unread chats")).toBeInTheDocument();
    expect(screen.getByText("Department")).toBeInTheDocument();
    expect(screen.getByText("Recent conversations")).toBeInTheDocument();
  });

  it("teacher dashboard does not show assignment/course placeholders", async () => {
    render(
      <MemoryRouter>
        <TeacherDashboard />
      </MemoryRouter>
    );

    expect(screen.getByText("Teacher Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Courses")).not.toBeInTheDocument();
    expect(screen.queryByText("Assignments")).not.toBeInTheDocument();
    expect(await screen.findByText("Active chat groups")).toBeInTheDocument();
    expect(screen.getAllByText("Approval status").length).toBeGreaterThan(0);
  });
});
