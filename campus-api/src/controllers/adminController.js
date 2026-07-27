import User, {
  USER_ROLES,
  TEACHER_APPROVAL_STATUSES,
} from "../models/User.js";

import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";

import {
  sendWelcomeEmail,
} from "../services/emailService.js";

/**
 * Return only safe user information.
 */
const getPublicUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  isEmailVerified: user.isEmailVerified,
  isActive: user.isActive,
  teacherApprovalStatus:
    user.teacherApprovalStatus,
  teacherApprovedAt:
    user.teacherApprovedAt,
  teacherRejectionReason:
    user.teacherRejectionReason,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

/**
 * GET /api/v1/admin/teachers/pending
 *
 * Returns verified teachers waiting for administrator approval.
 */
export const getPendingTeachers =
  asyncHandler(async (req, res) => {
    const teachers = await User.find({
      role: USER_ROLES.TEACHER,
      isEmailVerified: true,
      teacherApprovalStatus:
        TEACHER_APPROVAL_STATUSES.PENDING,
    })
      .sort({
        createdAt: 1,
      })
      .lean();

    return res.status(200).json({
      success: true,
      message:
        "Pending teachers retrieved successfully",
      data: {
        count: teachers.length,
        teachers: teachers.map(
          getPublicUser
        ),
      },
    });
  });

/**
 * PATCH /api/v1/admin/teachers/:id/approve
 *
 * Approves a verified teacher account.
 */
export const approveTeacher =
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const teacher = await User.findById(id);

    if (!teacher) {
      throw new ApiError(
        404,
        "Teacher not found"
      );
    }

    if (
      teacher.role !== USER_ROLES.TEACHER
    ) {
      throw new ApiError(
        400,
        "Selected user is not a teacher"
      );
    }

    if (!teacher.isEmailVerified) {
      throw new ApiError(
        400,
        "Teacher must verify their email before approval"
      );
    }

    if (
      teacher.teacherApprovalStatus ===
      TEACHER_APPROVAL_STATUSES.APPROVED
    ) {
      throw new ApiError(
        400,
        "Teacher is already approved"
      );
    }

    teacher.teacherApprovalStatus =
      TEACHER_APPROVAL_STATUSES.APPROVED;

    teacher.teacherApprovedAt =
      new Date();

    teacher.teacherApprovedBy =
      req.user._id;

    teacher.teacherRejectionReason =
      null;

    teacher.isActive = true;

    await teacher.save({
      validateBeforeSave: false,
    });

    try {
      await sendWelcomeEmail(teacher);
    } catch (error) {
      console.error(
        `Failed to send welcome email to ${teacher.email}: ${error.message}`
      );
    }

    return res.status(200).json({
      success: true,
      message:
        "Teacher approved successfully",
      data: {
        teacher:
          getPublicUser(teacher),
      },
    });
  });

/**
 * PATCH /api/v1/admin/teachers/:id/reject
 *
 * Rejects a pending teacher account.
 */
export const rejectTeacher =
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    const teacher = await User.findById(id);

    if (!teacher) {
      throw new ApiError(
        404,
        "Teacher not found"
      );
    }

    if (
      teacher.role !== USER_ROLES.TEACHER
    ) {
      throw new ApiError(
        400,
        "Selected user is not a teacher"
      );
    }

    if (
      teacher.teacherApprovalStatus ===
      TEACHER_APPROVAL_STATUSES.APPROVED
    ) {
      throw new ApiError(
        400,
        "Approved teachers cannot be rejected"
      );
    }

    if (
      teacher.teacherApprovalStatus ===
      TEACHER_APPROVAL_STATUSES.REJECTED
    ) {
      throw new ApiError(
        400,
        "Teacher is already rejected"
      );
    }

    teacher.teacherApprovalStatus =
      TEACHER_APPROVAL_STATUSES.REJECTED;

    teacher.teacherRejectionReason =
      reason?.trim() ||
      "No reason provided";

    teacher.teacherApprovedBy = null;
    teacher.teacherApprovedAt = null;
    teacher.isActive = false;

    await teacher.save({
      validateBeforeSave: false,
    });

    return res.status(200).json({
      success: true,
      message:
        "Teacher rejected successfully",
      data: {
        teacher:
          getPublicUser(teacher),
      },
    });
  });

/**
 * GET /api/v1/admin/users
 *
 * Returns all registered users.
 */
export const getAllUsers =
  asyncHandler(async (req, res) => {
    const users = await User.find({})
      .sort({
        createdAt: -1,
      })
      .lean();

    return res.status(200).json({
      success: true,
      message:
        "Users retrieved successfully",
      data: {
        count: users.length,
        users: users.map(getPublicUser),
      },
    });
  });

/**
 * GET /api/v1/admin/dashboard
 *
 * Returns summary information for the admin dashboard.
 */
export const getAdminDashboard =
  asyncHandler(async (req, res) => {
    const [
      totalUsers,
      totalStudents,
      totalTeachers,
      pendingTeachers,
      activeUsers,
    ] = await Promise.all([
      User.countDocuments(),

      User.countDocuments({
        role: USER_ROLES.STUDENT,
      }),

      User.countDocuments({
        role: USER_ROLES.TEACHER,
      }),

      User.countDocuments({
        role: USER_ROLES.TEACHER,
        isEmailVerified: true,
        teacherApprovalStatus:
          TEACHER_APPROVAL_STATUSES.PENDING,
      }),

      User.countDocuments({
        isActive: true,
      }),
    ]);

    return res.status(200).json({
      success: true,
      message:
        "Admin dashboard retrieved successfully",
      data: {
        stats: {
          totalUsers,
          totalStudents,
          totalTeachers,
          pendingTeachers,
          activeUsers,
        },
      },
    });
  });