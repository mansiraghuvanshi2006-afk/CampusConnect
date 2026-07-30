import {
    useCallback,
    useEffect,
    useMemo,
    useState,
  } from "react";
  
  import {
    useNavigate,
    useSearchParams,
  } from "react-router-dom";
  
  import toast from "react-hot-toast";
  
  import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
  import CreateUserModal from "../../components/admin/CreateUserModal.jsx";
  import PasswordInput from "../../components/common/PasswordInput.jsx";
  
  import {
    approveTeacher,
    deleteUserPermanently,
    getAllUsers,
    rejectTeacher,
    resetUserPassword,
    updateAdminUser,
    updateUserStatus,
  } from "../../services/adminService.js";

  import {
    getDepartments,
  } from "../../services/departmentService.js";

  import {
    getAcademicYears,
  } from "../../services/academicYearService.js";
  
  import getErrorMessage from "../../utils/getErrorMessage.js";
  
  const validTypes = [
    "all",
    "students",
    "teachers",
    "admins",
    "pending-teachers",
    "active",
    "inactive",
  ];
  
  const typeDetails = {
    all: {
      title: "All Users",
      description:
        "View and manage every registered CampusConnect user.",
    },
  
    students: {
      title: "Students",
      description:
        "View and manage registered student accounts.",
    },
  
    teachers: {
      title: "Teachers",
      description:
        "View and manage registered teacher accounts.",
    },
  
    admins: {
      title: "Administrators",
      description:
        "View and manage platform administrator accounts.",
    },
  
    "pending-teachers": {
      title: "Pending Teachers",
      description:
        "Review teacher accounts waiting for approval.",
    },
  
    active: {
      title: "Active Users",
      description:
        "View and manage users whose accounts are active.",
    },
  
    inactive: {
      title: "Inactive Users",
      description:
        "View and manage users whose accounts are inactive.",
    },
  };
  
  const initialEditForm = {
    name: "",
    email: "",
    role: "student",
    department: "",
    year: "",
    teachingYears: "",
  };
  
  const getUserId = (user) =>
    user?._id || user?.id || "";
  
  const getDepartmentId = (department) => {
    if (!department) {
      return "";
    }
  
    if (typeof department === "string") {
      return department;
    }
  
    return department._id || department.id || "";
  };
  
  /**
   * The API returns a populated department object, so the
   * label falls back to the code or a placeholder.
   */
  const getDepartmentLabel = (department) => {
    if (!department) {
      return "Not assigned";
    }
  
    if (typeof department === "string") {
      return "Assigned";
    }
  
    return (
      department.name ||
      department.code ||
      "Assigned"
    );
  };
  
  const getApprovalStatus = (user) =>
    user?.teacherApprovalStatus ||
    user?.approvalStatus ||
    "";
  
  const formatDate = (date) => {
    if (!date) {
      return "Unknown";
    }
  
    const parsedDate = new Date(date);
  
    if (
      Number.isNaN(parsedDate.getTime())
    ) {
      return "Unknown";
    }
  
    return parsedDate.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };
  
  const getStatusBadgeClasses = (
    isActive
  ) => {
    if (isActive) {
      return "border-green-500/30 bg-green-500/10 text-green-200";
    }
  
    return "border-red-500/30 bg-red-500/10 text-red-200";
  };
  
  const getApprovalBadgeClasses = (
    status
  ) => {
    switch (status) {
      case "approved":
        return "border-green-500/30 bg-green-500/10 text-green-200";
  
      case "rejected":
        return "border-red-500/30 bg-red-500/10 text-red-200";
  
      default:
        return "border-yellow-500/30 bg-yellow-500/10 text-yellow-200";
    }
  };
  
  const AdminUsersPage = () => {
    const navigate = useNavigate();
  
    const [
      searchParams,
      setSearchParams,
    ] = useSearchParams();
  
    const requestedType =
      searchParams.get("type") || "all";
  
    const type = validTypes.includes(
      requestedType
    )
      ? requestedType
      : "all";
  
    const currentPage = Math.max(
      Number(
        searchParams.get("page")
      ) || 1,
      1
    );
  
    const currentSearch =
      searchParams.get("search") || "";
  
    const currentRole =
      searchParams.get("role") || "";
  
    const currentDepartment =
      searchParams.get("department") || "";
  
    const currentYear =
      searchParams.get("year") || "";
  
    const pageDetails =
      typeDetails[type] ||
      typeDetails.all;
  
    const [users, setUsers] =
      useState([]);
  
    const [pagination, setPagination] =
      useState({
        page: 1,
        totalPages: 1,
        totalUsers: 0,
        limit: 10,
      });
  
    const [searchInput, setSearchInput] =
      useState(currentSearch);
  
    const [isLoading, setIsLoading] =
      useState(true);
  
    const [error, setError] =
      useState("");
  
    const [
      processingUserId,
      setProcessingUserId,
    ] = useState(null);
  
    const [
      editingUser,
      setEditingUser,
    ] = useState(null);
  
    const [editForm, setEditForm] =
      useState(initialEditForm);

    const [departments, setDepartments] =
      useState([]);

    const [availableYears, setAvailableYears] =
      useState([]);
  
    const [
      statusUser,
      setStatusUser,
    ] = useState(null);
  
    const [
      deletingUser,
      setDeletingUser,
    ] = useState(null);
  
    const [
      deleteConfirmation,
      setDeleteConfirmation,
    ] = useState("");
  
    const [
      rejectingTeacher,
      setRejectingTeacher,
    ] = useState(null);
  
    const [
      rejectionReason,
      setRejectionReason,
    ] = useState("");
  
    const [
      isCreateModalOpen,
      setIsCreateModalOpen,
    ] = useState(false);
  
    const [
      resettingUser,
      setResettingUser,
    ] = useState(null);
  
    const [
      resetPassword,
      setResetPassword,
    ] = useState("");
  
    const [
      filterYears,
      setFilterYears,
    ] = useState([]);
  
    const loadUsers = useCallback(
      async () => {
        try {
          setIsLoading(true);
          setError("");
  
          const data =
            await getAllUsers({
              type,
              search: currentSearch,
              role: currentRole,
              department: currentDepartment,
              year: currentYear,
              page: currentPage,
              limit: 10,
            });
  
          const receivedUsers =
            data?.users ||
            data?.results ||
            data?.items ||
            (Array.isArray(data)
              ? data
              : []);
  
          const receivedPagination =
            data?.pagination || {};
  
          const totalUsers =
            receivedPagination.totalUsers ??
            receivedPagination.total ??
            data?.totalUsers ??
            data?.total ??
            receivedUsers.length;
  
          const totalPages =
            receivedPagination.totalPages ??
            data?.totalPages ??
            Math.max(
              Math.ceil(totalUsers / 10),
              1
            );
  
          const page =
            receivedPagination.page ??
            data?.page ??
            currentPage;
  
          const limit =
            receivedPagination.limit ??
            data?.limit ??
            10;
  
          setUsers(receivedUsers);
  
          setPagination({
            page,
            totalPages,
            totalUsers,
            limit,
          });
        } catch (error) {
          const message =
            getErrorMessage(
              error,
              "Unable to load users"
            );
  
          setError(message);
          toast.error(message);
        } finally {
          setIsLoading(false);
        }
      },
      [
        type,
        currentSearch,
        currentRole,
        currentDepartment,
        currentYear,
        currentPage,
      ]
    );
  
    useEffect(() => {
      const timeoutId = window.setTimeout(
        loadUsers,
        0
      );

      return () => window.clearTimeout(timeoutId);
    }, [loadUsers]);
  
    useEffect(() => {
      const timeoutId = window.setTimeout(
        () => setSearchInput(currentSearch),
        0
      );

      return () => window.clearTimeout(timeoutId);
    }, [currentSearch]);

    useEffect(() => {
      const loadDepartmentOptions = async () => {
        try {
          const data = await getDepartments({
            status: "all",
            limit: 100,
          });

          setDepartments(
            Array.isArray(data?.departments)
              ? data.departments
              : []
          );
        } catch (error) {
          toast.error(
            getErrorMessage(error, "Unable to load departments"),
            { id: "admin-user-departments" }
          );
        }
      };

      const timeoutId = window.setTimeout(
        loadDepartmentOptions,
        0
      );

      return () => window.clearTimeout(timeoutId);
    }, []);

    const loadAvailableYears = async (departmentId) => {
      if (!departmentId) {
        setAvailableYears([]);
        return;
      }

      try {
        const response = await getAcademicYears(departmentId);
        setAvailableYears(
          Array.isArray(response?.data?.academicYears)
            ? response.data.academicYears
            : []
        );
      } catch (error) {
        setAvailableYears([]);
        toast.error(
          getErrorMessage(error, "Unable to load academic years"),
          { id: "admin-user-years" }
        );
      }
    };
  
    /**
     * Academic-year options for the department filter.
     */
    useEffect(() => {
      let isCancelled = false;
  
      const loadFilterYears = async () => {
        if (!currentDepartment) {
          setFilterYears([]);
  
          return;
        }
  
        try {
          const response = await getAcademicYears(
            currentDepartment
          );
  
          if (isCancelled) {
            return;
          }
  
          setFilterYears(
            Array.isArray(response?.data?.academicYears)
              ? response.data.academicYears
              : []
          );
        } catch {
          if (!isCancelled) {
            setFilterYears([]);
          }
        }
      };
  
      void loadFilterYears();
  
      return () => {
        isCancelled = true;
      };
    }, [currentDepartment]);
  
    const updateParams = (
      updates
    ) => {
      const newParams =
        new URLSearchParams(
          searchParams
        );
  
      Object.entries(updates).forEach(
        ([key, value]) => {
          if (
            value === undefined ||
            value === null ||
            value === ""
          ) {
            newParams.delete(key);
          } else {
            newParams.set(
              key,
              String(value)
            );
          }
        }
      );
  
      setSearchParams(newParams);
    };
  
    const handleTypeChange = (
      event
    ) => {
      updateParams({
        type: event.target.value,
        page: 1,
      });
    };
  
    const handleRoleFilterChange = (event) => {
      updateParams({
        role: event.target.value,
        page: 1,
      });
    };
  
    const handleDepartmentFilterChange = (event) => {
      updateParams({
        department: event.target.value,
        year: "",
        page: 1,
      });
    };
  
    const handleYearFilterChange = (event) => {
      updateParams({
        year: event.target.value,
        page: 1,
      });
    };
  
    const clearFilters = () => {
      setSearchInput("");
  
      updateParams({
        search: "",
        role: "",
        department: "",
        year: "",
        page: 1,
      });
    };
  
    const handleSearch = (event) => {
      event.preventDefault();
  
      updateParams({
        search: searchInput.trim(),
        page: 1,
      });
    };
  
    const clearSearch = () => {
      setSearchInput("");
  
      updateParams({
        search: "",
        page: 1,
      });
    };
  
    const handlePageChange = (
      page
    ) => {
      if (
        page < 1 ||
        page >
          pagination.totalPages ||
        page === currentPage
      ) {
        return;
      }
  
      updateParams({
        page,
      });
    };
  
    const openEditModal = (user) => {
      const departmentId = getDepartmentId(
        user?.department
      );

      setEditingUser(user);
  
      setEditForm({
        name: user?.name || "",
        email: user?.email || "",
        role:
          user?.role || "student",
        department: departmentId,
        year:
          user?.year !== undefined &&
          user?.year !== null
            ? String(user.year)
            : "",
        teachingYears:
          Array.isArray(
            user?.teachingYears
          )
            ? user.teachingYears.join(
                ", "
              )
            : "",
      });

      void loadAvailableYears(departmentId);
    };
  
    const closeEditModal = () => {
      if (processingUserId) {
        return;
      }
  
      setEditingUser(null);
      setEditForm(initialEditForm);
    };
  
    const handleEditChange = (
      event
    ) => {
      const { name, value } =
        event.target;
  
      setEditForm((previous) => ({
        ...previous,
        [name]: value,
      }));
    };

    const handleDepartmentChange = (event) => {
      const departmentId = event.target.value;

      setEditForm((previous) => ({
        ...previous,
        department: departmentId,
        year: "",
        teachingYears: "",
      }));

      void loadAvailableYears(departmentId);
    };

    const handleTeachingYearChange = (yearNumber) => {
      setEditForm((previous) => {
        const selectedYears = previous.teachingYears
          .split(",")
          .map((value) => Number(value.trim()))
          .filter(Number.isInteger);

        const nextYears = selectedYears.includes(yearNumber)
          ? selectedYears.filter((year) => year !== yearNumber)
          : [...selectedYears, yearNumber];

        return {
          ...previous,
          teachingYears: nextYears
            .sort((first, second) => first - second)
            .join(", "),
        };
      });
    };
  
    const handleUpdateUser = async (
      event
    ) => {
      event.preventDefault();
  
      const userId =
        getUserId(editingUser);
  
      if (!userId) {
        toast.error(
          "User ID is unavailable"
        );
  
        return;
      }
  
      const name =
        editForm.name.trim();
  
      const email =
        editForm.email
          .trim()
          .toLowerCase();
  
      const department =
        editForm.department.trim();
  
      if (name.length < 2) {
        toast.error(
          "Name must contain at least 2 characters"
        );
  
        return;
      }
  
      if (!email) {
        toast.error(
          "Email is required"
        );
  
        return;
      }
  
      const payload = {
        name,
        email,
        role: editForm.role,
        department:
          editForm.role === "admin"
            ? null
            : department || null,
      };
  
      if (editForm.role === "admin") {
        payload.year = null;
        payload.teachingYears = [];
      }
  
      if (
        editForm.role ===
        "student"
      ) {
        payload.year =
          editForm.year
            ? Number(editForm.year)
            : null;
  
        payload.teachingYears = [];
      }
  
      if (
        editForm.role ===
        "teacher"
      ) {
        const teachingYears =
          editForm.teachingYears
            .split(",")
            .map((value) =>
              Number(value.trim())
            )
            .filter(
              (value) =>
                Number.isInteger(
                  value
                ) && value > 0
            );
  
        payload.year = null;
        payload.teachingYears = [
          ...new Set(
            teachingYears
          ),
        ];
      }
  
      try {
        setProcessingUserId(
          userId
        );
  
        const response =
          await updateAdminUser(
            userId,
            payload
          );
  
        toast.success(
          response?.message ||
            "User updated successfully"
        );
  
        setEditingUser(null);
        setEditForm(
          initialEditForm
        );
  
        await loadUsers();
      } catch (error) {
        toast.error(
          getErrorMessage(
            error,
            "Unable to update user"
          )
        );
      } finally {
        setProcessingUserId(null);
      }
    };
  
    const openResetPasswordModal = (user) => {
      setResettingUser(user);
      setResetPassword("");
    };
  
    const closeResetPasswordModal = () => {
      if (processingUserId) {
        return;
      }
  
      setResettingUser(null);
      setResetPassword("");
    };
  
    const handleResetPassword = async (event) => {
      event.preventDefault();
  
      const userId = getUserId(resettingUser);
  
      if (!userId) {
        toast.error("User ID is unavailable");
  
        return;
      }
  
      if (
        resetPassword.length < 8 ||
        !/[a-z]/.test(resetPassword) ||
        !/[A-Z]/.test(resetPassword) ||
        !/[0-9]/.test(resetPassword)
      ) {
        toast.error(
          "Use at least 8 characters with upper and lower case letters and a number"
        );
  
        return;
      }
  
      try {
        setProcessingUserId(userId);
  
        const response = await resetUserPassword(
          userId,
          resetPassword
        );
  
        toast.success(
          response?.message ||
            "Temporary password assigned"
        );
  
        setResettingUser(null);
        setResetPassword("");
  
        await loadUsers();
      } catch (error) {
        toast.error(
          getErrorMessage(
            error,
            "Unable to reset the password"
          )
        );
      } finally {
        setProcessingUserId(null);
      }
    };
  
    const handleUserCreated = async () => {
      setIsCreateModalOpen(false);
  
      await loadUsers();
    };
  
    const openStatusModal = (
      user
    ) => {
      setStatusUser(user);
    };
  
    const closeStatusModal = () => {
      if (processingUserId) {
        return;
      }
  
      setStatusUser(null);
    };
  
    const handleStatusChange =
      async () => {
        const userId =
          getUserId(statusUser);
  
        if (!userId) {
          toast.error(
            "User ID is unavailable"
          );
  
          return;
        }
  
        const nextStatus =
          !statusUser.isActive;
  
        try {
          setProcessingUserId(
            userId
          );
  
          const response =
            await updateUserStatus(
              userId,
              nextStatus
            );
  
          toast.success(
            response?.message ||
              `User ${
                nextStatus
                  ? "activated"
                  : "deactivated"
              } successfully`
          );
  
          setStatusUser(null);
  
          await loadUsers();
        } catch (error) {
          toast.error(
            getErrorMessage(
              error,
              "Unable to update account status"
            )
          );
        } finally {
          setProcessingUserId(
            null
          );
        }
      };
  
    const openDeleteModal = (
      user
    ) => {
      setDeletingUser(user);
      setDeleteConfirmation("");
    };
  
    const closeDeleteModal = () => {
      if (processingUserId) {
        return;
      }
  
      setDeletingUser(null);
      setDeleteConfirmation("");
    };
  
    const handleDeleteUser =
      async () => {
        const userId =
          getUserId(deletingUser);
  
        if (!userId) {
          toast.error(
            "User ID is unavailable"
          );
  
          return;
        }
  
        if (
          deleteConfirmation !==
          "DELETE"
        ) {
          toast.error(
            'Type "DELETE" to confirm permanent deletion'
          );
  
          return;
        }
  
        try {
          setProcessingUserId(
            userId
          );
  
          const response =
            await deleteUserPermanently(
              userId
            );
  
          toast.success(
            response?.message ||
              "User permanently deleted"
          );
  
          setDeletingUser(null);
          setDeleteConfirmation("");
  
          if (
            users.length === 1 &&
            currentPage > 1
          ) {
            updateParams({
              page:
                currentPage - 1,
            });
          } else {
            await loadUsers();
          }
        } catch (error) {
          toast.error(
            getErrorMessage(
              error,
              "Unable to delete user"
            )
          );
        } finally {
          setProcessingUserId(
            null
          );
        }
      };
  
    const handleApproveTeacher =
      async (user) => {
        const userId =
          getUserId(user);
  
        if (!userId) {
          toast.error(
            "Teacher ID is unavailable"
          );
  
          return;
        }
  
        try {
          setProcessingUserId(
            userId
          );
  
          const response =
            await approveTeacher(
              userId
            );
  
          toast.success(
            response?.message ||
              "Teacher approved successfully"
          );
  
          await loadUsers();
        } catch (error) {
          toast.error(
            getErrorMessage(
              error,
              "Unable to approve teacher"
            )
          );
        } finally {
          setProcessingUserId(
            null
          );
        }
      };
  
    const openRejectModal = (
      user
    ) => {
      setRejectingTeacher(user);
      setRejectionReason("");
    };
  
    const closeRejectModal = () => {
      if (processingUserId) {
        return;
      }
  
      setRejectingTeacher(null);
      setRejectionReason("");
    };
  
    const handleRejectTeacher =
      async (event) => {
        event.preventDefault();
  
        const teacherId =
          getUserId(
            rejectingTeacher
          );
  
        const reason =
          rejectionReason.trim();
  
        if (!teacherId) {
          toast.error(
            "Teacher ID is unavailable"
          );
  
          return;
        }
  
        if (reason.length < 3) {
          toast.error(
            "Rejection reason must contain at least 3 characters"
          );
  
          return;
        }
  
        try {
          setProcessingUserId(
            teacherId
          );
  
          const response =
            await rejectTeacher(
              teacherId,
              reason
            );
  
          toast.success(
            response?.message ||
              "Teacher rejected successfully"
          );
  
          setRejectingTeacher(
            null
          );
  
          setRejectionReason("");
  
          await loadUsers();
        } catch (error) {
          toast.error(
            getErrorMessage(
              error,
              "Unable to reject teacher"
            )
          );
        } finally {
          setProcessingUserId(
            null
          );
        }
      };
  
    const pageNumbers = useMemo(
      () => {
        const totalPages =
          pagination.totalPages;
  
        const start = Math.max(
          currentPage - 2,
          1
        );
  
        const end = Math.min(
          start + 4,
          totalPages
        );
  
        const adjustedStart =
          Math.max(end - 4, 1);
  
        return Array.from(
          {
            length:
              end -
              adjustedStart +
              1,
          },
          (_, index) =>
            adjustedStart + index
        );
      },
      [
        currentPage,
        pagination.totalPages,
      ]
    );
  
    const editingUserId =
      getUserId(editingUser);
  
    const statusUserId =
      getUserId(statusUser);
  
    const deletingUserId =
      getUserId(deletingUser);
  
    const rejectingTeacherId =
      getUserId(
        rejectingTeacher
      );
  
    return (
      <DashboardLayout
        title={pageDetails.title}
        description={
          pageDetails.description
        }
      >
        <section className="rounded-2xl border border-white/10 bg-[#2b2d31]">
          <div className="border-b border-white/10 p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div>
                  <label
                    htmlFor="userType"
                    className="mb-2 block text-sm font-semibold text-white"
                  >
                    User category
                  </label>
  
                  <select
                    id="userType"
                    value={type}
                    onChange={
                      handleTypeChange
                    }
                    className="min-w-52 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                  >
                    <option value="all">
                      All Users
                    </option>
  
                    <option value="students">
                      Students
                    </option>
  
                    <option value="teachers">
                      Teachers
                    </option>
  
                    <option value="admins">
                      Administrators
                    </option>
  
                    <option value="pending-teachers">
                      Pending Teachers
                    </option>
  
                    <option value="active">
                      Active Users
                    </option>
  
                    <option value="inactive">
                      Inactive Users
                    </option>
                  </select>
                </div>
  
                <button
                  type="button"
                  onClick={() =>
                    setIsCreateModalOpen(true)
                  }
                  className="rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-700"
                >
                  + Create User
                </button>
  
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/admin/dashboard"
                    )
                  }
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Back to Dashboard
                </button>
              </div>
  
              <form
                onSubmit={handleSearch}
                className="flex w-full max-w-xl flex-col gap-3 sm:flex-row"
              >
                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) =>
                    setSearchInput(
                      event.target.value
                    )
                  }
                  placeholder="Search by name or email"
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                />
  
                <button
                  type="submit"
                  className="rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-700"
                >
                  Search
                </button>
  
                {currentSearch && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Clear
                  </button>
                )}
              </form>
            </div>
  
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div>
                <label
                  htmlFor="roleFilter"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#b5bac1]"
                >
                  Role
                </label>
  
                <select
                  id="roleFilter"
                  value={currentRole}
                  onChange={handleRoleFilterChange}
                  className="min-w-44 rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                >
                  <option value="" className="bg-[#1e1f22]">
                    Any role
                  </option>
  
                  <option
                    value="student"
                    className="bg-[#1e1f22]"
                  >
                    Student
                  </option>
  
                  <option
                    value="teacher"
                    className="bg-[#1e1f22]"
                  >
                    Teacher
                  </option>
  
                  <option
                    value="admin"
                    className="bg-[#1e1f22]"
                  >
                    Admin
                  </option>
                </select>
              </div>
  
              <div>
                <label
                  htmlFor="departmentFilter"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#b5bac1]"
                >
                  Department
                </label>
  
                <select
                  id="departmentFilter"
                  value={currentDepartment}
                  onChange={
                    handleDepartmentFilterChange
                  }
                  className="min-w-52 rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                >
                  <option value="" className="bg-[#1e1f22]">
                    Any department
                  </option>
  
                  {departments.map((department) => (
                    <option
                      key={department._id || department.id}
                      value={
                        department._id || department.id
                      }
                      className="bg-[#1e1f22]"
                    >
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>
  
              <div>
                <label
                  htmlFor="yearFilter"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#b5bac1]"
                >
                  Academic year
                </label>
  
                <select
                  id="yearFilter"
                  value={currentYear}
                  onChange={handleYearFilterChange}
                  disabled={!currentDepartment}
                  className="min-w-44 rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 disabled:opacity-50"
                >
                  <option value="" className="bg-[#1e1f22]">
                    {currentDepartment
                      ? "Any year"
                      : "Select a department"}
                  </option>
  
                  {filterYears.map((academicYear) => (
                    <option
                      key={
                        academicYear._id ||
                        academicYear.id
                      }
                      value={academicYear.yearNumber}
                      className="bg-[#1e1f22]"
                    >
                      {academicYear.name}
                    </option>
                  ))}
                </select>
              </div>
  
              {(currentRole ||
                currentDepartment ||
                currentYear ||
                currentSearch) && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Reset filters
                </button>
              )}
            </div>
          </div>
  
          {isLoading && (
            <div className="p-12 text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-purple-400" />
  
              <p className="mt-4 text-sm text-[#b5bac1]">
                Loading users...
              </p>
            </div>
          )}
  
          {!isLoading && error && (
            <div className="p-6">
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5">
                <p className="font-semibold text-red-300">
                  Unable to load users
                </p>
  
                <p className="mt-1 text-sm text-red-200/80">
                  {error}
                </p>
  
                <button
                  type="button"
                  onClick={loadUsers}
                  className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Try again
                </button>
              </div>
            </div>
          )}
  
          {!isLoading &&
            !error &&
            users.length === 0 && (
              <div className="p-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-purple-500/10 text-2xl text-purple-300">
                  👤
                </div>
  
                <h2 className="mt-4 text-xl font-bold text-white">
                  No users found
                </h2>
  
                <p className="mt-2 text-sm text-[#b5bac1]">
                  No users match the
                  selected category or
                  search.
                </p>
              </div>
            )}
  
          {!isLoading &&
            !error &&
            users.length > 0 && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1180px] text-left">
                    <thead className="bg-black/20 text-xs uppercase tracking-wide text-[#b5bac1]">
                      <tr>
                        <th className="px-5 py-4">
                          User
                        </th>
  
                        <th className="px-5 py-4">
                          Role
                        </th>
  
                        <th className="px-5 py-4">
                          Department
                        </th>
  
                        <th className="px-5 py-4">
                          Year
                        </th>
  
                        <th className="px-5 py-4">
                          Verification
                        </th>
  
                        <th className="px-5 py-4">
                          Account
                        </th>
  
                        <th className="px-5 py-4">
                          Approval
                        </th>
  
                        <th className="px-5 py-4">
                          Registered
                        </th>
  
                        <th className="px-5 py-4 text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
  
                    <tbody>
                      {users.map(
                        (user) => {
                          const userId =
                            getUserId(
                              user
                            );
  
                          const approvalStatus =
                            getApprovalStatus(
                              user
                            );
  
                          const isProcessing =
                            processingUserId ===
                            userId;
  
                          const isPendingTeacher =
                            user.role ===
                              "teacher" &&
                            approvalStatus ===
                              "pending";
  
                          return (
                            <tr
                              key={userId}
                              className="border-t border-white/10 align-top"
                            >
                              <td className="px-5 py-5">
                                <p className="font-semibold text-white">
                                  {user.name ||
                                    "Unknown"}
                                </p>
  
                                <p className="mt-1 text-xs text-[#b5bac1]">
                                  {user.email ||
                                    "No email"}
                                </p>
  
                                {user.mustChangePassword && (
                                  <p className="mt-2 inline-block rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-200">
                                    Temporary password
                                  </p>
                                )}
                              </td>
  
                              <td className="px-5 py-5">
                                <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold capitalize text-purple-200">
                                  {user.role ||
                                    "Unknown"}
                                </span>
                              </td>
  
                              <td className="px-5 py-5 text-sm text-[#b5bac1]">
                                {getDepartmentLabel(
                                  user.department
                                )}
                              </td>
  
                              <td className="px-5 py-5 text-sm text-[#b5bac1]">
                                {user.role ===
                                "teacher"
                                  ? Array.isArray(
                                      user.teachingYears
                                    ) &&
                                    user
                                      .teachingYears
                                      .length >
                                      0
                                    ? user.teachingYears.join(
                                        ", "
                                      )
                                    : "Not assigned"
                                  : user.year ||
                                    "Not assigned"}
                              </td>
  
                              <td className="px-5 py-5">
                                <span
                                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                    user.isEmailVerified
                                      ? "border-green-500/30 bg-green-500/10 text-green-200"
                                      : "border-yellow-500/30 bg-yellow-500/10 text-yellow-200"
                                  }`}
                                >
                                  {user.isEmailVerified
                                    ? "Verified"
                                    : "Unverified"}
                                </span>
                              </td>
  
                              <td className="px-5 py-5">
                                <span
                                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusBadgeClasses(
                                    user.isActive
                                  )}`}
                                >
                                  {user.isActive
                                    ? "Active"
                                    : "Inactive"}
                                </span>
                              </td>
  
                              <td className="px-5 py-5">
                                {user.role ===
                                "teacher" ? (
                                  <span
                                    className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getApprovalBadgeClasses(
                                      approvalStatus
                                    )}`}
                                  >
                                    {approvalStatus ||
                                      "Pending"}
                                  </span>
                                ) : (
                                  <span className="text-sm text-[#949ba4]">
                                    Not required
                                  </span>
                                )}
                              </td>
  
                              <td className="px-5 py-5 text-sm text-[#b5bac1]">
                                {formatDate(
                                  user.createdAt
                                )}
                              </td>
  
                              <td className="px-5 py-5">
                                <div className="flex flex-wrap justify-end gap-2">
                                  {isPendingTeacher && (
                                    <>
                                      <button
                                        type="button"
                                        disabled={
                                          isProcessing
                                        }
                                        onClick={() =>
                                          handleApproveTeacher(
                                            user
                                          )
                                        }
                                        className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        Approve
                                      </button>
  
                                      <button
                                        type="button"
                                        disabled={
                                          isProcessing
                                        }
                                        onClick={() =>
                                          openRejectModal(
                                            user
                                          )
                                        }
                                        className="rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        Reject
                                      </button>
                                    </>
                                  )}
  
                                  <button
                                    type="button"
                                    disabled={
                                      isProcessing
                                    }
                                    onClick={() =>
                                      openEditModal(
                                        user
                                      )
                                    }
                                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Edit
                                  </button>
  
                                  <button
                                    type="button"
                                    disabled={
                                      isProcessing
                                    }
                                    onClick={() =>
                                      openStatusModal(
                                        user
                                      )
                                    }
                                    className={`rounded-lg px-3 py-2 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                      user.isActive
                                        ? "bg-yellow-600 hover:bg-yellow-700"
                                        : "bg-green-600 hover:bg-green-700"
                                    }`}
                                  >
                                    {user.isActive
                                      ? "Deactivate"
                                      : "Activate"}
                                  </button>
  
                                  <button
                                    type="button"
                                    disabled={
                                      isProcessing
                                    }
                                    onClick={() =>
                                      openResetPasswordModal(
                                        user
                                      )
                                    }
                                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Reset password
                                  </button>
  
                                  <button
                                    type="button"
                                    disabled={
                                      isProcessing
                                    }
                                    onClick={() =>
                                      openDeleteModal(
                                        user
                                      )
                                    }
                                    className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
  
                <div className="flex flex-col gap-4 border-t border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-[#b5bac1]">
                    Showing page{" "}
                    <span className="font-semibold text-white">
                      {pagination.page}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-white">
                      {
                        pagination.totalPages
                      }
                    </span>
                    . Total users:{" "}
                    <span className="font-semibold text-white">
                      {
                        pagination.totalUsers
                      }
                    </span>
                  </p>
  
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={
                        currentPage <= 1
                      }
                      onClick={() =>
                        handlePageChange(
                          currentPage -
                            1
                        )
                      }
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Previous
                    </button>
  
                    {pageNumbers.map(
                      (page) => (
                        <button
                          key={page}
                          type="button"
                          onClick={() =>
                            handlePageChange(
                              page
                            )
                          }
                          className={`h-9 min-w-9 rounded-lg px-3 text-sm font-semibold transition ${
                            page ===
                            currentPage
                              ? "bg-purple-600 text-white"
                              : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                          }`}
                        >
                          {page}
                        </button>
                      )
                    )}
  
                    <button
                      type="button"
                      disabled={
                        currentPage >=
                        pagination.totalPages
                      }
                      onClick={() =>
                        handlePageChange(
                          currentPage +
                            1
                        )
                      }
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
        </section>
  
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-8">
            <section className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#2b2d31] p-6 shadow-2xl">
              <h2 className="text-xl font-bold text-white">
                Edit User
              </h2>
  
              <p className="mt-2 text-sm text-[#b5bac1]">
                Update account information
                for{" "}
                <span className="font-semibold text-white">
                  {editingUser.name}
                </span>
                .
              </p>
  
              <form
                onSubmit={handleUpdateUser}
                className="mt-6 space-y-4"
              >
                <div>
                  <label
                    htmlFor="name"
                    className="mb-2 block text-sm font-semibold text-white"
                  >
                    Full name
                  </label>
  
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={editForm.name}
                    onChange={handleEditChange}
                    disabled={
                      processingUserId ===
                      editingUserId
                    }
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                  />
                </div>
  
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-semibold text-white"
                  >
                    Email
                  </label>
  
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={editForm.email}
                    onChange={
                      handleEditChange
                    }
                    disabled={
                      processingUserId ===
                      editingUserId
                    }
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                  />
                </div>
  
                <div>
                  <label
                    htmlFor="role"
                    className="mb-2 block text-sm font-semibold text-white"
                  >
                    Role
                  </label>
  
                  <select
                    id="role"
                    name="role"
                    value={editForm.role}
                    onChange={
                      handleEditChange
                    }
                    disabled={
                      processingUserId ===
                      editingUserId
                    }
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                  >
                    <option value="student">
                      Student
                    </option>
  
                    <option value="teacher">
                      Teacher
                    </option>
  
                    <option value="admin">
                      Admin
                    </option>
                  </select>
                </div>
  
                {editForm.role !== "admin" && (
                <div>
                  <label
                    htmlFor="department"
                    className="mb-2 block text-sm font-semibold text-white"
                  >
                    Department
                  </label>
  
                  <select
                    id="department"
                    name="department"
                    value={
                      editForm.department
                    }
                    onChange={
                      handleDepartmentChange
                    }
                    disabled={
                      processingUserId ===
                      editingUserId
                    }
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                  >
                    <option value="" className="bg-[#1e1f22]">
                      No department
                    </option>
                    {departments.map((department) => (
                      <option
                        key={department._id || department.id}
                        value={department._id || department.id}
                        className="bg-[#1e1f22]"
                      >
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>
                )}
  
                {editForm.role ===
                  "student" && (
                  <div>
                    <label
                      htmlFor="year"
                      className="mb-2 block text-sm font-semibold text-white"
                    >
                      Academic year
                    </label>
  
                    <select
                      id="year"
                      name="year"
                      value={
                        editForm.year
                      }
                      onChange={
                        handleEditChange
                      }
                      disabled={
                        processingUserId ===
                        editingUserId
                      }
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                    >
                      <option value="" className="bg-[#1e1f22]">
                        No academic year
                      </option>
                      {availableYears.map((academicYear) => (
                        <option
                          key={academicYear._id || academicYear.id}
                          value={academicYear.yearNumber}
                          className="bg-[#1e1f22]"
                        >
                          {academicYear.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
  
                {editForm.role ===
                  "teacher" && (
                  <div>
                    <label
                      htmlFor="teachingYears"
                      className="mb-2 block text-sm font-semibold text-white"
                    >
                      Teaching years
                    </label>
  
                    <div className="grid gap-2 sm:grid-cols-2">
                      {availableYears.map((academicYear) => {
                        const yearNumber = Number(academicYear.yearNumber);
                        const selectedYears = editForm.teachingYears
                          .split(",")
                          .map((value) => Number(value.trim()));

                        return (
                          <label
                            key={academicYear._id || academicYear.id}
                            className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3"
                          >
                            <input
                              type="checkbox"
                              checked={selectedYears.includes(yearNumber)}
                              onChange={() => handleTeachingYearChange(yearNumber)}
                              disabled={processingUserId === editingUserId}
                            />
                            <span>{academicYear.name}</span>
                          </label>
                        );
                      })}
                    </div>
  
                    <p className="mt-2 text-xs text-[#949ba4]">
                      Select only years configured for this department.
                    </p>
                  </div>
                )}
  
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={
                      closeEditModal
                    }
                    disabled={
                      processingUserId ===
                      editingUserId
                    }
                    className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
                  >
                    Cancel
                  </button>
  
                  <button
                    type="submit"
                    disabled={
                      processingUserId ===
                      editingUserId
                    }
                    className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {processingUserId ===
                    editingUserId
                      ? "Saving..."
                      : "Save Changes"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
  
        {statusUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
            <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#2b2d31] p-6 shadow-2xl">
              <h2 className="text-xl font-bold text-white">
                {statusUser.isActive
                  ? "Deactivate User"
                  : "Activate User"}
              </h2>
  
              <p className="mt-3 text-sm leading-6 text-[#b5bac1]">
                Are you sure you want to{" "}
                {statusUser.isActive
                  ? "deactivate"
                  : "activate"}{" "}
                <span className="font-semibold text-white">
                  {statusUser.name}
                </span>
                ?
              </p>
  
              {!statusUser.isActive &&
                !statusUser.isEmailVerified && (
                  <p className="mt-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-200">
                    This user has not
                    verified their email.
                    The backend may prevent
                    activation.
                  </p>
                )}
  
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={
                    closeStatusModal
                  }
                  disabled={
                    processingUserId ===
                    statusUserId
                  }
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
                >
                  Cancel
                </button>
  
                <button
                  type="button"
                  onClick={
                    handleStatusChange
                  }
                  disabled={
                    processingUserId ===
                    statusUserId
                  }
                  className={`rounded-lg px-4 py-2 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    statusUser.isActive
                      ? "bg-yellow-600 hover:bg-yellow-700"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {processingUserId ===
                  statusUserId
                    ? "Processing..."
                    : statusUser.isActive
                      ? "Deactivate"
                      : "Activate"}
                </button>
              </div>
            </section>
          </div>
        )}
  
        {deletingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
            <section className="w-full max-w-md rounded-2xl border border-red-500/30 bg-[#2b2d31] p-6 shadow-2xl">
              <h2 className="text-xl font-bold text-red-300">
                Permanently Delete User
              </h2>
  
              <p className="mt-3 text-sm leading-6 text-[#b5bac1]">
                This will permanently
                remove{" "}
                <span className="font-semibold text-white">
                  {deletingUser.name}
                </span>{" "}
                from the database. This
                action cannot be undone.
              </p>
  
              <label
                htmlFor="deleteConfirmation"
                className="mt-5 block text-sm font-semibold text-white"
              >
                Type DELETE to confirm
              </label>
  
              <input
                id="deleteConfirmation"
                value={
                  deleteConfirmation
                }
                onChange={(event) =>
                  setDeleteConfirmation(
                    event.target.value
                  )
                }
                disabled={
                  processingUserId ===
                  deletingUserId
                }
                placeholder="DELETE"
                className="mt-2 w-full rounded-xl border border-red-500/30 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-red-400 focus:ring-2 focus:ring-red-400/20"
              />
  
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={
                    closeDeleteModal
                  }
                  disabled={
                    processingUserId ===
                    deletingUserId
                  }
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
                >
                  Cancel
                </button>
  
                <button
                  type="button"
                  onClick={
                    handleDeleteUser
                  }
                  disabled={
                    processingUserId ===
                      deletingUserId ||
                    deleteConfirmation !==
                      "DELETE"
                  }
                  className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processingUserId ===
                  deletingUserId
                    ? "Deleting..."
                    : "Delete Permanently"}
                </button>
              </div>
            </section>
          </div>
        )}
  
        {rejectingTeacher && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
            <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#2b2d31] p-6 shadow-2xl">
              <h2 className="text-xl font-bold text-white">
                Reject Teacher
              </h2>
  
              <p className="mt-2 text-sm text-[#b5bac1]">
                Provide a reason for
                rejecting{" "}
                <span className="font-semibold text-white">
                  {
                    rejectingTeacher.name
                  }
                </span>
                .
              </p>
  
              <form
                onSubmit={
                  handleRejectTeacher
                }
                className="mt-5"
              >
                <textarea
                  value={rejectionReason}
                  onChange={(event) =>
                    setRejectionReason(
                      event.target.value
                    )
                  }
                  rows={5}
                  maxLength={500}
                  disabled={
                    processingUserId ===
                    rejectingTeacherId
                  }
                  placeholder="Enter rejection reason"
                  className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                />
  
                <div className="mt-2 flex justify-between text-xs text-[#949ba4]">
                  <span>
                    Minimum 3 characters
                  </span>
  
                  <span>
                    {
                      rejectionReason.length
                    }
                    /500
                  </span>
                </div>
  
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={
                      closeRejectModal
                    }
                    disabled={
                      processingUserId ===
                      rejectingTeacherId
                    }
                    className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
                  >
                    Cancel
                  </button>
  
                  <button
                    type="submit"
                    disabled={
                      processingUserId ===
                      rejectingTeacherId
                    }
                    className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {processingUserId ===
                    rejectingTeacherId
                      ? "Rejecting..."
                      : "Reject Teacher"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
  
        {resettingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
            <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#2b2d31] p-6 shadow-2xl">
              <h2 className="text-xl font-bold text-white">
                Reset Password
              </h2>
  
              <p className="mt-2 text-sm leading-6 text-[#b5bac1]">
                Assign a new temporary password for{" "}
                <span className="font-semibold text-white">
                  {resettingUser.name}
                </span>
                . They will be required to change it at
                their next login.
              </p>
  
              <form
                onSubmit={handleResetPassword}
                className="mt-5 space-y-4"
              >
                <div>
                  <label
                    htmlFor="temporaryPassword"
                    className="mb-2 block text-sm font-semibold text-white"
                  >
                    Temporary password
                  </label>
  
                  <PasswordInput
                    id="temporaryPassword"
                    name="temporaryPassword"
                    value={resetPassword}
                    onChange={(event) =>
                      setResetPassword(
                        event.target.value
                      )
                    }
                    disabled={Boolean(
                      processingUserId
                    )}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                  />
  
                  <p className="mt-2 text-xs text-[#949ba4]">
                    Must include upper and lower case
                    letters and a number.
                  </p>
                </div>
  
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeResetPasswordModal}
                    disabled={Boolean(
                      processingUserId
                    )}
                    className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
                  >
                    Cancel
                  </button>
  
                  <button
                    type="submit"
                    disabled={Boolean(
                      processingUserId
                    )}
                    className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {processingUserId
                      ? "Saving..."
                      : "Reset Password"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
  
        {isCreateModalOpen && (
          <CreateUserModal
            departments={departments}
            onClose={() => setIsCreateModalOpen(false)}
            onCreated={handleUserCreated}
          />
        )}
      </DashboardLayout>
    );
  };
  
  export default AdminUsersPage;
