import express from "express";

import {
  completeStudentProfile,
  completeTeacherProfile,
} from "../controllers/profileController.js";

import authenticate from "../middleware/authenticate.js";
import validateRequest from "../middleware/validateRequest.js";

import {
  studentProfileSchema,
  teacherProfileSchema,
} from "../validators/profileValidators.js";

const router = express.Router();

/*
  Every profile route requires login.
*/
router.use(authenticate);

/**
 * Student profile setup
 *
 * PATCH /api/v1/profile/student
 */
router.patch(
  "/student",
  validateRequest(studentProfileSchema),
  completeStudentProfile
);

/**
 * Teacher profile setup
 *
 * PATCH /api/v1/profile/teacher
 */
router.patch(
  "/teacher",
  validateRequest(teacherProfileSchema),
  completeTeacherProfile
);

export default router;