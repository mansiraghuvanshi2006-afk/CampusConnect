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

import {
  assertActiveAcademicYears,
  assertNoServerControlledFields,
  countActiveAdmins,
  createUserAsAdmin,
  deleteUserAsAdmin,
  getActiveDepartment,
  resetUserPasswordAsAdmin,
} from "../services/adminUserService.js";

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
 * Serialize a populated or raw department reference.
 */
const getPublicDepartment = (department) => {
  if (!department) {
    return null;
  }

  if (!department.name) {
    return {
      id: department._id
        ? department._id.toString()
        : department.toString(),
    };
  }

  return {
    id: department._id.toString(),
    name: department.name,
    code: department.code,
    isActive: department.isActive,
  };
};

/**
 * Return only safe user information.
 *
 * Passwords, verification tokens and other internal
 * security fields must never be included.
 */
const getPublicUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  department: getPublicDepartment(user.department),
  year: user.year ?? null,
  teachingYears: user.teachingYears || [],
  profileCompleted: user.profileCompleted,
  isEmailVerified: user.isEmailVerified,
  isActive: user.isActive,
  mustChangePassword: Boolean(
    user.mustChangePassword
  ),
  teacherApprovalStatus: user.teacherApprovalStatus,
  teacherApprovedAt: user.teacherApprovedAt,
  teacherRejectionReason: user.teacherRejectionReason,
  createdBy: user.createdBy
    ? user.createdBy.toString()
    : null,
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

    case "admins":
      return {
        role: USER_ROLES.ADMIN,
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
 *
 * Additional filters:
 *
 * /users?role=student
 * /users?department=<departmentId>
 * /users?year=2
 */
export const getAllUsers = asyncHandler(
  async (req, res) => {
    const {
      type = "all",
      search = "",
      role,
      department,
      year,
      page = 1,
      limit = 20,
    } = req.query;

    const allowedTypes = [
      "all",
      "students",
      "teachers",
      "admins",
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

    /*
      Year and search both need $or, so they are combined
      with $and to avoid overwriting each other.
    */
    const andConditions = [];

    if (role) {
      if (
        !Object.values(USER_ROLES).includes(role)
      ) {
        throw new ApiError(
          400,
          "Invalid user role filter"
        );
      }

      filter.role = role;
    }

    if (department) {
      if (
        !mongoose.isValidObjectId(department)
      ) {
        throw new ApiError(
          400,
          "Invalid department filter"
        );
      }

      filter.department = department;
    }

    if (year) {
      const yearNumber = Number(year);

      if (
        !Object.values(
          ACADEMIC_YEARS
        ).includes(yearNumber)
      ) {
        throw new ApiError(
          400,
          "Invalid academic year filter"
        );
      }

      /*
        Students store a single year while teachers
        store a list of assigned years.
      */
      andConditions.push({
        $or: [
          { year: yearNumber },
          { teachingYears: yearNumber },
        ],
      });
    }

    const trimmedSearch = String(search).trim();

    if (trimmedSearch) {
      const escapedSearch =
        escapeRegex(trimmedSearch);

      andConditions.push({
        $or: [
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
        ],
      });
    }

    if (andConditions.length > 0) {
      filter.$and = andConditions;
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
          .populate(
            "department",
            "name code isActive"
          )
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
          role: role || null,
          department: department || null,
          year: year ? Number(year) : null,
        },
      },
    });
  }
);

/**
 * POST /api/v1/admin/users
 *
 * Create a student, teacher or admin account directly.
 *
 * Admin-created accounts skip email verification, profile
 * onboarding and teacher approval, and must replace their
 * temporary password on first login.
 */
export const createAdminUser = asyncHandler(
  async (req, res) => {
    assertNoServerControlledFields(req.body);

    const user = await createUserAsAdmin(
      req.user,
      req.body
    );

    const created = await User.findById(user._id)
      .populate(
        "department",
        "name code isActive"
      )
      .lean();

    return res.status(201).json({
      success: true,
      message: `${user.role
        .charAt(0)
        .toUpperCase()}${user.role.slice(
        1
      )} account created successfully`,
      data: {
        user: getPublicUser(created),
      },
    });
  }
);

/**
 * PATCH /api/v1/admin/users/:id/reset-password
 *
 * Assign a new temporary password and require the user
 * to change it on their next login.
 */
export const resetAdminUserPassword =
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const user = await resetUserPasswordAsAdmin(
      req.user,
      id,
      req.body.temporaryPassword
    );

    return res.status(200).json({
      success: true,
      message:
        "Temporary password assigned. The user must change it at next login.",
      data: {
        user: getPublicUser(user),
      },
    });
  });

