import mongoose from "mongoose";

import AcademicYear from "../../models/AcademicYear.js";
import Department from "../../models/Department.js";

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
};

const getOrdinalSuffix = (number) => {
  const lastTwoDigits = number % 100;

  if (
    lastTwoDigits >= 11 &&
    lastTwoDigits <= 13
  ) {
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

const getDefaultYearName = (
  yearNumber
) =>
  `${yearNumber}${getOrdinalSuffix(
    yearNumber
  )} Year`;

/**
 * @desc    Get all academic years for one department
 * @route   GET /api/v1/admin/departments/:departmentId/years
 * @access  Admin
 */
export const getAcademicYearsByDepartment =
  async (req, res, next) => {
    try {
      const { departmentId } =
        req.params;

      if (
        !mongoose.isValidObjectId(
          departmentId
        )
      ) {
        return next(
          createError(
            "Invalid department ID",
            400
          )
        );
      }

      const department =
        await Department.findById(
          departmentId
        ).populate(
          "createdBy",
          "name email role"
        );

      if (!department) {
        return next(
          createError(
            "Department not found",
            404
          )
        );
      }

      const academicYears =
        await AcademicYear.find({
          department: departmentId,
        })
          .populate(
            "createdBy",
            "name email role"
          )
          .sort({
            sortOrder: 1,
            yearNumber: 1,
          });

      return res.status(200).json({
        success: true,
        message:
          "Academic years fetched successfully",
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
 * @desc    Get one academic year
 * @route   GET /api/v1/admin/academic-years/:academicYearId
 * @access  Admin
 */
export const getAcademicYearById =
  async (req, res, next) => {
    try {
      const { academicYearId } =
        req.params;

      if (
        !mongoose.isValidObjectId(
          academicYearId
        )
      ) {
        return next(
          createError(
            "Invalid academic year ID",
            400
          )
        );
      }

      const academicYear =
        await AcademicYear.findById(
          academicYearId
        )
          .populate(
            "department",
            "name code durationInYears isActive"
          )
          .populate(
            "createdBy",
            "name email role"
          );

      if (!academicYear) {
        return next(
          createError(
            "Academic year not found",
            404
          )
        );
      }

      return res.status(200).json({
        success: true,
        message:
          "Academic year fetched successfully",
        data: {
          academicYear,
        },
      });
    } catch (error) {
      return next(error);
    }
  };

/**
 * @desc    Create an academic year manually
 * @route   POST /api/v1/admin/departments/:departmentId/years
 * @access  Admin
 */
export const createAcademicYear =
  async (req, res, next) => {
    try {
      const { departmentId } =
        req.params;

      if (
        !mongoose.isValidObjectId(
          departmentId
        )
      ) {
        return next(
          createError(
            "Invalid department ID",
            400
          )
        );
      }

      const department =
        await Department.findById(
          departmentId
        );

      if (!department) {
        return next(
          createError(
            "Department not found",
            404
          )
        );
      }

      const yearNumber = Number(
        req.body.yearNumber
      );

      const existingAcademicYear =
        await AcademicYear.findOne({
          department: departmentId,
          yearNumber,
        });

      if (existingAcademicYear) {
        return next(
          createError(
            "This academic year already exists for the department",
            409
          )
        );
      }

      const academicYear =
        await AcademicYear.create({
          department: departmentId,

          yearNumber,

          name:
            req.body.name?.trim() ||
            getDefaultYearName(
              yearNumber
            ),

          sortOrder:
            req.body.sortOrder ??
            yearNumber,

          isActive:
            req.body.isActive ?? true,

          createdBy: req.user._id,
        });

      const populatedAcademicYear =
        await AcademicYear.findById(
          academicYear._id
        )
          .populate(
            "department",
            "name code durationInYears isActive"
          )
          .populate(
            "createdBy",
            "name email role"
          );

      return res.status(201).json({
        success: true,
        message:
          "Academic year created successfully",
        data: {
          academicYear:
            populatedAcademicYear,
        },
      });
    } catch (error) {
      if (error.code === 11000) {
        return next(
          createError(
            "This academic year already exists for the department",
            409
          )
        );
      }

      return next(error);
    }
  };

/**
 * @desc    Update an academic year
 * @route   PATCH /api/v1/admin/academic-years/:academicYearId
 * @access  Admin
 */
export const updateAcademicYear =
  async (req, res, next) => {
    try {
      const { academicYearId } =
        req.params;

      if (
        !mongoose.isValidObjectId(
          academicYearId
        )
      ) {
        return next(
          createError(
            "Invalid academic year ID",
            400
          )
        );
      }

      const academicYear =
        await AcademicYear.findById(
          academicYearId
        );

      if (!academicYear) {
        return next(
          createError(
            "Academic year not found",
            404
          )
        );
      }

      if (
        req.body.yearNumber !==
        undefined
      ) {
        const yearNumber = Number(
          req.body.yearNumber
        );

        const duplicateYear =
          await AcademicYear.findOne({
            _id: {
              $ne: academicYearId,
            },
            department:
              academicYear.department,
            yearNumber,
          });

        if (duplicateYear) {
          return next(
            createError(
              "This academic year already exists for the department",
              409
            )
          );
        }

        academicYear.yearNumber =
          yearNumber;
      }

      if (
        req.body.name !== undefined
      ) {
        academicYear.name =
          req.body.name.trim();
      }

      if (
        req.body.sortOrder !==
        undefined
      ) {
        academicYear.sortOrder =
          Number(req.body.sortOrder);
      }

      if (
        req.body.isActive !==
        undefined
      ) {
        academicYear.isActive =
          req.body.isActive;
      }

      await academicYear.save();

      const updatedAcademicYear =
        await AcademicYear.findById(
          academicYear._id
        )
          .populate(
            "department",
            "name code durationInYears isActive"
          )
          .populate(
            "createdBy",
            "name email role"
          );

      return res.status(200).json({
        success: true,
        message:
          "Academic year updated successfully",
        data: {
          academicYear:
            updatedAcademicYear,
        },
      });
    } catch (error) {
      if (error.code === 11000) {
        return next(
          createError(
            "This academic year already exists for the department",
            409
          )
        );
      }

      return next(error);
    }
  };

/**
 * @desc    Delete an academic year
 * @route   DELETE /api/v1/admin/academic-years/:academicYearId
 * @access  Admin
 */
export const deleteAcademicYear =
  async (req, res, next) => {
    try {
      const { academicYearId } =
        req.params;

      if (
        !mongoose.isValidObjectId(
          academicYearId
        )
      ) {
        return next(
          createError(
            "Invalid academic year ID",
            400
          )
        );
      }

      const academicYear =
        await AcademicYear.findById(
          academicYearId
        );

      if (!academicYear) {
        return next(
          createError(
            "Academic year not found",
            404
          )
        );
      }

      await academicYear.deleteOne();

      return res.status(200).json({
        success: true,
        message:
          "Academic year deleted successfully",
        data: null,
      });
    } catch (error) {
      return next(error);
    }
  };