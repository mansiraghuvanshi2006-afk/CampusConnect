import api from "./api.js";

/**
 * Get active departments available
 * during student or teacher profile setup.
 */
export const getProfileDepartments = async () => {
  const response = await api.get("/profile-options/departments");

  return response.data?.data?.departments || [];
};

/**
 * Get active academic years for
 * one selected department.
 */
export const getDepartmentYears = async (departmentId) => {
  if (!departmentId) {
    throw new Error("Department ID is required");
  }

  const response = await api.get(
    `/profile-options/departments/${departmentId}/years`
  );

  return response.data?.data?.academicYears || [];
};

/**
 * Complete student profile.
 */
export const completeStudentProfile = async ({ department, year }) => {
  const response = await api.patch("/profile/student", {
    department,
    year,
  });

  return response.data?.data?.user;
};

/**
 * Complete teacher profile.
 */
export const completeTeacherProfile = async ({
  department,
  teachingYears,
}) => {
  const response = await api.patch("/profile/teacher", {
    department,
    teachingYears,
  });

  return response.data?.data?.user;
};

/**
 * Phase 8 — full self profile.
 */
export const getMyProfile = async () => {
  const response = await api.get("/profile/me");
  return response.data?.data?.profile;
};

export const updateMyProfile = async (payload) => {
  const response = await api.patch("/profile/me", payload);
  return response.data?.data?.profile;
};

export const uploadMyAvatar = async (file) => {
  const formData = new FormData();
  formData.append("avatar", file);

  const response = await api.post("/profile/me/avatar", formData, {
    timeout: 60000,
  });

  return response.data?.data?.profile;
};

export const deleteMyAvatar = async () => {
  const response = await api.delete("/profile/me/avatar");
  return response.data?.data?.profile;
};
