import mongoose from "mongoose";

import User, {
  USER_ROLES,
  TEACHER_APPROVAL_STATUSES,
  ACADEMIC_YEARS,
} from "../models/User.js";
import AcademicYear from "../models/AcademicYear.js";
import Department from "../models/Department.js";

import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { sendWelcomeEmail } from "../services/emailService.js";

/**
 * Check MongoDB ObjectId before querying.
 */
const ensureValidObjectId = (id, resourceName = "User") => {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(
      400,
      `Invalid ${resourceName.toLowerCase()} ID`
    );
  }
};

/**
 * Prevent special regex characters from changing search behaviour.
 */
const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Return only safe user information.
 */
const getPublicUser = (user) => ({
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
  teacherApprovalStatus: user.teacherApprovalStatus,
  teacherApprovedAt: user.teacherApprovedAt,
  teacherRejectionReason: user.teacherRejectionReason,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

/**
 * Build filters for the reusable admin users page.
 */
const buildAdminUserFilter = (type) => {
  switch (type) {
    case "students":
      return {
        role: USER_ROLES.STUDENT,
      };

    case "teachers":
      return {
        role: USER_ROLES.TEACHER,
      };

    case "pending-teachers":
      return {
        role: USER_ROLES.TEACHER,
        isEmailVerified: true,
        teacherApprovalStatus:
          TEACHER_APPROVAL_STATUSES.PENDING,
      };

    case "active":
      return {
        isActive: true,
      };

    case "inactive":
      return {
        isActive: false,
      };

    case "all":
    default:
      return {};
  }
};

/**
 * GET /api/v1/admin/teachers/pending
 *
 * Return verified teachers waiting for approval.
 */
export const getPendingTeachers = asyncHandler(
  async (req, res) => {
    const teachers = await User.find({
      role: USER_ROLES.TEACHER,
      isEmailVerified: true,
      profileCompleted: true,
      teacherApprovalStatus:
        TEACHER_APPROVAL_STATUSES.PENDING,
    })
      .sort({ createdAt: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      message:
        "Pending teachers retrieved successfully",
      data: {
        count: teachers.length,
        teachers: teachers.map(getPublicUser),
      },
    });
  }
);

/**
 * PATCH /api/v1/admin/teachers/:id/approve
 *
 * Approve a verified teacher.
 */
export const approveTeacher = asyncHandler(
  async (req, res) => {
    const { id } = req.params;

    ensureValidObjectId(id, "Teacher");

    const teacher = await User.findById(id);

    if (!teacher) {
      throw new ApiError(404, "Teacher not found");
    }

    if (teacher.role !== USER_ROLES.TEACHER) {
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
      !teacher.profileCompleted ||
      !teacher.department ||
      teacher.teachingYears.length === 0
    ) {
      throw new ApiError(
        400,
        "Teacher must complete a valid profile before approval"
      );
    }

    const [activeDepartment, activeYearCount] =
      await Promise.all([
        Department.exists({
          _id: teacher.department,
          isActive: true,
        }),
        AcademicYear.countDocuments({
          department: teacher.department,
          yearNumber: {
            $in: teacher.teachingYears,
          },
          isActive: true,
        }),
      ]);

    if (
      !activeDepartment ||
      activeYearCount !==
        new Set(teacher.teachingYears).size
    ) {
      throw new ApiError(
        400,
        "Teacher profile contains an inactive or unavailable department or academic year"
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

    teacher.teacherApprovedAt = new Date();
    teacher.teacherApprovedBy = req.user._id;
    teacher.teacherRejectionReason = null;
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
      message: "Teacher approved successfully",
      data: {
        teacher: getPublicUser(teacher),
      },
    });
  }
);

/**
 * PATCH /api/v1/admin/teachers/:id/reject
 *
 * Reject a pending teacher.
 */
export const rejectTeacher = asyncHandler(
  async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    ensureValidObjectId(id, "Teacher");

    const teacher = await User.findById(id);

    if (!teacher) {
      throw new ApiError(404, "Teacher not found");
    }

    if (teacher.role !== USER_ROLES.TEACHER) {
      throw new ApiError(
        400,
        "Selected user is not a teacher"
      );
    }

    if (!teacher.profileCompleted) {
      throw new ApiError(
        400,
        "Teacher must complete a profile before rejection"
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
      typeof reason === "string" && reason.trim()
        ? reason.trim()
        : "No reason provided";

    teacher.teacherApprovedBy = null;
    teacher.teacherApprovedAt = null;
    teacher.isActive = false;

    await teacher.save({
      validateBeforeSave: false,
    });

    return res.status(200).json({
      success: true,
      message: "Teacher rejected successfully",
      data: {
        teacher: getPublicUser(teacher),
      },
    });
  }
);

/**
 * GET /api/v1/admin/users
 *
 * Supported filters:
 *
 * /users?type=all
 * /users?type=students
 * /users?type=teachers
 * /users?type=pending-teachers
 * /users?type=active
 * /users?type=inactive
 *
 * Search and pagination:
 *
 * /users?search=name
 * /users?page=1&limit=20
 */
export const getAllUsers = asyncHandler(
  async (req, res) => {
    const {
      type = "all",
      search = "",
      page = 1,
      limit = 20,
    } = req.query;

    const allowedTypes = [
      "all",
      "students",
      "teachers",
      "pending-teachers",
      "active",
      "inactive",
    ];

    if (!allowedTypes.includes(type)) {
      throw new ApiError(
        400,
        "Invalid user list type"
      );
    }

    const filter = buildAdminUserFilter(type);

    const trimmedSearch = String(search).trim();

    if (trimmedSearch) {
      const escapedSearch =
        escapeRegex(trimmedSearch);

      filter.$or = [
        {
          name: {
            $regex: escapedSearch,
            $options: "i",
          },
        },
        {
          email: {
            $regex: escapedSearch,
            $options: "i",
          },
        },
      ];
    }

    const pageNumber = Math.max(
      Number.parseInt(page, 10) || 1,
      1
    );

    const limitNumber = Math.min(
      Math.max(
        Number.parseInt(limit, 10) || 20,
        1
      ),
      100
    );

    const skip =
      (pageNumber - 1) * limitNumber;

    const [users, totalUsers] =
      await Promise.all([
        User.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNumber)
          .lean(),

        User.countDocuments(filter),
      ]);

    const totalPages = Math.max(
      Math.ceil(totalUsers / limitNumber),
      1
    );

    return res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      data: {
        users: users.map(getPublicUser),

        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalUsers,
          limit: limitNumber,
          hasNextPage:
            pageNumber < totalPages,
          hasPreviousPage:
            pageNumber > 1,
        },

        filter: {
          type,
          search: trimmedSearch,
        },
      },
    });
  }
);

