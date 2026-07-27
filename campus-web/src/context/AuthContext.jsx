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

const getDashboardPath = (role) => {
  switch (role) {
    case "admin":
      return "/admin/dashboard";

    case "teacher":
      return "/teacher/dashboard";

    case "student":
      return "/student/dashboard";

    default:
      return "/login";
  }
};

export const AuthProvider = ({
  children,
}) => {
  const [user, setUser] = useState(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const login = useCallback(
    async (credentials) => {
      const data =
        await loginUser(credentials);

      setUser(data.user);

      return data.user;
    },
    []
  );

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
    loadCurrentUser();
  }, [loadCurrentUser]);

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
      isAuthenticated: Boolean(user),
      login,
      logout,
      getDashboardPath,
    }),
    [user, isLoading, login, logout]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
};