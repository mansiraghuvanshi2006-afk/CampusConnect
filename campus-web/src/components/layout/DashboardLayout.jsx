import {
  NavLink,
  useNavigate,
} from "react-router-dom";

import toast from "react-hot-toast";

import { useAuth } from "../../context/AuthContext.jsx";
import getErrorMessage from "../../utils/getErrorMessage.js";

const roleNavigation = {
  student: [
    {
      label: "Dashboard",
      to: "/student/dashboard",
      end: true,
    },
    {
      label: "Chat",
      to: "/student/chat",
      end: false,
    },
  ],

  teacher: [
    {
      label: "Dashboard",
      to: "/teacher/dashboard",
      end: true,
    },
    {
      label: "Chat",
      to: "/teacher/chat",
      end: false,
    },
  ],

  admin: [
    {
      label: "Dashboard",
      to: "/admin/dashboard",
      end: true,
    },
    {
      label: "Chat",
      to: "/admin/chat",
      end: false,
    },
    {
      label: "Departments",
      to: "/admin/departments",
      end: true,
    },
    {
      label: "Academic Years",
      to: "/admin/academic-years",
      end: true,
    },
  ],
};

const getLoginPath = (role) => {
  if (role === "admin") {
    return "/admin/login";
  }

  return "/login";
};

const DashboardLayout = ({
  title,
  description,
  children,
}) => {
  const navigate = useNavigate();

  const {
    user,
    logout,
  } = useAuth();

  const navigation =
    roleNavigation[user?.role] || [];

  const handleLogout = async () => {
    const currentRole = user?.role;

    try {
      await logout();

      toast.success(
        "Logged out successfully"
      );

      navigate(
        getLoginPath(currentRole),
        {
          replace: true,
        }
      );
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          "Unable to log out"
        )
      );
    }
  };

  const formattedRole = user?.role
    ? `${user.role
        .charAt(0)
        .toUpperCase()}${user.role.slice(1)}`
    : "";

  const navigationLinkClass = ({
    isActive,
  }) =>
    `block rounded-xl px-4 py-3 text-sm font-semibold transition ${
      isActive
        ? "bg-purple-600 text-white"
        : "text-[#b5bac1] hover:bg-white/5 hover:text-white"
    }`;

  return (
    <div className="min-h-screen bg-[#313338] text-white">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-white/10 bg-[#2b2d31] lg:flex lg:flex-col">
        <div className="border-b border-white/10 px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-300">
            CampusConnect
          </p>

          <h2 className="mt-2 text-xl font-bold">
            {formattedRole
              ? `${formattedRole} Portal`
              : "Dashboard"}
          </h2>
        </div>

        <nav className="flex-1 space-y-2 p-4">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end !== false}
              className={
                navigationLinkClass
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="mb-4 rounded-xl bg-black/20 p-4">
            <p className="font-semibold">
              {user?.name ||
                "CampusConnect User"}
            </p>

            <p className="mt-1 truncate text-xs text-[#b5bac1]">
              {user?.email ||
                "Email unavailable"}
            </p>

            {user?.role && (
              <span className="mt-3 inline-block rounded-full bg-purple-500/10 px-3 py-1 text-xs font-semibold capitalize text-purple-200">
                {user.role}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Dashboard content */}
      <div className="lg:pl-64">
        <header className="border-b border-white/10 bg-[#2b2d31]">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">
                {title}
              </h1>

              {description && (
                <p className="mt-1 text-sm text-[#b5bac1]">
                  {description}
                </p>
              )}
            </div>

            {/* Mobile logout */}
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 lg:hidden"
            >
              Logout
            </button>
          </div>

          {/* Mobile navigation */}
          <nav className="overflow-x-auto border-t border-white/10 px-4 py-3 sm:px-6 lg:hidden">
            <div className="flex min-w-max gap-2">
              {navigation.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end !== false}
                  className={({
                    isActive,
                  }) =>
                    `rounded-xl px-4 py-2 text-sm font-semibold transition ${
                      isActive
                        ? "bg-purple-600 text-white"
                        : "bg-white/5 text-[#b5bac1] hover:bg-white/10 hover:text-white"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>
        </header>

        <main className="px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;