/**
 * GET /api/v1/admin/users/:id
 *
 * Return one user.
 */
export const getAdminUserById = asyncHandler(
  async (req, res) => {
    const { id } = req.params;

    ensureValidObjectId(id);

    const user = await User.findById(id).lean();

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    return res.status(200).json({
      success: true,
      message: "User retrieved successfully",
      data: {
        user: getPublicUser(user),
      },
    });
  }
);

/**
 * PATCH /api/v1/admin/users/:id
 *
 * Update editable user information.
 */
export const updateAdminUser = asyncHandler(
  async (req, res) => {
    const { id } = req.params;

    ensureValidObjectId(id);

    const {
      name,
      email,
      role,
      department,
      year,
      teachingYears,
      profileCompleted,
    } = req.body;

    const user = await User.findById(id);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const isEditingSelf =
      user._id.toString() ===
      req.user._id.toString();

    /**
     * Prevent the logged-in admin from removing
     * their own admin role.
     */
    if (
      isEditingSelf &&
      role !== undefined &&
      role !== USER_ROLES.ADMIN
    ) {
      throw new ApiError(
        400,
        "You cannot remove your own admin role"
      );
    }

    /**
     * Update name.
     */
    if (name !== undefined) {
      if (typeof name !== "string") {
        throw new ApiError(
          400,
          "Name must be a string"
        );
      }

      const trimmedName = name.trim();

      if (trimmedName.length < 2) {
        throw new ApiError(
          400,
          "Name must contain at least 2 characters"
        );
      }

      if (trimmedName.length > 100) {
        throw new ApiError(
          400,
          "Name cannot exceed 100 characters"
        );
      }

      user.name = trimmedName;
    }

    /**
     * Update email.
     */
    if (email !== undefined) {
      if (typeof email !== "string") {
        throw new ApiError(
          400,
          "Email must be a string"
        );
      }

      const normalizedEmail = email
        .trim()
        .toLowerCase();

      if (!normalizedEmail) {
        throw new ApiError(
          400,
          "Email is required"
        );
      }

      const basicEmailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (
        !basicEmailPattern.test(
          normalizedEmail
        )
      ) {
        throw new ApiError(
          400,
          "Please provide a valid email address"
        );
      }

      if (
        normalizedEmail !==
        user.email.toLowerCase()
      ) {
        const emailAlreadyExists =
          await User.exists({
            email: normalizedEmail,
            _id: {
              $ne: user._id,
            },
          });

        if (emailAlreadyExists) {
          throw new ApiError(
            409,
            "A user with this email already exists"
          );
        }

        user.email = normalizedEmail;
        user.emailVerificationToken = null;
        user.emailVerificationExpiresAt = null;

        /**
         * Do not lock the currently logged-in
         * admin out after changing their email.
         */
        if (isEditingSelf) {
          user.isEmailVerified = true;
          user.isActive = true;
        } else {
          user.isEmailVerified = false;
          user.isActive = false;
        }
      }
    }

    /**
     * Update role.
     */
    if (role !== undefined) {
      const validRoles =
        Object.values(USER_ROLES);

      if (!validRoles.includes(role)) {
        throw new ApiError(
          400,
          "Invalid user role"
        );
      }

      const previousRole = user.role;

      user.role = role;

      if (role === USER_ROLES.ADMIN) {
        user.department = null;
        user.year = null;
        user.teachingYears = [];
        user.profileCompleted = true;
        user.isEmailVerified = true;
        user.isActive = true;

        user.teacherApprovalStatus =
          TEACHER_APPROVAL_STATUSES.NOT_REQUIRED;

        user.teacherApprovedAt = null;
        user.teacherApprovedBy = null;
        user.teacherRejectionReason = null;
      }

      if (
        role === USER_ROLES.STUDENT &&
        previousRole !== USER_ROLES.STUDENT
      ) {
        user.year = null;
        user.teachingYears = [];
        user.profileCompleted = false;

        user.teacherApprovalStatus =
          TEACHER_APPROVAL_STATUSES.NOT_REQUIRED;

        user.teacherApprovedAt = null;
        user.teacherApprovedBy = null;
        user.teacherRejectionReason = null;
      }

      if (
        role === USER_ROLES.TEACHER &&
        previousRole !== USER_ROLES.TEACHER
      ) {
        user.year = null;
        user.teachingYears = [];
        user.profileCompleted = false;
        user.isActive = false;

        user.teacherApprovalStatus =
          TEACHER_APPROVAL_STATUSES.PENDING;

        user.teacherApprovedAt = null;
        user.teacherApprovedBy = null;
        user.teacherRejectionReason = null;
      }
    }

    /**
     * Update department.
     */
    if (department !== undefined) {
      if (
        department !== null &&
        department !== "" &&
        !mongoose.isValidObjectId(department)
      ) {
        throw new ApiError(
          400,
          "Invalid department"
        );
      }

      if (department) {
        const departmentExists =
          await Department.exists({
            _id: department,
          });

        if (!departmentExists) {
          throw new ApiError(
            400,
            "Department not found"
          );
        }
      }

      if (
        user.role === USER_ROLES.ADMIN &&
        department
      ) {
        throw new ApiError(
          400,
          "Admin users cannot have a department"
        );
      }

      user.department =
        department || null;
    }

    /**
     * Update student year.
     */
    if (year !== undefined) {
      const normalizedYear =
        year === null || year === ""
          ? null
          : Number(year);

      if (
        normalizedYear !== null &&
        !Object.values(
          ACADEMIC_YEARS
        ).includes(normalizedYear)
      ) {
        throw new ApiError(
          400,
          "Invalid academic year"
        );
      }


      if (
        normalizedYear !== null &&
        user.department
      ) {
        const academicYearExists =
          await AcademicYear.exists({
            department: user.department,
            yearNumber: normalizedYear,
          });

        if (!academicYearExists) {
          throw new ApiError(
            400,
            "Academic year is not available for the selected department"
          );
        }
      }

      if (
        user.role !== USER_ROLES.STUDENT &&
        normalizedYear !== null
      ) {
        throw new ApiError(
          400,
          "Only students can have an academic year"
        );
      }

      user.year = normalizedYear;
    }

    /**
     * Update teacher teaching years.
     */
    if (teachingYears !== undefined) {
      if (!Array.isArray(teachingYears)) {
        throw new ApiError(
          400,
          "Teaching years must be an array"
        );
      }

      const normalizedYears = [
        ...new Set(
          teachingYears.map(Number)
        ),
      ];

      const hasInvalidYear =
        normalizedYears.some(
          (teachingYear) =>
            !Object.values(
              ACADEMIC_YEARS
            ).includes(teachingYear)
        );

      if (hasInvalidYear) {
        throw new ApiError(
          400,
          "One or more teaching years are invalid"
        );
      }

      if (
        normalizedYears.length > 0 &&
        user.department
      ) {
        const matchingYearCount =
          await AcademicYear.countDocuments({
            department: user.department,
            yearNumber: {
              $in: normalizedYears,
            },
          });

        if (
          matchingYearCount !==
          normalizedYears.length
        ) {
          throw new ApiError(
            400,
            "One or more teaching years are unavailable for the selected department"
          );
        }
      }

      if (
        user.role !== USER_ROLES.TEACHER &&
        normalizedYears.length > 0
      ) {
        throw new ApiError(
          400,
          "Only teachers can have teaching years"
        );
      }

      user.teachingYears =
        normalizedYears;
    }

    /**
     * Update profile completion.
     */
    if (profileCompleted !== undefined) {
      if (
        typeof profileCompleted !== "boolean"
      ) {
        throw new ApiError(
          400,
          "profileCompleted must be true or false"
        );
      }

      user.profileCompleted =
        profileCompleted;
    }

    /**
     * Keep student-only fields clean.
     */
    if (user.role === USER_ROLES.STUDENT) {
      user.teachingYears = [];

      user.teacherApprovalStatus =
        TEACHER_APPROVAL_STATUSES.NOT_REQUIRED;

      user.teacherApprovedAt = null;
      user.teacherApprovedBy = null;
      user.teacherRejectionReason = null;
    }

    /**
     * Keep teacher-only fields clean.
     */
    if (user.role === USER_ROLES.TEACHER) {
      user.year = null;
    }

    /**
     * Keep admin fields clean.
     */
    if (user.role === USER_ROLES.ADMIN) {
      user.department = null;
      user.year = null;
      user.teachingYears = [];
      user.profileCompleted = true;
      user.isEmailVerified = true;
      user.isActive = true;

      user.teacherApprovalStatus =
        TEACHER_APPROVAL_STATUSES.NOT_REQUIRED;

      user.teacherApprovedAt = null;
      user.teacherApprovedBy = null;
      user.teacherRejectionReason = null;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: {
        user: getPublicUser(user),
      },
    });
  }
);

