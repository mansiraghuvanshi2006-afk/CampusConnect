import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import toast from "react-hot-toast";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";

import {
  approveTeacher,
  getAdminDashboard,
  getPendingTeachers,
  rejectTeacher,
} from "../../services/adminService.js";

import getErrorMessage from "../../utils/getErrorMessage.js";

const initialStats = {
  totalUsers: 0,
  totalStudents: 0,
  totalTeachers: 0,
  pendingTeachers: 0,
  activeUsers: 0,
};

const AdminDashboard = () => {
  const navigate = useNavigate();

  const [stats, setStats] =
    useState(initialStats);

  const [teachers, setTeachers] =
    useState([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [
    processingTeacherId,
    setProcessingTeacherId,
  ] = useState(null);

  const [
    rejectingTeacher,
    setRejectingTeacher,
  ] = useState(null);

  const [
    rejectionReason,
    setRejectionReason,
  ] = useState("");

  const loadDashboardData =
    useCallback(async () => {
      try {
        setIsLoading(true);
        setError("");

        const [
          dashboardData,
          pendingTeachersData,
        ] = await Promise.all([
          getAdminDashboard(),
          getPendingTeachers(),
        ]);

        setStats(
          dashboardData?.stats ||
            initialStats
        );

        setTeachers(
          pendingTeachersData?.teachers ||
            []
        );
      } catch (error) {
        const message =
          getErrorMessage(
            error,
            "Unable to load admin dashboard"
          );

        setError(message);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(
      loadDashboardData,
      0
    );

    return () => window.clearTimeout(timeoutId);
  }, [loadDashboardData]);

  const handleApprove = async (
    teacher
  ) => {
    const teacherId =
      teacher._id || teacher.id;

    if (!teacherId) {
      toast.error(
        "Teacher ID is unavailable"
      );

      return;
    }

    try {
      setProcessingTeacherId(
        teacherId
      );

      const response =
        await approveTeacher(
          teacherId
        );

      toast.success(
        response?.message ||
          "Teacher approved successfully"
      );

      await loadDashboardData();
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          "Unable to approve teacher"
        )
      );
    } finally {
      setProcessingTeacherId(null);
    }
  };

  const openRejectDialog = (
    teacher
  ) => {
    setRejectingTeacher(teacher);
    setRejectionReason("");
  };

  const closeRejectDialog = () => {
    if (processingTeacherId) {
      return;
    }

    setRejectingTeacher(null);
    setRejectionReason("");
  };

  const handleReject = async (
    event
  ) => {
    event.preventDefault();

    const teacherId =
      rejectingTeacher?._id ||
      rejectingTeacher?.id;

    const trimmedReason =
      rejectionReason.trim();

    if (!teacherId) {
      toast.error(
        "Teacher ID is unavailable"
      );

      return;
    }

    if (trimmedReason.length < 3) {
      toast.error(
        "Rejection reason must contain at least 3 characters"
      );

      return;
    }

    try {
      setProcessingTeacherId(
        teacherId
      );

      const response =
        await rejectTeacher(
          teacherId,
          trimmedReason
        );

      toast.success(
        response?.message ||
          "Teacher rejected successfully"
      );

      setRejectingTeacher(null);
      setRejectionReason("");

      await loadDashboardData();
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          "Unable to reject teacher"
        )
      );
    } finally {
      setProcessingTeacherId(null);
    }
  };

  const statCards = [
    {
      title: "Total Users",
      value: stats.totalUsers,
      description:
        "View all registered users",
      path:
        "/admin/users?type=all",
    },
    {
      title: "Students",
      value: stats.totalStudents,
      description:
        "Manage student accounts",
      path:
        "/admin/users?type=students",
    },
    {
      title: "Teachers",
      value: stats.totalTeachers,
      description:
        "Manage teacher accounts",
      path:
        "/admin/users?type=teachers",
    },
    {
      title: "Pending Teachers",
      value: stats.pendingTeachers,
      description:
        "Review teacher requests",
      path:
        "/admin/users?type=pending-teachers",
    },
    {
      title: "Active Users",
      value: stats.activeUsers,
      description:
        "View active user accounts",
      path:
        "/admin/users?type=active",
    },
  ];

  const handleStatCardClick = (
    card
  ) => {
    navigate(card.path);
  };

  const rejectingTeacherId =
    rejectingTeacher?._id ||
    rejectingTeacher?.id;

  return (
    <DashboardLayout
      title="Admin Dashboard"
      description="Manage CampusConnect users, departments, academic years, and teacher approvals."
    >
      {isLoading && (
        <div className="rounded-2xl border border-white/10 bg-[#2b2d31] p-10 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-purple-400" />

          <p className="mt-4 text-[#b5bac1]">
            Loading dashboard...
          </p>
        </div>
      )}

      {!isLoading && error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5">
          <p className="font-semibold text-red-300">
            Unable to load dashboard
          </p>

          <p className="mt-1 text-sm text-red-200/80">
            {error}
          </p>

          <button
            type="button"
            onClick={loadDashboardData}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            Try again
          </button>
        </div>
      )}

      {!isLoading && !error && (
        <>
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-bold text-white">
                Campus Management
              </h2>

              <p className="mt-1 text-sm text-[#b5bac1]">
                Manage the main academic structure of CampusConnect.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/admin/departments"
                  )
                }
                className="group rounded-2xl border border-purple-500/20 bg-[#2b2d31] p-6 text-left transition hover:-translate-y-1 hover:border-purple-400/50 hover:bg-[#32343a]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-purple-300">
                      Departments
                    </p>

                    <h3 className="mt-2 text-xl font-bold text-white">
                      Manage Departments
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-[#b5bac1]">
                      Create, edit,
                      activate, deactivate,
                      or delete campus
                      departments.
                    </p>
                  </div>

                  <span className="text-2xl text-purple-300 transition group-hover:translate-x-1">
                    →
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/admin/academic-years"
                  )
                }
                className="group rounded-2xl border border-white/10 bg-[#2b2d31] p-6 text-left transition hover:-translate-y-1 hover:border-white/20 hover:bg-[#32343a]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-blue-300">
                      Academic Years
                    </p>

                    <h3 className="mt-2 text-xl font-bold text-white">
                      Manage Years
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-[#b5bac1]">
                      Add years such as
                      first, second, third,
                      and fourth year to
                      each department.
                    </p>
                  </div>

                  <span className="text-2xl text-blue-300 transition group-hover:translate-x-1">
                    →
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/admin/users?type=all"
                  )
                }
                className="group rounded-2xl border border-white/10 bg-[#2b2d31] p-6 text-left transition hover:-translate-y-1 hover:border-white/20 hover:bg-[#32343a]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-green-300">
                      Users
                    </p>

                    <h3 className="mt-2 text-xl font-bold text-white">
                      Manage Users
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-[#b5bac1]">
                      View students and
                      teachers, edit their
                      information, and
                      manage their accounts.
                    </p>
                  </div>

                  <span className="text-2xl text-green-300 transition group-hover:translate-x-1">
                    →
                  </span>
                </div>
              </button>
            </div>
          </section>

          <section className="mt-8">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-white">
                User Overview
              </h2>

              <p className="mt-1 text-sm text-[#b5bac1]">
                Select a card to view
                its related users.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
              {statCards.map((card) => (
                <button
                  key={card.title}
                  type="button"
                  onClick={() =>
                    handleStatCardClick(
                      card
                    )
                  }
                  className="rounded-2xl border border-white/10 bg-[#2b2d31] p-6 text-left shadow-lg shadow-black/10 transition hover:-translate-y-1 hover:border-purple-400/40 hover:bg-[#32343a]"
                >
                  <p className="text-sm text-[#b5bac1]">
                    {card.title}
                  </p>

                  <h2 className="mt-3 text-4xl font-bold text-white">
                    {card.value}
                  </h2>

                  <p className="mt-3 text-xs text-purple-300">
                    {card.description} →
                  </p>
                </button>
              ))}
            </div>
          </section>

          <section
            id="pending-teachers"
            className="mt-8 scroll-mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[#2b2d31]"
          >
            <div className="flex flex-col gap-3 border-b border-white/10 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Pending Teacher
                  Approvals
                </h2>

                <p className="mt-2 text-sm text-[#b5bac1]">
                  Review verified
                  teacher accounts before
                  giving access.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  loadDashboardData
                }
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Refresh
              </button>
            </div>

            {teachers.length === 0 ? (
              <div className="p-10 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10 text-2xl text-green-300">
                  ✓
                </div>

                <h3 className="mt-4 text-lg font-semibold text-white">
                  No pending teachers
                </h3>

                <p className="mt-2 text-sm text-[#b5bac1]">
                  All verified teacher
                  requests have been
                  reviewed.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead className="bg-black/20 text-xs uppercase tracking-wide text-[#b5bac1]">
                    <tr>
                      <th className="px-6 py-4">
                        Teacher
                      </th>

                      <th className="px-6 py-4">
                        Email
                      </th>

                      <th className="px-6 py-4">
                        Registered
                      </th>

                      <th className="px-6 py-4">
                        Status
                      </th>

                      <th className="px-6 py-4 text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {teachers.map(
                      (teacher) => {
                        const teacherId =
                          teacher._id ||
                          teacher.id;

                        const isProcessing =
                          processingTeacherId ===
                          teacherId;

                        return (
                          <tr
                            key={teacherId}
                            className="border-t border-white/10"
                          >
                            <td className="px-6 py-5">
                              <p className="font-semibold text-white">
                                {
                                  teacher.name
                                }
                              </p>
                            </td>

                            <td className="px-6 py-5 text-sm text-[#b5bac1]">
                              {
                                teacher.email
                              }
                            </td>

                            <td className="px-6 py-5 text-sm text-[#b5bac1]">
                              {teacher.createdAt
                                ? new Date(
                                    teacher.createdAt
                                  ).toLocaleDateString(
                                    "en-IN",
                                    {
                                      day:
                                        "2-digit",
                                      month:
                                        "short",
                                      year:
                                        "numeric",
                                    }
                                  )
                                : "Unknown"}
                            </td>

                            <td className="px-6 py-5">
                              <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-200">
                                Pending
                              </span>
                            </td>

                            <td className="px-6 py-5">
                              <div className="flex justify-end gap-3">
                                <button
                                  type="button"
                                  disabled={
                                    isProcessing
                                  }
                                  onClick={() =>
                                    handleApprove(
                                      teacher
                                    )
                                  }
                                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {isProcessing
                                    ? "Processing..."
                                    : "Approve"}
                                </button>

                                <button
                                  type="button"
                                  disabled={
                                    isProcessing
                                  }
                                  onClick={() =>
                                    openRejectDialog(
                                      teacher
                                    )
                                  }
                                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Reject
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
            )}
          </section>
        </>
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
              onSubmit={handleReject}
              className="mt-5"
            >
              <label
                htmlFor="rejectionReason"
                className="mb-2 block text-sm font-semibold text-white"
              >
                Rejection reason
              </label>

              <textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(event) =>
                  setRejectionReason(
                    event.target.value
                  )
                }
                rows={5}
                maxLength={500}
                disabled={
                  processingTeacherId ===
                  rejectingTeacherId
                }
                placeholder="Explain why this teacher registration is being rejected"
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
                    closeRejectDialog
                  }
                  disabled={
                    processingTeacherId ===
                    rejectingTeacherId
                  }
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    processingTeacherId ===
                    rejectingTeacherId
                  }
                  className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processingTeacherId ===
                  rejectingTeacherId
                    ? "Rejecting..."
                    : "Reject Teacher"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </DashboardLayout>
  );
};

export default AdminDashboard;
