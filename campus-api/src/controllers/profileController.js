import User, {
  USER_ROLES,
  TEACHER_APPROVAL_STATUSES,
} from "../models/User.js";
import AcademicYear from "../models/AcademicYear.js";
import Department from "../models/Department.js";

import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

const getPublicProfile = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  department: user.department || null,
  year: user.year ?? null,
  teachingYears: user.teachingYears || [],
  profileCompleted: user.profileCompleted,
  isEmailVerified: user.isEmailVerified,
  isActive: user.isActive,
  teacherApprovalStatus:
    user.teacherApprovalStatus,
  teacherApprovedAt:
    user.teacherApprovedAt,
  teacherRejectionReason:
    user.teacherRejectionReason,
  updatedAt: user.updatedAt,
});

const getValidatedProfileYears = async (
  departmentId,
  requestedYears
) => {
  const department = await Department.findOne({
    _id: departmentId,
    isActive: true,
  }).select("_id");

  if (!department) {
    throw new ApiError(400, "Select an active department");
  }

  const uniqueYears = [...new Set(requestedYears)];
  const matchingYears = await AcademicYear.countDocuments({
    department: departmentId,
    yearNumber: { $in: uniqueYears },
    isActive: true,
  });

  if (matchingYears !== uniqueYears.length) {
    throw new ApiError(
      400,
      "One or more selected academic years are unavailable for this department"
    );
  }

  return uniqueYears;
};

/**
 * PATCH /api/v1/profile/student
 *
 * Complete or update the logged-in
 * student's department and year.
 */
export const completeStudentProfile =
  asyncHandler(async (req, res) => {
    if (
      req.user.role !==
      USER_ROLES.STUDENT
    ) {
      throw new ApiError(
        403,
        "Only students can complete a student profile"
      );
    }

    const {
      department,
      year,
    } = req.body;

    const [validatedYear] =
      await getValidatedProfileYears(
        department,
        [year]
      );

    const user =
      await User.findByIdAndUpdate(
        req.user._id,
        {
          department,
          year: validatedYear,
          teachingYears: [],
          profileCompleted: true,
        },
        {
          new: true,
          runValidators: true,
        }
      );

    if (!user) {
      throw new ApiError(
        404,
        "User account not found"
      );
    }

    return res.status(200).json({
      success: true,
      message:
        "Student profile completed successfully",
      data: {
        user:
          getPublicProfile(user),
      },
    });
  });

/**
 * PATCH /api/v1/profile/teacher
 *
 * Complete or update the logged-in
 * teacher's department and teaching years.
 */
export const completeTeacherProfile =
  asyncHandler(async (req, res) => {
    if (
      req.user.role !==
      USER_ROLES.TEACHER
    ) {
      throw new ApiError(
        403,
        "Only teachers can complete a teacher profile"
      );
    }

    const {
      department,
      teachingYears,
    } = req.body;

    if (
      req.user.teacherApprovalStatus ===
      TEACHER_APPROVAL_STATUSES.APPROVED
    ) {
      throw new ApiError(
        403,
        "Approved teachers cannot resubmit profile approval"
      );
    }

    const validatedTeachingYears =
      await getValidatedProfileYears(
        department,
        teachingYears
      );

    const user =
      await User.findByIdAndUpdate(
        req.user._id,
        {
          department,
          year: null,
          teachingYears: validatedTeachingYears,
          profileCompleted: true,

          isActive: false,

          teacherApprovalStatus:
            TEACHER_APPROVAL_STATUSES.PENDING,

          teacherApprovedAt: null,
          teacherApprovedBy: null,
          teacherRejectionReason: null,
        },
        {
          new: true,
          runValidators: true,
        }
      );

    if (!user) {
      throw new ApiError(
        404,
        "User account not found"
      );
    }

    return res.status(200).json({
      success: true,
      message:
        "Teacher profile completed successfully and is waiting for admin approval",
      data: {
        user:
          getPublicProfile(user),
      },
    });
  });
