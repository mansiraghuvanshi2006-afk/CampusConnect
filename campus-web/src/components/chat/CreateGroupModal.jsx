import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  FiArrowLeft,
  FiArrowRight,
  FiCamera,
  FiCheck,
  FiLoader,
  FiSearch,
  FiShield,
  FiUsers,
  FiX,
} from "react-icons/fi";

import {
  getGroupMemberOptions,
  getGroupScopeOptions,
  getUploadAbsoluteUrl,
  uploadGroupImage,
} from "../../services/chatService.js";

import getErrorMessage from "../../utils/getErrorMessage.js";
import {
  getInitials,
  getUserId,
} from "../../utils/chatHelpers.js";

const STEPS = [
  { id: 1, label: "Details" },
  { id: 2, label: "Scope" },
  { id: 3, label: "Members" },
  { id: 4, label: "Review" },
];

const MEMBER_PAGE_SIZE = 20;

const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const roleFilters = [
  { value: "", label: "Everyone" },
  { value: "student", label: "Students" },
  { value: "teacher", label: "Teachers" },
];

const CreateGroupModal = ({
  onClose,
  onCreate,
  currentUser,
}) => {
  const isAdmin = currentUser?.role === "admin";

  const [step, setStep] = useState(1);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null);
  const [uploadingImage, setUploadingImage] =
    useState(false);

  const [type, setType] = useState(
    isAdmin ? "official_group" : "teacher_group"
  );
  const [onlyAdminsCanSend, setOnlyAdminsCanSend] =
    useState(false);

  const [scopeOptions, setScopeOptions] = useState({
    departmentLocked: false,
    departments: [],
    academicYears: [],
  });
  const [loadingScope, setLoadingScope] = useState(true);
  const [department, setDepartment] = useState("");
  const [selectedYears, setSelectedYears] = useState([]);

  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] =
    useState("");
  const [memberOptions, setMemberOptions] = useState([]);
  const [memberPage, setMemberPage] = useState(1);
  const [memberTotalPages, setMemberTotalPages] =
    useState(1);
  const [memberTotal, setMemberTotal] = useState(0);
  const [loadingMembers, setLoadingMembers] =
    useState(false);
  const [selectedMembers, setSelectedMembers] = useState(
    []
  );
  const [adminIds, setAdminIds] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmCancel, setConfirmCancel] =
    useState(false);

  const fileInputRef = useRef(null);

  const selectedIds = useMemo(
    () => selectedMembers.map((member) => getUserId(member)),
    [selectedMembers]
  );

  const hasEnteredData =
    Boolean(name.trim()) ||
    Boolean(description.trim()) ||
    Boolean(image) ||
    selectedMembers.length > 0;

  useEffect(() => {
    let cancelled = false;

    const loadScope = async () => {
      try {
        const options = await getGroupScopeOptions();

        if (cancelled) {
          return;
        }

        setScopeOptions(options);

        if (
          options.departmentLocked &&
          options.departments.length > 0
        ) {
          setDepartment(
            options.departments[0]._id ||
              options.departments[0].id ||
              ""
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            getErrorMessage(
              loadError,
              "Unable to load group options"
            )
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingScope(false);
        }
      }
    };

    void loadScope();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const departmentYears = useMemo(() => {
    if (!department) {
      return [];
    }

    return (scopeOptions.academicYears || []).filter(
      (academicYear) =>
        String(
          academicYear.department?._id ||
            academicYear.department
        ) === String(department)
    );
  }, [department, scopeOptions.academicYears]);

  const departmentName = useMemo(() => {
    const match = (scopeOptions.departments || []).find(
      (item) =>
        String(item._id || item.id) === String(department)
    );

    return match?.name || "";
  }, [department, scopeOptions.departments]);

  const memberFilters = useMemo(
    () => ({
      ...(department ? { departmentId: department } : {}),
      ...(selectedYears.length > 0
        ? { yearNumbers: selectedYears.join(",") }
        : {}),
      ...(roleFilter ? { role: roleFilter } : {}),
      ...(debouncedSearch
        ? { search: debouncedSearch }
        : {}),
    }),
    [department, selectedYears, roleFilter, debouncedSearch]
  );

  const applyMemberResult = (result, page) => {
    setMemberOptions((previous) =>
      page === 1
        ? result.users || []
        : [...previous, ...(result.users || [])]
    );
    setMemberPage(result.pagination?.page || page);
    setMemberTotalPages(
      result.pagination?.totalPages || 1
    );
    setMemberTotal(result.pagination?.total || 0);
  };

  useEffect(() => {
    if (step !== 3) {
      return undefined;
    }

    let cancelled = false;

    const loadFirstPage = async () => {
      setLoadingMembers(true);
      setError("");

      try {
        const result = await getGroupMemberOptions({
          ...memberFilters,
          page: 1,
          limit: MEMBER_PAGE_SIZE,
        });

        if (!cancelled) {
          applyMemberResult(result, 1);
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
          setLoadingMembers(false);
        }
      }
    };

    void loadFirstPage();

    return () => {
      cancelled = true;
    };
  }, [step, memberFilters]);

  const loadMoreMembers = async () => {
    const nextPage = memberPage + 1;

    setLoadingMembers(true);

    try {
      const result = await getGroupMemberOptions({
        ...memberFilters,
        page: nextPage,
        limit: MEMBER_PAGE_SIZE,
      });

      applyMemberResult(result, nextPage);
    } catch (loadError) {
      setError(
        getErrorMessage(
          loadError,
          "Unable to load eligible members"
        )
      );
    } finally {
      setLoadingMembers(false);
    }
  };

  const toggleYear = (yearNumber) => {
    setSelectedYears((previous) =>
      previous.includes(yearNumber)
        ? previous.filter((year) => year !== yearNumber)
        : [...previous, yearNumber].sort(
            (first, second) => first - second
          )
    );
  };

  const toggleMember = (user) => {
    const userId = getUserId(user);

    setSelectedMembers((previous) =>
      previous.some(
        (member) => getUserId(member) === userId
      )
        ? previous.filter(
            (member) => getUserId(member) !== userId
          )
        : [...previous, user]
    );

    setAdminIds((previous) =>
      previous.filter((id) => id !== userId)
    );
  };

  const toggleGroupAdmin = (user) => {
    const userId = getUserId(user);

    if (user.role !== "teacher") {
      return;
    }

    setAdminIds((previous) =>
      previous.includes(userId)
        ? previous.filter((id) => id !== userId)
        : [...previous, userId]
    );
  };

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Group image must be an image file");
      return;
    }

    if (file.size > IMAGE_MAX_BYTES) {
      setError("Group image cannot exceed 5 MB");
      return;
    }

    setUploadingImage(true);
    setError("");

    try {
      const uploadedUrl = await uploadGroupImage(file);

      setImage(uploadedUrl);
    } catch (uploadError) {
      setError(
        getErrorMessage(
          uploadError,
          "Unable to upload the group image"
        )
      );
    } finally {
      setUploadingImage(false);
    }
  };

  const stepError = () => {
    if (step === 1) {
      if (name.trim().length < 2) {
        return "Group name must contain at least 2 characters";
      }
    }

    if (step === 2 && !isAdmin && !department) {
      return "Your department is required to create a group";
    }

    return "";
  };

  const goNext = () => {
    const message = stepError();

    if (message) {
      setError(message);
      return;
    }

    setError("");
    setStep((previous) => Math.min(4, previous + 1));
  };

  const goBack = () => {
    setError("");
    setStep((previous) => Math.max(1, previous - 1));
  };

  const handleRequestClose = () => {
    if (submitting) {
      return;
    }

    if (hasEnteredData) {
      setConfirmCancel(true);
      return;
    }

    onClose?.();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (step !== 4) {
      goNext();
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await onCreate({
        name: name.trim(),
        description: description.trim() || null,
        type: isAdmin ? type : "teacher_group",
        department: department || null,
        academicYears: selectedYears,
        memberIds: selectedIds,
        adminIds,
        image: image || null,
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
    }
  };

  const canLoadMore = memberPage < memberTotalPages;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 sm:items-center sm:px-4 sm:py-6">
      <section className="flex h-full w-full flex-col overflow-hidden border-white/10 bg-[#2b2d31] shadow-2xl sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-2xl sm:border">
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-xl bg-purple-600/20 p-2 text-purple-200">
              <FiUsers className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-white">
                Create group
              </h2>

              <p className="mt-0.5 truncate text-sm text-[#b5bac1]">
                Step {step} of {STEPS.length} ·{" "}
                {STEPS[step - 1].label}
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close create group"
            onClick={handleRequestClose}
            className="rounded-xl p-2 text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
          >
            <FiX className="h-5 w-5" />
          </button>
        </header>

        <div className="flex gap-1.5 border-b border-white/10 px-4 py-3 sm:px-5">
          {STEPS.map((item) => (
            <span
              key={item.id}
              className={`h-1.5 flex-1 rounded-full transition ${
                item.id <= step
                  ? "bg-purple-500"
                  : "bg-white/10"
              }`}
            />
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
            {step === 1 && (
              <>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                    disabled={uploadingImage}
                    className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-black/30 text-[#b5bac1] transition hover:bg-white/5 disabled:opacity-60"
                  >
                    {image ? (
                      <img
                        src={getUploadAbsoluteUrl(image)}
                        alt="Group"
                        className="h-full w-full object-cover"
                      />
                    ) : uploadingImage ? (
                      <FiLoader className="h-6 w-6 animate-spin" />
                    ) : (
                      <FiCamera className="h-6 w-6" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      Group image
                    </p>

                    <p className="mt-1 text-xs text-[#949ba4]">
                      Optional. JPG, PNG, WebP or GIF up to
                      5 MB.
                    </p>

                    {image && (
                      <button
                        type="button"
                        onClick={() => setImage(null)}
                        className="mt-2 text-xs font-semibold text-red-300 transition hover:text-red-200"
                      >
                        Remove image
                      </button>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </div>

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

                          if (
                            option.value === "announcement"
                          ) {
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
                    rows={3}
                    className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-purple-400"
                    placeholder="Optional description"
                  />

                  <span className="mt-1 block text-right text-xs text-[#949ba4]">
                    {description.length}/500
                  </span>
                </label>

                {isAdmin && (
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
              </>
            )}

            {step === 2 && (
              <>
                {loadingScope ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#b5bac1]">
                    <FiLoader className="h-4 w-4 animate-spin" />
                    Loading departments...
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="mb-1.5 text-sm font-semibold text-[#b5bac1]">
                        Department
                      </p>

                      {scopeOptions.departmentLocked ? (
                        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white">
                          {departmentName ||
                            "Your department"}

                          <span className="mt-1 block text-xs text-[#949ba4]">
                            Teachers can only create groups
                            for their own department.
                          </span>
                        </div>
                      ) : (
                        <select
                          value={department}
                          onChange={(event) => {
                            setDepartment(
                              event.target.value
                            );
                            setSelectedYears([]);
                            setSelectedMembers([]);
                            setAdminIds([]);
                          }}
                          className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-purple-400"
                        >
                          <option
                            value=""
                            className="bg-[#1e1f22]"
                          >
                            All departments
                          </option>

                          {scopeOptions.departments.map(
                            (item) => (
                              <option
                                key={item._id || item.id}
                                value={item._id || item.id}
                                className="bg-[#1e1f22]"
                              >
                                {item.name}
                              </option>
                            )
                          )}
                        </select>
                      )}
                    </div>

                    <div>
                      <p className="mb-2 text-sm font-semibold text-[#b5bac1]">
                        Academic years
                      </p>

                      {!department && (
                        <p className="text-xs text-[#949ba4]">
                          Select a department to scope the
                          group to specific years.
                        </p>
                      )}

                      {department &&
                        departmentYears.length === 0 && (
                          <p className="text-xs text-yellow-200">
                            No active academic years are
                            available for this department.
                          </p>
                        )}

                      <div className="flex flex-wrap gap-2">
                        {departmentYears.map(
                          (academicYear) => {
                            const yearNumber = Number(
                              academicYear.yearNumber
                            );

                            return (
                              <button
                                key={
                                  academicYear._id ||
                                  academicYear.id
                                }
                                type="button"
                                onClick={() =>
                                  toggleYear(yearNumber)
                                }
                                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                                  selectedYears.includes(
                                    yearNumber
                                  )
                                    ? "bg-purple-600 text-white"
                                    : "bg-white/5 text-[#b5bac1] hover:bg-white/10"
                                }`}
                              >
                                {academicYear.name ||
                                  `Year ${yearNumber}`}
                              </button>
                            );
                          }
                        )}
                      </div>

                      <p className="mt-3 text-xs text-[#949ba4]">
                        Members are limited to the selected
                        department and years.
                      </p>
                    </div>
                  </>
                )}
              </>
            )}

            {step === 3 && (
              <>
                <div className="flex flex-wrap gap-2">
                  {roleFilters.map((option) => (
                    <button
                      key={option.value || "all"}
                      type="button"
                      onClick={() => {
                        setRoleFilter(option.value);
                        setMemberPage(1);
                      }}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                        roleFilter === option.value
                          ? "bg-purple-600 text-white"
                          : "bg-white/5 text-[#b5bac1] hover:bg-white/10"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <label className="relative block">
                  <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#949ba4]" />

                  <input
                    type="search"
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Search by name or email"
                    className="w-full rounded-xl border border-white/10 bg-black/20 py-2.5 pl-10 pr-3 text-sm text-white outline-none focus:border-purple-400"
                  />
                </label>

                {selectedMembers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedMembers.map((member) => {
                      const memberId = getUserId(member);

                      return (
                        <span
                          key={memberId}
                          className="flex max-w-full items-center gap-1.5 rounded-full bg-purple-600/20 px-3 py-1 text-xs font-semibold text-purple-100"
                        >
                          <span className="truncate">
                            {member.name}
                          </span>

                          {adminIds.includes(memberId) && (
                            <FiShield className="h-3 w-3 shrink-0" />
                          )}

                          <button
                            type="button"
                            aria-label={`Remove ${member.name}`}
                            onClick={() =>
                              toggleMember(member)
                            }
                            className="shrink-0 rounded-full p-0.5 transition hover:bg-white/10"
                          >
                            <FiX className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="overflow-hidden rounded-xl border border-white/10">
                  {memberOptions.map((user) => {
                    const userId = getUserId(user);
                    const selected =
                      selectedIds.includes(userId);
                    const isGroupAdmin =
                      adminIds.includes(userId);

                    return (
                      <div
                        key={userId}
                        className="flex items-center gap-3 border-b border-white/5 px-3 py-2.5 last:border-b-0"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            toggleMember(user)
                          }
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-600/30 text-xs font-bold text-purple-100">
                            {getInitials(user.name)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-white">
                              {user.name}
                            </p>

                            <p className="truncate text-xs text-[#b5bac1]">
                              {user.role === "teacher"
                                ? "Teacher"
                                : `Year ${user.year ?? "-"}`}
                              {user.department?.name
                                ? ` · ${user.department.name}`
                                : ""}
                            </p>
                          </div>

                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                              selected
                                ? "border-purple-400 bg-purple-600 text-white"
                                : "border-white/20 text-transparent"
                            }`}
                          >
                            <FiCheck className="h-3.5 w-3.5" />
                          </span>
                        </button>

                        {selected &&
                          user.role === "teacher" && (
                            <button
                              type="button"
                              onClick={() =>
                                toggleGroupAdmin(user)
                              }
                              title="Toggle group admin"
                              className={`shrink-0 rounded-lg p-2 transition ${
                                isGroupAdmin
                                  ? "bg-purple-600 text-white"
                                  : "bg-white/5 text-[#b5bac1] hover:bg-white/10"
                              }`}
                            >
                              <FiShield className="h-3.5 w-3.5" />
                            </button>
                          )}
                      </div>
                    );
                  })}

                  {loadingMembers && (
                    <div className="flex items-center justify-center gap-2 py-8 text-sm text-[#b5bac1]">
                      <FiLoader className="h-4 w-4 animate-spin" />
                      Loading...
                    </div>
                  )}

                  {!loadingMembers &&
                    memberOptions.length === 0 && (
                      <p className="px-4 py-8 text-center text-sm text-[#b5bac1]">
                        No eligible members match this
                        search
                      </p>
                    )}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-[#949ba4]">
                    {selectedMembers.length} of{" "}
                    {memberTotal} eligible selected
                  </p>

                  {canLoadMore && (
                    <button
                      type="button"
                      onClick={loadMoreMembers}
                      disabled={loadingMembers}
                      className="rounded-xl bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#b5bac1] transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                    >
                      Load more
                    </button>
                  )}
                </div>

                <p className="text-xs text-[#949ba4]">
                  Use the shield button to make a teacher a
                  group admin. Students cannot be group
                  admins.
                </p>
              </>
            )}

            {step === 4 && (
              <div className="space-y-3">
                <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-purple-600/30 text-sm font-bold text-purple-100">
                    {image ? (
                      <img
                        src={getUploadAbsoluteUrl(image)}
                        alt="Group"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      getInitials(name || "Group")
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">
                      {name.trim() || "Untitled group"}
                    </p>

                    <p className="mt-1 line-clamp-2 text-xs text-[#b5bac1]">
                      {description.trim() ||
                        "No description"}
                    </p>
                  </div>
                </div>

                <dl className="divide-y divide-white/5 rounded-xl border border-white/10">
                  {[
                    {
                      label: "Department",
                      value:
                        departmentName ||
                        "All departments",
                    },
                    {
                      label: "Academic years",
                      value:
                        selectedYears.length > 0
                          ? selectedYears
                              .map(
                                (year) => `Year ${year}`
                              )
                              .join(", ")
                          : "All years",
                    },
                    {
                      label: "Members",
                      value: `${selectedMembers.length + 1} including you`,
                    },
                    {
                      label: "Group admins",
                      value:
                        adminIds.length > 0
                          ? selectedMembers
                              .filter((member) =>
                                adminIds.includes(
                                  getUserId(member)
                                )
                              )
                              .map((member) => member.name)
                              .join(", ")
                          : "Only you",
                    },
                    {
                      label: "Messaging",
                      value:
                        type === "announcement" ||
                        onlyAdminsCanSend
                          ? "Only admins can send messages"
                          : "Everyone can send messages",
                    },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="flex items-start justify-between gap-4 px-4 py-3"
                    >
                      <dt className="text-xs font-semibold uppercase tracking-wide text-[#949ba4]">
                        {row.label}
                      </dt>

                      <dd className="min-w-0 text-right text-sm text-white">
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {error && (
              <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-4 sm:px-5">
            <button
              type="button"
              onClick={
                step === 1 ? handleRequestClose : goBack
              }
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-[#b5bac1] transition hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              {step === 1 ? (
                "Cancel"
              ) : (
                <>
                  <FiArrowLeft className="h-4 w-4" />
                  Back
                </>
              )}
            </button>

            {step < STEPS.length ? (
              <button
                type="button"
                onClick={goNext}
                disabled={loadingScope && step === 2}
                className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:opacity-50"
              >
                Next
                <FiArrowRight className="h-4 w-4" />
              </button>
            ) : (
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
            )}
          </footer>
        </form>
      </section>

      {confirmCancel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1e1f22] p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white">
              Discard this group?
            </h3>

            <p className="mt-2 text-sm text-[#b5bac1]">
              Your group details and selected members will
              be lost.
            </p>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmCancel(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
              >
                Keep editing
              </button>

              <button
                type="button"
                onClick={() => onClose?.()}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateGroupModal;
