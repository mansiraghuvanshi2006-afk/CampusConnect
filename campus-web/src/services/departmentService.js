import api from "./api.js";

/**
 * Create a new department.
 */
export const createDepartment = async (
  departmentData
) => {
  const response = await api.post(
    "/admin/departments",
    departmentData
  );

  return response.data;
};

/**
 * Get all departments.
 *
 * Supported query params:
 * search
 * status
 * sort
 * page
 * limit
 */
export const getDepartments = async (
  params = {}
) => {
  const response = await api.get(
    "/admin/departments",
    {
      params,
    }
  );

  return response.data?.data;
};

/**
 * Get one department by ID.
 */
export const getDepartmentById = async (
  departmentId
) => {
  if (!departmentId) {
    throw new Error(
      "Department ID is required"
    );
  }

  const response = await api.get(
    `/admin/departments/${departmentId}`
  );

  return response.data?.data?.department;
};

/**
 * Update a department.
 */
export const updateDepartment = async (
  departmentId,
  departmentData
) => {
  if (!departmentId) {
    throw new Error(
      "Department ID is required"
    );
  }

  const response = await api.patch(
    `/admin/departments/${departmentId}`,
    departmentData
  );

  return response.data;
};

/**
 * Delete a department.
 */
export const deleteDepartment = async (
  departmentId
) => {
  if (!departmentId) {
    throw new Error(
      "Department ID is required"
    );
  }

  const response = await api.delete(
    `/admin/departments/${departmentId}`
  );

  return response.data;
};