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

export const getAllUsers = async () => {
  const response = await api.get(
    "/admin/users"
  );

  return response.data.data;
};