/**
 * GET /api/v1/admin/users/:id
 *
 * Return one user.
 */
export const getAdminUserById = asyncHandler(
  async (req, res) => {
    const { id } = req.params;

    ensureValidObjectId(id);

    const user = await User.findById(id)
      .populate(
        "department",
        "name code isActive"
      )
      .lean();

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

    assertNoServerControlledFields(req.body);

    const {
      name,
      email,
      role,
      department,
      year,
      teachingYears,
      isActive,
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
         *
         * Admin-provisioned accounts stay verified because
         * the administrator supplies the address directly and
         * those accounts never use the verification flow.
         */
        if (isEditingSelf || user.createdBy) {
          user.isEmailVerified = true;
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
     *
     * Only active departments may be assigned.
     */
    if (department !== undefined) {
      if (
        user.role === USER_ROLES.ADMIN &&
        department
      ) {
        throw new ApiError(
          400,
          "Admin users cannot have a department"
        );
      }

      if (department) {
        await getActiveDepartment(department);
      }

      user.department =
        department || null;
    }

    /**
     * Update student year.
     */
    if (year !== undefined) {
      const normalizedYear =
        year === null ? null : Number(year);

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
     * Update teacher assigned academic years.
     */
    if (teachingYears !== undefined) {
      const normalizedYears = [
        ...new Set(
          teachingYears.map(Number)
        ),
      ].sort(
        (first, second) => first - second
      );

      if (
        user.role !== USER_ROLES.TEACHER &&
        normalizedYears.length > 0
      ) {
        throw new ApiError(
          400,
          "Only teachers can have assigned academic years"
        );
      }

      user.teachingYears =
        normalizedYears;
    }

    /**
     * Update account status.
     */
    if (isActive !== undefined) {
      if (isEditingSelf && !isActive) {
        throw new ApiError(
          400,
          "You cannot deactivate your own account"
        );
      }

      if (
        !isActive &&
        user.role === USER_ROLES.ADMIN &&
        user.isActive &&
        (await countActiveAdmins(user._id)) === 0
      ) {
        throw new ApiError(
          400,
          "The final active platform administrator cannot be deactivated"
        );
      }

      if (isActive && !user.isEmailVerified) {
        throw new ApiError(
          400,
          "User must verify their email before activation"
        );
      }

      user.isActive = isActive;
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

    /**
     * Revalidate every department and academic-year
     * relationship after the updates are applied so no
     * invalid assignment is left behind.
     */
    if (user.department) {
      await getActiveDepartment(user.department);
    }

    if (user.role === USER_ROLES.STUDENT) {
      if (user.year !== null) {
        if (!user.department) {
          throw new ApiError(
            400,
            "A department is required before an academic year can be assigned"
          );
        }

        await assertActiveAcademicYears(
          user.department,
          [user.year]
        );
      }
    }

    if (user.role === USER_ROLES.TEACHER) {
      if (user.teachingYears.length > 0) {
        if (!user.department) {
          throw new ApiError(
            400,
            "A department is required before assigned academic years can be set"
          );
        }

        await assertActiveAcademicYears(
          user.department,
          user.teachingYears
        );
      }
    }

    /**
     * Admin-provisioned accounts never use the onboarding
     * flow, so profile completion tracks whether the
     * required profile fields are present.
     */
    if (user.createdBy) {
      if (user.role === USER_ROLES.STUDENT) {
        user.profileCompleted = Boolean(
          user.department && user.year
        );
      } else if (
        user.role === USER_ROLES.TEACHER
      ) {
        user.profileCompleted = Boolean(
          user.department &&
            user.teachingYears.length > 0
        );

        user.teacherApprovalStatus =
          TEACHER_APPROVAL_STATUSES.APPROVED;

        user.teacherApprovedAt =
          user.teacherApprovedAt || new Date();

        user.teacherApprovedBy =
          user.teacherApprovedBy || req.user._id;
      }
    }

    await user.save();

    const updated = await User.findById(user._id)
      .populate(
        "department",
        "name code isActive"
      )
      .lean();

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: {
        user: getPublicUser(updated),
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
      isActive === false &&
      user.role === USER_ROLES.ADMIN &&
      user.isActive &&
      (await countActiveAdmins(user._id)) === 0
    ) {
      throw new ApiError(
        400,
        "The final active platform administrator cannot be deactivated"
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

    const user = await deleteUserAsAdmin(
      req.user,
      id
    );

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
      totalAdmins,
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
        role: USER_ROLES.ADMIN,
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
          totalAdmins,
          pendingTeachers,
          activeUsers,
          inactiveUsers,
        },
      },
    });
  });
