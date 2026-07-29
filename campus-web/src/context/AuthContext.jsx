/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getCurrentUser,
  loginUser,
  logoutUser,
} from "../services/authService.js";

import {
  ACCESS_TOKEN_KEY,
} from "../services/api.js";

export const AuthContext =
  createContext(null);

/**
 * Return the correct page based on the user's
 * role, profile completion and approval status.
 */
const getDashboardPath = (userOrRole) => {
  const user =
    typeof userOrRole === "string"
      ? {
          role: userOrRole,
        }
      : userOrRole;

  if (!user) {
    return "/login";
  }

  switch (user.role) {
    case "admin":
      return "/admin/dashboard";

    case "student":
      if (!user.profileCompleted) {
        return "/student/complete-profile";
      }

      return "/student/dashboard";

    case "teacher":
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

    default:
      return "/login";
  }
};

export const AuthProvider = ({
  children,
}) => {
  const [user, setUser] =
    useState(null);

  const [isLoading, setIsLoading] =
    useState(true);

  /**
   * Login user and save user information
   * in the authentication state.
   */
  const login = useCallback(
    async (credentials) => {
      const data =
        await loginUser(credentials);

      if (!data?.user) {
        throw new Error(
          "Login response did not contain user information"
        );
      }

      setUser(data.user);

      return data.user;
    },
    []
  );

  /**
   * Update the current user locally.
   *
   * This will be used after student or teacher
   * profile completion.
   */
  const updateUser = useCallback(
    (updatedUser) => {
      if (!updatedUser) {
        return;
      }

      setUser((currentUser) => ({
        ...currentUser,
        ...updatedUser,
      }));
    },
    []
  );

  /**
   * Reload the latest user information
   * from the backend.
   */
  const refreshUser = useCallback(
    async () => {
      const currentUser =
        await getCurrentUser();

      setUser(currentUser);

      return currentUser;
    },
    []
  );

  /**
   * Logout and clear all local authentication
   * information.
   */
  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } finally {
      localStorage.removeItem(
        ACCESS_TOKEN_KEY
      );

      setUser(null);
    }
  }, []);

  /**
   * Restore the authenticated user when
   * the application starts or refreshes.
   */
  const loadCurrentUser =
    useCallback(async () => {
      const accessToken =
        localStorage.getItem(
          ACCESS_TOKEN_KEY
        );

      if (!accessToken) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      try {
        const currentUser =
          await getCurrentUser();

        setUser(currentUser);
      } catch {
        localStorage.removeItem(
          ACCESS_TOKEN_KEY
        );

        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(
      loadCurrentUser,
      0
    );

    return () => window.clearTimeout(timeoutId);
  }, [loadCurrentUser]);

  /**
   * Automatically log the user out when the API
   * reports an unauthorized request.
   */
  useEffect(() => {
    const handleUnauthorized = () => {
      localStorage.removeItem(
        ACCESS_TOKEN_KEY
      );

      setUser(null);
    };

    window.addEventListener(
      "auth:unauthorized",
      handleUnauthorized
    );

    return () => {
      window.removeEventListener(
        "auth:unauthorized",
        handleUnauthorized
      );
    };
  }, []);

  const value = useMemo(
    () => ({
      user,

      isLoading,

      isAuthenticated:
        Boolean(user),

      login,

      logout,

      updateUser,

      refreshUser,

      getDashboardPath,
    }),
    [
      user,
      isLoading,
      login,
      logout,
      updateUser,
      refreshUser,
    ]
  );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
};
