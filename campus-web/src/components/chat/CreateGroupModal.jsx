import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  FiCheck,
  FiLoader,
  FiSearch,
  FiUsers,
  FiX,
} from "react-icons/fi";

import { getEligibleChatUsers } from "../../services/chatService.js";
import getErrorMessage from "../../utils/getErrorMessage.js";
import {
  getInitials,
  getUserId,
} from "../../utils/chatHelpers.js";

const CreateGroupModal = ({
  onClose,
  onCreate,
  currentUser,
}) => {
  const isAdmin = currentUser?.role === "admin";
  const isTeacher = currentUser?.role === "teacher";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState(
    isAdmin ? "official_group" : "teacher_group"
  );
  const [selectedYears, setSelectedYears] = useState([]);
  const [onlyAdminsCanSend, setOnlyAdminsCanSend] =
    useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] =
    useState("");
  const [users, setUsers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const availableYears = useMemo(() => {
    if (isTeacher) {
      return currentUser?.teachingYears || [];
    }

    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  }, [currentUser?.teachingYears, isTeacher]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    const loadUsers = async () => {
      setLoadingUsers(true);
      setError("");

      try {
        const params = {
          search: debouncedSearch || undefined,
          limit: 40,
        };

        if (isTeacher || isAdmin) {
          params.role = "student";
        }

        if (selectedYears.length === 1) {
          params.year = selectedYears[0];
        }

        const result = await getEligibleChatUsers(params);

        if (!cancelled) {
          let nextUsers = result.users || [];

          if (selectedYears.length > 1) {
            nextUsers = nextUsers.filter((user) =>
              selectedYears.includes(user.year)
            );
          }

          setUsers(nextUsers);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            getErrorMessage(
              loadError,
              "Unable to load eligible members"
            )
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingUsers(false);
        }
      }
    };

    void loadUsers();

    return () => {
      cancelled = true;
    };
  }, [
    debouncedSearch,
    selectedYears,
    isTeacher,
    isAdmin,
  ]);

  const toggleYear = (year) => {
    setSelectedYears((previous) =>
      previous.includes(year)
        ? previous.filter((item) => item !== year)
        : [...previous, year]
    );
  };

  const toggleMember = (userId) => {
    setSelectedIds((previous) =>
      previous.includes(userId)
        ? previous.filter((item) => item !== userId)
        : [...previous, userId]
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!name.trim()) {
      setError("Group name is required");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await onCreate({
        name: name.trim(),
        description: description.trim() || null,
        type: isAdmin ? type : "teacher_group",
        academicYears: selectedYears,
        memberIds: selectedIds,
        onlyAdminsCanSend:
          type === "announcement"
            ? true
            : onlyAdminsCanSend,
      });
    } catch (submitError) {
      setError(
        getErrorMessage(
          submitError,
          "Unable to create group"
        )
      );
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <section className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#2b2d31] shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-purple-600/20 p-2 text-purple-200">
              <FiUsers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Create group
              </h2>
              <p className="mt-1 text-sm text-[#b5bac1]">
                {isAdmin
                  ? "Create an official campus group"
                  : "Create a work-related teacher group"}
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close create group"
            onClick={onClose}
            className="rounded-xl p-2 text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
          >
            <FiX className="h-5 w-5" />
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="space-y-4 overflow-y-auto px-5 py-4">
            {isAdmin && (
              <div className="flex flex-wrap gap-2">
                {[
                  {
                    value: "official_group",
                    label: "Official group",
                  },
                  {
                    value: "announcement",
                    label: "Announcement",
                  },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setType(option.value);
                      if (option.value === "announcement") {
                        setOnlyAdminsCanSend(true);
                      }
                    }}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                      type === option.value
                        ? "bg-purple-600 text-white"
                        : "bg-white/5 text-[#b5bac1] hover:bg-white/10"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-[#b5bac1]">
                Group name
              </span>
              <input
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                maxLength={120}
                required
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-purple-400"
                placeholder="Enter group name"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-[#b5bac1]">
                Description
              </span>
              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                maxLength={500}
                rows={2}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-purple-400"
                placeholder="Optional description"
              />
            </label>

            <div>
              <p className="mb-2 text-sm font-semibold text-[#b5bac1]">
                Academic years
              </p>
              <div className="flex flex-wrap gap-2">
                {availableYears.map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => toggleYear(year)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                      selectedYears.includes(year)
                        ? "bg-purple-600 text-white"
                        : "bg-white/5 text-[#b5bac1] hover:bg-white/10"
                    }`}
                  >
                    Year {year}
                  </button>
                ))}
              </div>
            </div>

            {(isAdmin || type === "announcement") && (
              <label className="flex items-center gap-2 text-sm text-[#b5bac1]">
                <input
                  type="checkbox"
                  checked={onlyAdminsCanSend}
                  onChange={(event) =>
                    setOnlyAdminsCanSend(
                      event.target.checked
                    )
                  }
                  className="rounded border-white/20"
                />
                Only admins can send messages
              </label>
            )}

            <div>
              <p className="mb-2 text-sm font-semibold text-[#b5bac1]">
                Add members
              </p>

              <label className="relative mb-3 block">
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#949ba4]" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search eligible students"
                  className="w-full rounded-xl border border-white/10 bg-black/20 py-2.5 pl-10 pr-3 text-sm text-white outline-none focus:border-purple-400"
                />
              </label>

              <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10">
                {loadingUsers && (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-[#b5bac1]">
                    <FiLoader className="h-4 w-4 animate-spin" />
                    Loading...
                  </div>
                )}

                {!loadingUsers && users.length === 0 && (
                  <p className="px-4 py-8 text-center text-sm text-[#b5bac1]">
                    No eligible students found
                  </p>
                )}

                {!loadingUsers &&
                  users.map((user) => {
                    const userId = getUserId(user);
                    const selected =
                      selectedIds.includes(userId);

                    return (
                      <button
                        key={userId}
                        type="button"
                        onClick={() => toggleMember(userId)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-white/5"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-600/30 text-xs font-bold text-purple-100">
                          {getInitials(user.name)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">
                            {user.name}
                          </p>
                          <p className="truncate text-xs text-[#b5bac1]">
                            Year {user.year}
                            {user.department?.name
                              ? ` · ${user.department.name}`
                              : ""}
                          </p>
                        </div>

                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                            selected
                              ? "border-purple-400 bg-purple-600 text-white"
                              : "border-white/20 text-transparent"
                          }`}
                        >
                          <FiCheck className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    );
                  })}
              </div>

              <p className="mt-2 text-xs text-[#949ba4]">
                {selectedIds.length} member
                {selectedIds.length === 1 ? "" : "s"} selected
              </p>
            </div>

            {error && (
              <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}
          </div>

          <footer className="flex items-center justify-end gap-3 border-t border-white/10 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:opacity-50"
            >
              {submitting ? (
                <FiLoader className="h-4 w-4 animate-spin" />
              ) : (
                <FiUsers className="h-4 w-4" />
              )}
              Create group
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
};

export default CreateGroupModal;
