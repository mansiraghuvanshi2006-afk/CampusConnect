import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import {
  approveTeacher,
  getAdminDashboard,
  getPendingTeachers,
  rejectTeacher,
} from "../../services/adminService.js";

import {
  logoutUser,
} from "../../services/authService.js";

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

  const [processingTeacherId, setProcessingTeacherId] =
    useState(null);

  const [rejectingTeacher, setRejectingTeacher] =
    useState(null);

  const [rejectionReason, setRejectionReason] =
    useState("");

  const loadDashboardData = async () => {
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
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleApprove = async (
    teacher
  ) => {
    try {
      setProcessingTeacherId(
        teacher.id
      );

      const response =
        await approveTeacher(
          teacher.id
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

    const trimmedReason =
      rejectionReason.trim();

    if (trimmedReason.length < 3) {
      toast.error(
        "Rejection reason must contain at least 3 characters"
      );

      return;
    }

    try {
      setProcessingTeacherId(
        rejectingTeacher.id
      );

      const response =
        await rejectTeacher(
          rejectingTeacher.id,
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

  const handleLogout = async () => {
    try {
      await logoutUser();

      toast.success(
        "Logged out successfully"
      );

      navigate("/admin/login", {
        replace: true,
      });
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          "Unable to log out"
        )
      );
    }
  };

  const statCards = [
    {
      title: "Total Users",
      value: stats.totalUsers,
    },
    {
      title: "Students",
      value: stats.totalStudents,
    },
    {
      title: "Teachers",
      value: stats.totalTeachers,
    },
    {
      title: "Pending Teachers",
      value: stats.pendingTeachers,
    },
    {
      title: "Active Users",
      value: stats.activeUsers,
    },
  ];

  return (
    <main className="min-h-screen bg-[#313338] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-purple-300">
              CampusConnect Admin
            </p>

            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              Admin Dashboard
            </h1>

            <p className="mt-2 text-[#b5bac1]">
              Manage users and teacher approvals.
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700"
          >
            Logout
          </button>
        </div>

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
              className="mt-4 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600"
            >
              Try again
            </button>
          </div>
        )}

        {!isLoading && !error && (
          <>
            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
              {statCards.map((card) => (
                <article
                  key={card.title}
                  className="rounded-2xl border border-white/10 bg-[#2b2d31] p-6 shadow-lg shadow-black/10"
                >
                  <p className="text-sm text-[#b5bac1]">
                    {card.title}
                  </p>

                  <h2 className="mt-3 text-4xl font-bold">
                    {card.value}
                  </h2>
                </article>
              ))}
            </section>

            <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-[#2b2d31]">
              <div className="flex flex-col gap-3 border-b border-white/10 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold">
                    Pending Teacher Approvals
                  </h2>

                  <p className="mt-2 text-sm text-[#b5bac1]">
                    Review verified teacher accounts before giving access.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadDashboardData}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
                >
                  Refresh
                </button>
              </div>

              {teachers.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10 text-2xl text-green-300">
                    ✓
                  </div>

                  <h3 className="mt-4 text-lg font-semibold">
                    No pending teachers
                  </h3>

                  <p className="mt-2 text-sm text-[#b5bac1]">
                    All verified teacher requests have been reviewed.
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
                          const isProcessing =
                            processingTeacherId ===
                            teacher.id;

                          return (
                            <tr
                              key={teacher.id}
                              className="border-t border-white/10"
                            >
                              <td className="px-6 py-5">
                                <p className="font-semibold text-white">
                                  {teacher.name}
                                </p>
                              </td>

                              <td className="px-6 py-5 text-sm text-[#b5bac1]">
                                {teacher.email}
                              </td>

                              <td className="px-6 py-5 text-sm text-[#b5bac1]">
                                {teacher.createdAt
                                  ? new Date(
                                      teacher.createdAt
                                    ).toLocaleDateString(
                                      "en-IN",
                                      {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
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
      </div>

      {rejectingTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#2b2d31] p-6 shadow-2xl">
            <h2 className="text-xl font-bold">
              Reject Teacher
            </h2>

            <p className="mt-2 text-sm text-[#b5bac1]">
              Provide a reason for rejecting{" "}
              <span className="font-semibold text-white">
                {rejectingTeacher.name}
              </span>
              .
            </p>

            <form
              onSubmit={handleReject}
              className="mt-5"
            >
              <label
                htmlFor="rejectionReason"
                className="mb-2 block text-sm font-semibold"
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
                  rejectingTeacher.id
                }
                placeholder="Explain why this teacher registration is being rejected"
                className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
              />

              <div className="mt-2 flex justify-between text-xs text-[#949ba4]">
                <span>
                  Minimum 3 characters
                </span>

                <span>
                  {rejectionReason.length}/500
                </span>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeRejectDialog}
                  disabled={
                    processingTeacherId ===
                    rejectingTeacher.id
                  }
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-semibold transition hover:bg-white/10 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    processingTeacherId ===
                    rejectingTeacher.id
                  }
                  className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processingTeacherId ===
                  rejectingTeacher.id
                    ? "Rejecting..."
                    : "Reject Teacher"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
};

export default AdminDashboard;