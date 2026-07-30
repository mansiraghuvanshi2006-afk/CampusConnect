import express from "express";

import {
  completeStudentProfile,
  completeTeacherProfile,
  getMe,
  removeAvatar,
  updateMe,
  uploadAvatar,
} from "../controllers/profileController.js";

import authenticate from "../middleware/authenticate.js";
import requirePasswordChange from "../middleware/requirePasswordChange.js";
import validateRequest from "../middleware/validateRequest.js";
import { avatarUpload } from "../middleware/uploadMiddleware.js";

import {
  studentProfileSchema,
  teacherProfileSchema,
} from "../validators/profileValidators.js";
import { updateMyProfileSchema } from "../validators/settingsValidators.js";

const router = express.Router();

/*
  Every profile route requires login and a resolved
  temporary-password change.
*/
router.use(authenticate, requirePasswordChange);

/**
 * Self profile (Phase 8)
 */
router.get("/me", getMe);

router.patch(
  "/me",
  validateRequest(updateMyProfileSchema),
  updateMe
);

router.post(
  "/me/avatar",
  avatarUpload.single("avatar"),
  uploadAvatar
);

router.delete("/me/avatar", removeAvatar);

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