/**
 * PATCH /api/v1/admin/users/:id/status
 *
 * Activate or deactivate a user.
 */
export const updateUserStatus = asyncHandler(
  async (req, res) => {
    const { id } = req.params;
    const { isActive } = req.body;

    ensureValidObjectId(id);

    if (typeof isActive !== "boolean") {
      throw new ApiError(
        400,
        "isActive must be true or false"
      );
    }

    const user = await User.findById(id);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const isUpdatingSelf =
      user._id.toString() ===
      req.user._id.toString();

    if (
      isUpdatingSelf &&
      isActive === false
    ) {
      throw new ApiError(
        400,
        "You cannot deactivate your own account"
      );
    }

    if (
      isActive === true &&
      !user.isEmailVerified
    ) {
      throw new ApiError(
        400,
        "User must verify their email before activation"
      );
    }

    if (
      user.role === USER_ROLES.TEACHER &&
      isActive === true &&
      user.teacherApprovalStatus !==
        TEACHER_APPROVAL_STATUSES.APPROVED
    ) {
      throw new ApiError(
        400,
        "Teacher must be approved before activation"
      );
    }

    user.isActive = isActive;

    await user.save({
      validateBeforeSave: false,
    });

    return res.status(200).json({
      success: true,
      message: isActive
        ? "User activated successfully"
        : "User deactivated successfully",
      data: {
        user: getPublicUser(user),
      },
    });
  }
);

