import api from "./api.js";

export const getAdminDashboard = async () => {
  const response = await api.get(
    "/admin/dashboard"
  );

  return response.data.data;
};

export const getPendingTeachers = async () => {
  const response = await api.get(
    "/admin/teachers/pending"
  );

  return response.data.data;
};

export const approveTeacher = async (
  teacherId
) => {
  const response = await api.patch(
    `/admin/teachers/${teacherId}/approve`
  );

  return response.data;
};

export const rejectTeacher = async (
  teacherId,
  reason
) => {
  const response = await api.patch(
    `/admin/teachers/${teacherId}/reject`,
    {
      reason,
    }
  );

  return response.data;
};

/**
 * Get filtered admin users.
 *
 * Supported types:
 * all
 * students
 * teachers
 * pending-teachers
 * active
 * inactive
 */
export const getAllUsers = async ({
  type = "all",
  search = "",
  page = 1,
  limit = 20,
} = {}) => {
  const response = await api.get(
    "/admin/users",
    {
      params: {
        type,
        search,
        page,
        limit,
      },
    }
  );

  return response.data.data;
};

/**
 * Get one user.
 */
export const getAdminUserById = async (
  userId
) => {
  const response = await api.get(
    `/admin/users/${userId}`
  );

  return response.data.data;
};

/**
 * Update one user.
 */
export const updateAdminUser = async (
  userId,
  userData
) => {
  const response = await api.patch(
    `/admin/users/${userId}`,
    userData
  );

  return response.data;
};

/**
 * Activate or deactivate one user.
 */
export const updateUserStatus = async (
  userId,
  isActive
) => {
  const response = await api.patch(
    `/admin/users/${userId}/status`,
    {
      isActive,
    }
  );

  return response.data;
};

/**
 * Permanently delete one user.
 */
export const deleteUserPermanently = async (
  userId
) => {
  const response = await api.delete(
    `/admin/users/${userId}`,
    {
      data: {
        confirmation: "DELETE",
      },
    }
  );

  return response.data;
};