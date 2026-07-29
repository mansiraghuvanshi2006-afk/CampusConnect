import api from "./api.js";

/**
 * Get active departments available
 * during student or teacher profile setup.
 */
export const getProfileDepartments =
  async () => {
    const response = await api.get(
      "/profile-options/departments"
    );

    return (
      response.data?.data?.departments || []
    );
  };

/**
 * Get active academic years for
 * one selected department.
 */
export const getDepartmentYears =
  async (departmentId) => {
    if (!departmentId) {
      throw new Error(
        "Department ID is required"
      );
    }

    const response = await api.get(
      `/profile-options/departments/${departmentId}/years`
    );

    return (
      response.data?.data?.academicYears || []
    );
  };

/**
 * Complete student profile.
 */
export const completeStudentProfile =
  async ({
    department,
    year,
  }) => {
    const response = await api.patch(
      "/profile/student",
      {
        department,
        year,
      }
    );

    return response.data?.data?.user;
  };

/**
 * Complete teacher profile.
 */
export const completeTeacherProfile =
  async ({
    department,
    teachingYears,
  }) => {
    const response = await api.patch(
      "/profile/teacher",
      {
        department,
        teachingYears,
      }
    );

    return response.data?.data?.user;
  };