/**
 * DELETE /api/v1/admin/users/:id
 *
 * Permanently delete a user.
 *
 * Request body:
 * {
 *   "confirmation": "DELETE"
 * }
 */
export const deleteUserPermanently =
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { confirmation } = req.body;

    ensureValidObjectId(id);

    if (confirmation !== "DELETE") {
      throw new ApiError(
        400,
        'Type "DELETE" to confirm permanent deletion'
      );
    }

    if (
      id === req.user._id.toString()
    ) {
      throw new ApiError(
        400,
        "You cannot permanently delete your own admin account"
      );
    }

    const user = await User.findById(id);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    await user.deleteOne();

    return res.status(200).json({
      success: true,
      message: `"${user.name}" was permanently deleted`,
      data: {
        deletedUserId: id,
      },
    });
  });

/**
 * GET /api/v1/admin/dashboard
 *
 * Return admin dashboard statistics.
 */
export const getAdminDashboard =
  asyncHandler(async (req, res) => {
    const [
      totalUsers,
      totalStudents,
      totalTeachers,
      pendingTeachers,
      activeUsers,
      inactiveUsers,
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
        profileCompleted: true,
        teacherApprovalStatus:
          TEACHER_APPROVAL_STATUSES.PENDING,
      }),

      User.countDocuments({
        isActive: true,
      }),

      User.countDocuments({
        isActive: false,
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
          inactiveUsers,
        },
      },
    });
  });
