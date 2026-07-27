import express from "express";

import {
  approveTeacher,
  getAdminDashboard,
  getAllUsers,
  getPendingTeachers,
  rejectTeacher,
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
 */
router.get(
  "/users",
  getAllUsers
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

export default router;