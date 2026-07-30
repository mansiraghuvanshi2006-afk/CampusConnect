import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { cleanup, render, screen } from "@testing-library/react";

import ProtectedRoute from "./ProtectedRoute.jsx";
import { CHANGE_PASSWORD_PATH } from "../context/AuthContext.jsx";

const authState = vi.hoisted(() => ({
  user: null,
  isLoading: false,
  isAuthenticated: false,
  getDashboardPath: (user) => {
    if (!user) return "/login";
    if (user.mustChangePassword) return "/change-password";
    if (user.role === "student") return "/student/dashboard";
    if (user.role === "teacher") return "/teacher/dashboard";
    if (user.role === "admin") return "/admin/dashboard";
    return "/";
  },
}));

vi.mock("../hooks/useAuth.js", () => ({
  default: () => ({
    user: authState.user,
    isLoading: authState.isLoading,
    isAuthenticated: authState.isAuthenticated,
    getDashboardPath: authState.getDashboardPath,
  }),
}));

const renderWithAuth = (initialPath) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route
            path="/change-password"
            element={<div>Change password page</div>}
          />
          <Route
            path="/student/dashboard"
            element={<div>Student dashboard</div>}
          />
          <Route
            path="/student/chat"
            element={<div>Student chat</div>}
          />
        </Route>
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>
  );

describe("ProtectedRoute temporary password guard", () => {
  beforeEach(() => {
    authState.user = null;
    authState.isLoading = false;
    authState.isAuthenticated = false;
  });

  afterEach(() => {
    cleanup();
  });

  it("redirects mustChangePassword users away from chat", () => {
    authState.user = {
      id: "u1",
      role: "student",
      mustChangePassword: true,
      profileCompleted: true,
      isEmailVerified: true,
    };
    authState.isAuthenticated = true;

    renderWithAuth("/student/chat");

    expect(
      screen.getByText("Change password page")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Student chat")
    ).not.toBeInTheDocument();
  });

  it("allows the change-password page while the flag is set", () => {
    authState.user = {
      id: "u1",
      role: "student",
      mustChangePassword: true,
      profileCompleted: true,
      isEmailVerified: true,
    };
    authState.isAuthenticated = true;

    renderWithAuth(CHANGE_PASSWORD_PATH);

    expect(
      screen.getByText("Change password page")
    ).toBeInTheDocument();
  });

  it("sends users without the flag away from change-password", () => {
    authState.user = {
      id: "u1",
      role: "student",
      mustChangePassword: false,
      profileCompleted: true,
      isEmailVerified: true,
    };
    authState.isAuthenticated = true;

    renderWithAuth(CHANGE_PASSWORD_PATH);

    expect(
      screen.getByText("Student dashboard")
    ).toBeInTheDocument();
  });
});
