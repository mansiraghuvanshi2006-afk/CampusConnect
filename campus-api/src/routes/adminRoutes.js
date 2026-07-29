import express from "express";

import {
  approveTeacher,
  deleteUserPermanently,
  getAdminDashboard,
  getAdminUserById,
  getAllUsers,
  getPendingTeachers,
  rejectTeacher,
  updateAdminUser,
  updateUserStatus,
} from "../controllers/adminController.js";

import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import validateParams from "../middleware/validateParams.js";
import validateRequest from "../middleware/validateRequest.js";

import {
  rejectTeacherSchema,
  teacherIdParamsSchema,
} from "../validators/adminValidators.js";

import { USER_ROLES } from "../models/User.js";

import departmentRoutes from "./admin/departmentRoutes.js";
import adminAcademicYearRoutes from "./adminAcademicYearRoutes.js";

const router = express.Router();

/**
 * Every admin route below requires:
 * 1. A valid authenticated user
 * 2. The admin role
 */
router.use(
  authenticate,
  authorize(USER_ROLES.ADMIN)
);

/**
 * GET /api/v1/admin/dashboard
 */
router.get(
  "/dashboard",
  getAdminDashboard
);

/**
 * GET /api/v1/admin/teachers/pending
 */
router.get(
  "/teachers/pending",
  getPendingTeachers
);

/**
 * PATCH /api/v1/admin/teachers/:id/approve
 */
router.patch(
  "/teachers/:id/approve",
  validateParams(teacherIdParamsSchema),
  approveTeacher
);

/**
 * PATCH /api/v1/admin/teachers/:id/reject
 */
router.patch(
  "/teachers/:id/reject",
  validateParams(teacherIdParamsSchema),
  validateRequest(rejectTeacherSchema),
  rejectTeacher
);

/**
 * GET /api/v1/admin/users
 *
 * Supported query examples:
 * /users?type=all
 * /users?type=students
 * /users?type=teachers
 * /users?type=pending-teachers
 * /users?type=active
 * /users?type=inactive
 */
router.get(
  "/users",
  getAllUsers
);

/**
 * GET /api/v1/admin/users/:id
 *
 * Returns one user.
 */
router.get(
  "/users/:id",
  getAdminUserById
);

/**
 * PATCH /api/v1/admin/users/:id/status
 *
 * Body:
 * {
 *   "isActive": true
 * }
 */
router.patch(
  "/users/:id/status",
  updateUserStatus
);

/**
 * PATCH /api/v1/admin/users/:id
 *
 * Updates user information.
 */
router.patch(
  "/users/:id",
  updateAdminUser
);

/**
 * DELETE /api/v1/admin/users/:id
 *
 * Body:
 * {
 *   "confirmation": "DELETE"
 * }
 */
router.delete(
  "/users/:id",
  deleteUserPermanently
);

/**
 * Department routes
 *
 * POST   /api/v1/admin/departments
 * GET    /api/v1/admin/departments
 * GET    /api/v1/admin/departments/:departmentId
 * PATCH  /api/v1/admin/departments/:departmentId
 * DELETE /api/v1/admin/departments/:departmentId
 */
router.use(
  "/departments",
  departmentRoutes
);

/**
 * Academic year routes
 *
 * GET    /api/v1/admin/departments/:departmentId/years
 * POST   /api/v1/admin/departments/:departmentId/years
 * GET    /api/v1/admin/academic-years/:academicYearId
 * PATCH  /api/v1/admin/academic-years/:academicYearId
 * DELETE /api/v1/admin/academic-years/:academicYearId
 */
router.use(
  "/",
  adminAcademicYearRoutes
);

export default router;