import mongoose from "mongoose";

import AcademicYear from "../models/AcademicYear.js";
import Department from "../models/Department.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

export const getProfileDepartments = asyncHandler(
  async (req, res) => {
    const departments = await Department.find({
      isActive: true,
    })
      .select("name code description durationInYears isActive")
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Profile departments retrieved successfully",
      data: { departments },
    });
  }
);

export const getProfileAcademicYears = asyncHandler(
  async (req, res) => {
    const { departmentId } = req.params;

    if (!mongoose.isValidObjectId(departmentId)) {
      throw new ApiError(400, "Invalid department ID");
    }

    const department = await Department.findOne({
      _id: departmentId,
      isActive: true,
    })
      .select("name code durationInYears isActive")
      .lean();

    if (!department) {
      throw new ApiError(404, "Active department not found");
    }

    const academicYears = await AcademicYear.find({
      department: departmentId,
      isActive: true,
    })
      .select("department yearNumber name sortOrder isActive")
      .sort({ sortOrder: 1, yearNumber: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Profile academic years retrieved successfully",
      data: { department, academicYears },
    });
  }
);
