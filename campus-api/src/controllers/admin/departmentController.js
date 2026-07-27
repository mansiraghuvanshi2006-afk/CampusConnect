import mongoose from "mongoose";

import Department from "../../models/Department.js";

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
};

const normalizeDepartmentName = (name) =>
  name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

/**
 * @desc    Create a department
 * @route   POST /api/v1/admin/departments
 * @access  Admin
 */
export const createDepartment = async (req, res, next) => {
  try {
    const name = normalizeDepartmentName(req.body.name);
    const code = req.body.code.trim().toUpperCase();

    const existingDepartment = await Department.findOne({
      $or: [
        {
          name: {
            $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
            $options: "i",
          },
        },
        { code },
      ],
    });

    if (existingDepartment) {
      if (existingDepartment.code === code) {
        return next(
          createError("A department with this code already exists", 409)
        );
      }

      return next(
        createError("A department with this name already exists", 409)
      );
    }

    const department = await Department.create({
      name,
      code,
      description: req.body.description || "",
      isActive: req.body.isActive ?? true,
      createdBy: req.user._id,
    });

    const populatedDepartment = await Department.findById(
      department._id
    ).populate("createdBy", "name email role");

    return res.status(201).json({
      success: true,
      message: "Department created successfully",
      data: {
        department: populatedDepartment,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0];

      return next(
        createError(
          `A department with this ${duplicateField || "value"} already exists`,
          409
        )
      );
    }

    return next(error);
  }
};

/**
 * @desc    Get all departments
 * @route   GET /api/v1/admin/departments
 * @access  Admin
 */
export const getDepartments = async (req, res, next) => {
  try {
    const {
      search = "",
      status = "all",
      sort = "name",
      page = "1",
      limit = "20",
    } = req.query;

    const pageNumber = Math.max(Number.parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(
      Math.max(Number.parseInt(limit, 10) || 20, 1),
      100
    );

    const filter = {};

    if (search.trim()) {
      const escapedSearch = search
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      filter.$or = [
        {
          name: {
            $regex: escapedSearch,
            $options: "i",
          },
        },
        {
          code: {
            $regex: escapedSearch,
            $options: "i",
          },
        },
      ];
    }

    if (status === "active") {
      filter.isActive = true;
    }

    if (status === "inactive") {
      filter.isActive = false;
    }

    const allowedSortFields = {
      name: { name: 1 },
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      code: { code: 1 },
    };

    const sortOption = allowedSortFields[sort] || allowedSortFields.name;

    const [departments, totalDepartments] = await Promise.all([
      Department.find(filter)
        .populate("createdBy", "name email role")
        .sort(sortOption)
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber),
      Department.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalDepartments / limitNumber);

    return res.status(200).json({
      success: true,
      message: "Departments fetched successfully",
      data: {
        departments,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalDepartments,
          limit: limitNumber,
          hasNextPage: pageNumber < totalPages,
          hasPreviousPage: pageNumber > 1,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Get one department
 * @route   GET /api/v1/admin/departments/:departmentId
 * @access  Admin
 */
export const getDepartmentById = async (req, res, next) => {
  try {
    const { departmentId } = req.params;

    if (!mongoose.isValidObjectId(departmentId)) {
      return next(createError("Invalid department ID", 400));
    }

    const department = await Department.findById(departmentId).populate(
      "createdBy",
      "name email role"
    );

    if (!department) {
      return next(createError("Department not found", 404));
    }

    return res.status(200).json({
      success: true,
      message: "Department fetched successfully",
      data: {
        department,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Update a department
 * @route   PATCH /api/v1/admin/departments/:departmentId
 * @access  Admin
 */
export const updateDepartment = async (req, res, next) => {
  try {
    const { departmentId } = req.params;

    if (!mongoose.isValidObjectId(departmentId)) {
      return next(createError("Invalid department ID", 400));
    }

    const department = await Department.findById(departmentId);

    if (!department) {
      return next(createError("Department not found", 404));
    }

    const updates = {};

    if (req.body.name !== undefined) {
      updates.name = normalizeDepartmentName(req.body.name);
    }

    if (req.body.code !== undefined) {
      updates.code = req.body.code.trim().toUpperCase();
    }

    if (req.body.description !== undefined) {
      updates.description = req.body.description;
    }

    if (req.body.isActive !== undefined) {
      updates.isActive = req.body.isActive;
    }

    if (updates.name || updates.code) {
      const duplicateConditions = [];

      if (updates.name) {
        duplicateConditions.push({
          name: {
            $regex: `^${updates.name.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&"
            )}$`,
            $options: "i",
          },
        });
      }

      if (updates.code) {
        duplicateConditions.push({
          code: updates.code,
        });
      }

      const existingDepartment = await Department.findOne({
        _id: {
          $ne: departmentId,
        },
        $or: duplicateConditions,
      });

      if (existingDepartment) {
        if (updates.code && existingDepartment.code === updates.code) {
          return next(
            createError("A department with this code already exists", 409)
          );
        }

        return next(
          createError("A department with this name already exists", 409)
        );
      }
    }

    Object.assign(department, updates);

    await department.save();

    const updatedDepartment = await Department.findById(department._id).populate(
      "createdBy",
      "name email role"
    );

    return res.status(200).json({
      success: true,
      message: "Department updated successfully",
      data: {
        department: updatedDepartment,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0];

      return next(
        createError(
          `A department with this ${duplicateField || "value"} already exists`,
          409
        )
      );
    }

    return next(error);
  }
};

/**
 * @desc    Delete a department
 * @route   DELETE /api/v1/admin/departments/:departmentId
 * @access  Admin
 */
export const deleteDepartment = async (req, res, next) => {
  try {
    const { departmentId } = req.params;

    if (!mongoose.isValidObjectId(departmentId)) {
      return next(createError("Invalid department ID", 400));
    }

    const department = await Department.findById(departmentId);

    if (!department) {
      return next(createError("Department not found", 404));
    }

    await department.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Department deleted successfully",
      data: null,
    });
  } catch (error) {
    return next(error);
  }
};