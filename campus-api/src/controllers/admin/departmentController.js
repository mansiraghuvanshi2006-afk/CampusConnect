import mongoose from "mongoose";

import Department from "../../models/Department.js";
import AcademicYear from "../../models/AcademicYear.js";

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

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getOrdinalSuffix = (number) => {
  const lastTwoDigits = number % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return "th";
  }

  switch (number % 10) {
    case 1:
      return "st";

    case 2:
      return "nd";

    case 3:
      return "rd";

    default:
      return "th";
  }
};

const getYearName = (yearNumber) =>
  `${yearNumber}${getOrdinalSuffix(yearNumber)} Year`;

const buildAcademicYears = ({
  departmentId,
  startYear,
  endYear,
  createdBy,
}) =>
  Array.from(
    {
      length: endYear - startYear + 1,
    },
    (_, index) => {
      const yearNumber = startYear + index;

      return {
        department: departmentId,
        yearNumber,
        name: getYearName(yearNumber),
        sortOrder: yearNumber,
        isActive: true,
        createdBy,
      };
    }
  );

/**
 * @desc    Create a department and its academic years
 * @route   POST /api/v1/admin/departments
 * @access  Admin
 */
export const createDepartment = async (req, res, next) => {
  try {
    const name = normalizeDepartmentName(req.body.name);
    const code = req.body.code.trim().toUpperCase();
    const durationInYears = Number(req.body.durationInYears);

    const existingDepartment = await Department.findOne({
      $or: [
        {
          name: {
            $regex: `^${escapeRegex(name)}$`,
            $options: "i",
          },
        },
        {
          code,
        },
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
      durationInYears,
      isActive: req.body.isActive ?? true,
      createdBy: req.user._id,
    });

    try {
      const academicYears = buildAcademicYears({
        departmentId: department._id,
        startYear: 1,
        endYear: durationInYears,
        createdBy: req.user._id,
      });

      const createdYears = await AcademicYear.insertMany(academicYears);

      const populatedDepartment = await Department.findById(
        department._id
      ).populate("createdBy", "name email role");

      return res.status(201).json({
        success: true,
        message: `Department and ${createdYears.length} academic year${
          createdYears.length === 1 ? "" : "s"
        } created successfully`,
        data: {
          department: populatedDepartment,
          academicYears: createdYears,
        },
      });
    } catch (yearCreationError) {
      // Prevent a department from remaining without its default years.
      await Department.findByIdAndDelete(department._id);

      throw yearCreationError;
    }
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
      const escapedSearch = escapeRegex(search.trim());

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
      name: {
        name: 1,
      },
      newest: {
        createdAt: -1,
      },
      oldest: {
        createdAt: 1,
      },
      code: {
        code: 1,
      },
      duration: {
        durationInYears: 1,
      },
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

    const departmentIds = departments.map(
      (department) => department._id
    );

    const academicYearCounts =
      departmentIds.length > 0
        ? await AcademicYear.aggregate([
            {
              $match: {
                department: {
                  $in: departmentIds,
                },
              },
            },
            {
              $group: {
                _id: "$department",
                totalAcademicYears: {
                  $sum: 1,
                },
                activeAcademicYears: {
                  $sum: {
                    $cond: ["$isActive", 1, 0],
                  },
                },
              },
            },
          ])
        : [];

    const yearCountMap = new Map(
      academicYearCounts.map((item) => [
        item._id.toString(),
        {
          totalAcademicYears: item.totalAcademicYears,
          activeAcademicYears: item.activeAcademicYears,
        },
      ])
    );

    const departmentsWithYearCounts = departments.map((department) => {
      const departmentObject = department.toObject();

      const counts = yearCountMap.get(department._id.toString()) || {
        totalAcademicYears: 0,
        activeAcademicYears: 0,
      };

      return {
        ...departmentObject,
        ...counts,
      };
    });

    const totalPages = Math.ceil(totalDepartments / limitNumber);

    return res.status(200).json({
      success: true,
      message: "Departments fetched successfully",
      data: {
        departments: departmentsWithYearCounts,
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
 * @desc    Get one department with its academic years
 * @route   GET /api/v1/admin/departments/:departmentId
 * @access  Admin
 */
export const getDepartmentById = async (req, res, next) => {
  try {
    const { departmentId } = req.params;

    if (!mongoose.isValidObjectId(departmentId)) {
      return next(createError("Invalid department ID", 400));
    }

    const [department, academicYears] = await Promise.all([
      Department.findById(departmentId).populate(
        "createdBy",
        "name email role"
      ),

      AcademicYear.find({
        department: departmentId,
      })
        .populate("createdBy", "name email role")
        .sort({
          sortOrder: 1,
          yearNumber: 1,
        }),
    ]);

    if (!department) {
      return next(createError("Department not found", 404));
    }

    return res.status(200).json({
      success: true,
      message: "Department fetched successfully",
      data: {
        department,
        academicYears,
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

    const previousDuration = department.durationInYears;
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

    if (req.body.durationInYears !== undefined) {
      updates.durationInYears = Number(req.body.durationInYears);
    }

    if (req.body.isActive !== undefined) {
      updates.isActive = req.body.isActive;
    }

    if (updates.name || updates.code) {
      const duplicateConditions = [];

      if (updates.name) {
        duplicateConditions.push({
          name: {
            $regex: `^${escapeRegex(updates.name)}$`,
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
        if (
          updates.code &&
          existingDepartment.code === updates.code
        ) {
          return next(
            createError("A department with this code already exists", 409)
          );
        }

        return next(
          createError("A department with this name already exists", 409)
        );
      }
    }

    const newDuration =
      updates.durationInYears ?? department.durationInYears;

    if (newDuration < previousDuration) {
      const yearsOutsideNewDuration = await AcademicYear.countDocuments({
        department: departmentId,
        yearNumber: {
          $gt: newDuration,
        },
      });

      if (yearsOutsideNewDuration > 0) {
        return next(
          createError(
            "Department duration cannot be reduced while higher academic years exist. Disable or delete those years manually first.",
            409
          )
        );
      }
    }

    Object.assign(department, updates);

    await department.save();

    let createdAcademicYears = [];

    if (newDuration > previousDuration) {
      const existingYearNumbers = await AcademicYear.distinct(
        "yearNumber",
        {
          department: departmentId,
        }
      );

      const existingYearSet = new Set(existingYearNumbers);

      const missingYears = buildAcademicYears({
        departmentId: department._id,
        startYear: previousDuration + 1,
        endYear: newDuration,
        createdBy: req.user._id,
      }).filter(
        (academicYear) =>
          !existingYearSet.has(academicYear.yearNumber)
      );

      if (missingYears.length > 0) {
        createdAcademicYears = await AcademicYear.insertMany(
          missingYears
        );
      }
    }

    const [updatedDepartment, academicYears] = await Promise.all([
      Department.findById(department._id).populate(
        "createdBy",
        "name email role"
      ),

      AcademicYear.find({
        department: department._id,
      }).sort({
        sortOrder: 1,
        yearNumber: 1,
      }),
    ]);

    return res.status(200).json({
      success: true,
      message:
        createdAcademicYears.length > 0
          ? `Department updated and ${createdAcademicYears.length} new academic year${
              createdAcademicYears.length === 1 ? "" : "s"
            } created successfully`
          : "Department updated successfully",
      data: {
        department: updatedDepartment,
        academicYears,
        createdAcademicYears,
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
 * @desc    Delete a department and its academic years
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

    await AcademicYear.deleteMany({
      department: departmentId,
    });

    await department.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Department and its academic years deleted successfully",
      data: null,
    });
  } catch (error) {
    return next(error);
  }
};