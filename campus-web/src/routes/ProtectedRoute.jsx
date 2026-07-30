import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

import useAuth from "../hooks/useAuth.js";
import { CHANGE_PASSWORD_PATH } from "../context/AuthContext.jsx";

/**
 * Return the required route for a user based on
 * profile completion and teacher approval status.
 */
const getRequiredUserPath = (user) => {
  if (!user) {
    return "/login";
  }

  if (user.mustChangePassword) {
    return CHANGE_PASSWORD_PATH;
  }

  /**
   * Admin users can directly access
   * the admin dashboard.
   */
  if (user.role === "admin") {
    return "/admin/dashboard";
  }

  /**
   * Student routing.
   */
  if (user.role === "student") {
    if (!user.profileCompleted) {
      return "/student/complete-profile";
    }

    return "/student/dashboard";
  }

  /**
   * Teacher routing.
   */
  if (user.role === "teacher") {
    if (!user.profileCompleted) {
      return "/teacher/complete-profile";
    }

    if (
      user.teacherApprovalStatus ===
      "rejected"
    ) {
      return "/teacher/approval-rejected";
    }

    if (
      user.teacherApprovalStatus !==
      "approved"
    ) {
      return "/teacher/approval-pending";
    }

    return "/teacher/dashboard";
  }

  return "/";
};

const ProtectedRoute = ({
  allowedRoles = [],
}) => {
  const {
    user,
    isLoading,
    isAuthenticated,
    getDashboardPath,
  } = useAuth();

  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#313338] px-4 text-center text-white">
        Loading Campus Connect...
      </div>
    );
  }

  /**
   * User is not logged in.
   */
  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
        }}
      />
    );
  }

  /**
   * A temporary password must be replaced before any
   * other protected page becomes reachable, including
   * URLs typed by hand.
   */
  if (
    user.mustChangePassword &&
    location.pathname !== CHANGE_PASSWORD_PATH
  ) {
    return (
      <Navigate
        to={CHANGE_PASSWORD_PATH}
        replace
      />
    );
  }

  /**
   * Nobody else should reach the password-change page.
   */
  if (location.pathname === CHANGE_PASSWORD_PATH) {
    if (!user.mustChangePassword) {
      return (
        <Navigate
          to={getRequiredUserPath(user)}
          replace
        />
      );
    }

    /*
      The onboarding and approval redirects below must not
      run here, otherwise the two guards would bounce the
      user back and forth.
    */
    return <Outlet />;
  }

  /**
   * User is logged in but does not have
   * permission to access this role route.
   */
  if (
    allowedRoles.length > 0 &&
    !allowedRoles.includes(user.role)
  ) {
    const fallbackPath =
      typeof getDashboardPath === "function"
        ? getDashboardPath(user)
        : getRequiredUserPath(user);

    return (
      <Navigate
        to={fallbackPath}
        replace
      />
    );
  }

  const requiredPath =
    getRequiredUserPath(user);

  const currentPath =
    location.pathname;

  /**
   * Student must finish their profile before
   * accessing the dashboard.
   */
  if (
    user.role === "student" &&
    !user.profileCompleted &&
    currentPath !==
      "/student/complete-profile"
  ) {
    return (
      <Navigate
        to="/student/complete-profile"
        replace
      />
    );
  }

  /**
   * Prevent completed students from returning
   * to the profile-completion screen.
   */
  if (
    user.role === "student" &&
    user.profileCompleted &&
    currentPath ===
      "/student/complete-profile"
  ) {
    return (
      <Navigate
        to="/student/dashboard"
        replace
      />
    );
  }

  /**
   * Teacher must finish their profile first.
   */
  if (
    user.role === "teacher" &&
    !user.profileCompleted &&
    currentPath !==
      "/teacher/complete-profile"
  ) {
    return (
      <Navigate
        to="/teacher/complete-profile"
        replace
      />
    );
  }

  /**
   * Completed teacher waiting for approval.
   */
  if (
    user.role === "teacher" &&
    user.profileCompleted &&
    user.teacherApprovalStatus !==
      "approved" &&
    user.teacherApprovalStatus !==
      "rejected" &&
    currentPath !==
      "/teacher/approval-pending"
  ) {
    return (
      <Navigate
        to="/teacher/approval-pending"
        replace
      />
    );
  }

  /**
   * Rejected teacher should only see the
   * rejection screen.
   */
  if (
    user.role === "teacher" &&
    user.profileCompleted &&
    user.teacherApprovalStatus ===
      "rejected" &&
    currentPath !==
      "/teacher/approval-rejected"
  ) {
    return (
      <Navigate
        to="/teacher/approval-rejected"
        replace
      />
    );
  }

  /**
   * Approved teacher should not return to
   * setup, pending, or rejected screens.
   */
  if (
    user.role === "teacher" &&
    user.profileCompleted &&
    user.teacherApprovalStatus ===
      "approved" &&
    [
      "/teacher/complete-profile",
      "/teacher/approval-pending",
      "/teacher/approval-rejected",
    ].includes(currentPath)
  ) {
    return (
      <Navigate
        to="/teacher/dashboard"
        replace
      />
    );
  }

  /**
   * Final safety redirect.
   */
  if (
    requiredPath !== currentPath &&
    user.role === "teacher" &&
    currentPath === "/teacher/dashboard" &&
    user.teacherApprovalStatus !==
      "approved"
  ) {
    return (
      <Navigate
        to={requiredPath}
        replace
      />
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;