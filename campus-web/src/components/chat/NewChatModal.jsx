import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  FiLoader,
  FiMessageCircle,
  FiSearch,
  FiX,
} from "react-icons/fi";

import { getEligibleChatUsers } from "../../services/chatService.js";
import getErrorMessage from "../../utils/getErrorMessage.js";
import {
  getInitials,
  getUserId,
} from "../../utils/chatHelpers.js";

const NewChatModal = ({
  onClose,
  onSelectUser,
  currentUser,
  isUserOnline,
}) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] =
    useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [creatingId, setCreatingId] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    const loadUsers = async () => {
      setLoading(true);
      setError("");

      try {
        const result = await getEligibleChatUsers({
          search: debouncedSearch || undefined,
          role: roleFilter || undefined,
          limit: 30,
        });

        if (!cancelled) {
          const currentId = getUserId(currentUser);

          setUsers(
            (result.users || []).filter(
              (user) => getUserId(user) !== currentId
            )
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            getErrorMessage(
              loadError,
              "Unable to load eligible users"
            )
          );
          setUsers([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadUsers();

    return () => {
      cancelled = true;
    };
  }, [
    debouncedSearch,
    roleFilter,
    currentUser,
  ]);

  const roleOptions = useMemo(() => {
    if (currentUser?.role === "student") {
      return [
        { value: "", label: "All" },
        { value: "student", label: "Students" },
        { value: "teacher", label: "Teachers" },
      ];
    }

    if (currentUser?.role === "teacher") {
      return [
        { value: "", label: "All" },
        { value: "student", label: "Students" },
        { value: "teacher", label: "Teachers" },
      ];
    }

    return [
      { value: "", label: "All" },
      { value: "student", label: "Students" },
      { value: "teacher", label: "Teachers" },
      { value: "admin", label: "Admins" },
    ];
  }, [currentUser?.role]);

  const handleSelect = async (user) => {
    setCreatingId(getUserId(user));

    try {
      await onSelectUser(user);
    } finally {
      setCreatingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <section className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#2b2d31] shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              New chat
            </h2>
            <p className="mt-1 text-sm text-[#b5bac1]">
              Search eligible campus users
            </p>
          </div>

          <button
            type="button"
            aria-label="Close new chat"
            onClick={onClose}
            className="rounded-xl p-2 text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
          >
            <FiX className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-3 border-b border-white/10 px-5 py-4">
          <label className="relative block">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#949ba4]" />
            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search by name or email"
              className="w-full rounded-xl border border-white/10 bg-black/20 py-2.5 pl-10 pr-3 text-sm text-white outline-none transition focus:border-purple-400"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {roleOptions.map((option) => (
              <button
                key={option.value || "all"}
                type="button"
                onClick={() =>
                  setRoleFilter(option.value)
                }
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  roleFilter === option.value
                    ? "bg-purple-600 text-white"
                    : "bg-white/5 text-[#b5bac1] hover:bg-white/10 hover:text-white"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loading && (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-[#b5bac1]">
              <FiLoader className="h-4 w-4 animate-spin" />
              Loading users...
            </div>
          )}

          {!loading && error && (
            <p className="px-4 py-8 text-center text-sm text-red-300">
              {error}
            </p>
          )}

          {!loading && !error && users.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-[#b5bac1]">
              <FiMessageCircle className="h-8 w-8" />
              <p className="text-sm">
                No eligible users found
              </p>
            </div>
          )}

          {!loading &&
            !error &&
            users.map((user) => {
              const userId = getUserId(user);
              const online =
                typeof isUserOnline === "function"
                  ? isUserOnline(userId)
                  : user.isOnline;

              return (
                <button
                  key={userId}
                  type="button"
                  disabled={creatingId === userId}
                  onClick={() => handleSelect(user)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-white/5 disabled:opacity-60"
                >
                  <div className="relative">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-purple-600/30 text-sm font-bold text-purple-100">
                      {getInitials(user.name)}
                    </div>

                    {online && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#2b2d31] bg-emerald-400" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white">
                      {user.name}
                    </p>
                    <p className="truncate text-xs text-[#b5bac1]">
                      {user.role}
                      {user.department?.name
                        ? ` · ${user.department.name}`
                        : ""}
                      {user.year
                        ? ` · Year ${user.year}`
                        : ""}
                    </p>
                  </div>

                  {creatingId === userId ? (
                    <FiLoader className="h-4 w-4 animate-spin text-purple-300" />
                  ) : null}
                </button>
              );
            })}
        </div>
      </section>
    </div>
  );
};

export default NewChatModal;
