import api from "./api.js";

/**
 * Get all academic years for a department
 */
export const getAcademicYears = async (
  departmentId
) => {
  const response = await api.get(
    `/admin/departments/${departmentId}/years`
  );

  return response.data;
};

/**
 * Get one academic year
 */
export const getAcademicYearById = async (
  academicYearId
) => {
  const response = await api.get(
    `/admin/academic-years/${academicYearId}`
  );

  return response.data;
};

/**
 * Update an academic year
 */
export const updateAcademicYear = async (
  academicYearId,
  academicYearData
) => {
  const response = await api.patch(
    `/admin/academic-years/${academicYearId}`,
    academicYearData
  );

  return response.data;
};

/**
 * Toggle academic year active status
 */
export const toggleAcademicYearStatus = async (
  academicYearId,
  isActive
) => {
  const response = await api.patch(
    `/admin/academic-years/${academicYearId}`,
    {
      isActive,
    }
  );

  return response.data;
};